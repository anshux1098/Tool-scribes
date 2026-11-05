// ToolScribe Background Service Worker (Manifest V3)

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const DEFAULT_SUPABASE_URL = "https://qglvwvpsegrucrhcpzxd.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_pN6EDmb7_lIo00Gtek36zw_QFU8sb3L";

// Known accidental backfilled / duplicate tool UUIDs to purge from DB & storage
const KNOWN_JUNK_UUIDS = new Set([
  '625c0544-9a1d-4e11-b502-e141fb5de15e', // Extensions
  'c631023c-889c-4eba-bf2b-4cd70c55828e', // Tool-scribes-beta
  'c01cb956-4193-4599-9317-35287739ffed', // Duplicate Python Certification | freeCodeCamp.org
  'cae4992f-18b9-4508-86bf-07f72d0e1e0a', // Duplicate Oracle MyLearn
  'dd1025f4-2461-459a-baa4-9fe8494404f1', // Localhost #1
  '7bf33712-9d2e-470c-8e4b-d813cb86656d'  // Localhost #2
]);

function normalizeToolDomain(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
  }
}

function isBlockedToolUrl(url) {
  if (!url || typeof url !== 'string') return true;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  if (!host || !host.includes('.')) return true; // blocks 'localhost', 'extensions', 'newtab', etc.
  if (
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.includes('tool-scribes') ||
    host.includes('toolscribes')
  ) {
    return true;
  }
  return false;
}

// Scan open tabs for an active Supabase login session
async function discoverSessionFromOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !tab.url || !tab.url.startsWith('http')) continue;
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                  const raw = localStorage.getItem(key);
                  if (!raw) continue;
                  const parsed = JSON.parse(raw);
                  const access_token = parsed?.access_token || parsed?.currentSession?.access_token;
                  const refresh_token = parsed?.refresh_token || parsed?.currentSession?.refresh_token;
                  const expires_at = parsed?.expires_at || parsed?.currentSession?.expires_at;
                  const user = parsed?.user || parsed?.currentSession?.user;
                  if (access_token && user?.id) {
                    return {
                      access_token,
                      refresh_token: refresh_token || '',
                      expires_at: expires_at || 0,
                      user_id: user.id,
                      user_email: user.email || ''
                    };
                  }
                }
              }
            } catch {}
            return null;
          }
        });
        const found = results?.[0]?.result;
        if (found && found.access_token && found.user_id) {
          await new Promise(r => chrome.storage.local.set({ ts_auth_session: found }, r));
          return found;
        }
      } catch {
        // Tab does not allow script injection; continue
      }
    }
  } catch (e) {
    console.debug('[ToolScribe Background] discoverSessionFromOpenTabs skipped:', e);
  }
  return null;
}

// Purge invalid/blocked/duplicate items from chrome.storage.local & clean up duplicate DB rows
async function purgeAndCleanupDatabase() {
  try {
    const syncCfg = await new Promise(r => chrome.storage.sync.get(['supabaseUrl', 'anonKey'], r));
    const supabaseUrl = (syncCfg.supabaseUrl && syncCfg.supabaseUrl.trim()) || DEFAULT_SUPABASE_URL;
    const anonKey = (syncCfg.anonKey && syncCfg.anonKey.trim()) || DEFAULT_ANON_KEY;

    const res = await new Promise(r =>
      chrome.storage.local.get(['cachedVaultDomains', 'ts_clipped_tools', 'ts_auth_session'], r)
    );

    const rawDomains = Array.isArray(res.cachedVaultDomains) ? res.cachedVaultDomains : [];
    const rawClips = Array.isArray(res.ts_clipped_tools) ? res.ts_clipped_tools : [];

    const cleanDomains = [...new Set(
      rawDomains
        .filter(d => typeof d === 'string' && !isBlockedToolUrl(`https://${d}`))
        .map(d => normalizeToolDomain(`https://${d}`))
        .filter(Boolean)
    )];

    const seenClipDomains = new Set();
    const cleanClips = [];
    for (const c of rawClips) {
      if (!c || !c.url || isBlockedToolUrl(c.url)) continue;
      if (c.id && KNOWN_JUNK_UUIDS.has(c.id)) continue;
      const dom = normalizeToolDomain(c.url);
      if (!dom || seenClipDomains.has(dom)) continue;
      seenClipDomains.add(dom);
      cleanClips.push(c);
    }

    await new Promise(r =>
      chrome.storage.local.set({
        cachedVaultDomains: cleanDomains,
        ts_clipped_tools: cleanClips
      }, r)
    );

    let session = await discoverSessionFromOpenTabs();
    if (!session && res.ts_auth_session?.access_token && res.ts_auth_session?.user_id) {
      session = res.ts_auth_session;
    }

    if (session && session.access_token && session.user_id) {
      const headers = {
        'apikey': anonKey,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      };

      const allRes = await fetch(
        `${supabaseUrl}/rest/v1/tools?select=id,name,url,added_by,created_at&order=created_at.asc`,
        { headers }
      );

      const idsToDelete = new Set(KNOWN_JUNK_UUIDS);
      const canonicalByDomain = new Map();

      if (allRes.ok) {
        const allTools = await allRes.json();
        if (Array.isArray(allTools)) {
          for (const row of allTools) {
            if (!row?.id) continue;
            if (KNOWN_JUNK_UUIDS.has(row.id) || isBlockedToolUrl(row.url)) {
              idsToDelete.add(row.id);
              continue;
            }
            const dom = normalizeToolDomain(row.url);
            if (!dom) {
              idsToDelete.add(row.id);
              continue;
            }
            if (canonicalByDomain.has(dom)) {
              idsToDelete.add(row.id);
            } else {
              canonicalByDomain.set(dom, row);
            }
          }
        }
      }

      if (idsToDelete.size > 0) {
        const idList = Array.from(idsToDelete).join(',');
        await fetch(`${supabaseUrl}/rest/v1/vault_items?tool_id=in.(${idList})`, {
          method: 'DELETE',
          headers
        }).catch(() => {});

        await fetch(`${supabaseUrl}/rest/v1/tools?id=in.(${idList})`, {
          method: 'DELETE',
          headers
        }).catch(() => {});
      }
    }

    // Broadcast cleaned clips to open ToolScribe web app tabs
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (!t.id || !t.url) continue;
      if (
        t.url.includes('localhost') ||
        t.url.includes('127.0.0.1') ||
        t.url.includes('tool-scribes') ||
        t.url.includes('toolscribes')
      ) {
        chrome.tabs.sendMessage(t.id, { type: 'TS_CLIP_UPDATED', clips: cleanClips }).catch(() => {});
      }
    }
  } catch (err) {
    console.debug('[ToolScribe Background] purgeAndCleanupDatabase error:', err);
  }
}

purgeAndCleanupDatabase();

// Listen for tab updates (Passive Dust Collector Tracker + Cleanup Trigger)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  if (
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('chrome-extension://') ||
    tab.url.startsWith('edge://') ||
    tab.url.startsWith('about:') ||
    tab.url.startsWith('brave://')
  ) {
    return;
  }

  if (
    tab.url.includes('tool-scribes.vercel.app') ||
    tab.url.includes('tool-scribes-beta.vercel.app') ||
    tab.url.includes('localhost:8080') ||
    tab.url.includes('localhost:5173')
  ) {
    purgeAndCleanupDatabase();
    return;
  }

  if (isBlockedToolUrl(tab.url)) return;

  const hostname = normalizeToolDomain(tab.url);
  if (!hostname) return;

  chrome.storage.local.get(['cachedVaultDomains', `visit_${hostname}`], async (res) => {
    const domains = res.cachedVaultDomains || [];
    const isSavedTool = domains.some(d => d === hostname);

    if (!isSavedTool) return;

    const lastVisit = res[`visit_${hostname}`] || 0;
    const now = Date.now();

    if (now - lastVisit < TWENTY_FOUR_HOURS) {
      return;
    }

    const updates = {};
    updates[`visit_${hostname}`] = now;
    chrome.storage.local.set(updates);

    syncVisitToSupabase(hostname);
  });
});

// Sync visit to Supabase tool_visits / vault_items
async function syncVisitToSupabase(domain) {
  try {
    const stored = await chrome.storage.sync.get(['supabaseUrl', 'anonKey']);
    const supabaseUrl = stored.supabaseUrl || DEFAULT_SUPABASE_URL;
    const anonKey = stored.anonKey || DEFAULT_ANON_KEY;
    if (!supabaseUrl || !anonKey) return;

    await fetch(`${supabaseUrl}/rest/v1/rpc/record_tool_visit`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tool_domain: domain })
    }).catch(() => {});
  } catch (err) {
    console.debug('[ToolScribe Background] Visit sync skipped:', err);
  }
}

// Right click context menu integration (completely safely guarded)
try {
  if (typeof chrome !== 'undefined' && chrome?.contextMenus?.create) {
    chrome.runtime.onInstalled.addListener(() => {
      purgeAndCleanupDatabase();
      try {
        chrome.contextMenus.create({
          id: "toolscribe-clip-page",
          title: "Save page to ToolScribe Vault",
          contexts: ["page", "link"]
        }, () => {
          if (chrome.runtime.lastError) {
            // Ignore duplicate menu error
          }
        });
      } catch (e) {
        console.debug('Context menu init skipped:', e);
      }
    });

    if (chrome?.contextMenus?.onClicked?.addListener) {
      chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === "toolscribe-clip-page" && tab?.id) {
          try {
            if (chrome.action?.openPopup) {
              chrome.action.openPopup().catch(() => {});
            }
          } catch {}
        }
      });
    }
  }
} catch (e) {
  console.debug('Context menu setup skipped:', e);
}
