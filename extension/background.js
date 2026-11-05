// ToolScribe Background Service Worker (Manifest V3)

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const DEFAULT_SUPABASE_URL = "https://qglvwvpsegrucrhcpzxd.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_pN6EDmb7_lIo00Gtek36zw_QFU8sb3L";

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

// Upsert a single clip into public.tools and public.vault_items in Supabase
async function upsertClipToSupabase(clipEntry, session, supabaseUrl, anonKey) {
  const headers = {
    'apikey': anonKey,
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };

  let toolId = null;

  const existingRes = await fetch(
    `${supabaseUrl}/rest/v1/tools?url=eq.${encodeURIComponent(clipEntry.url)}&select=id,name,url&limit=1`,
    { headers }
  );
  if (existingRes.ok) {
    const existingRows = await existingRes.json();
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      toolId = existingRows[0].id;
    }
  }

  if (!toolId) {
    const dbPayload = {
      name: clipEntry.name,
      url: clipEntry.url,
      description: clipEntry.description || `${clipEntry.name} — clipped via ToolScribe Extension.`,
      category: ['ai', 'dev', 'design', 'prod', 'learn', 'util'].includes(clipEntry.category) ? clipEntry.category : 'util',
      icon: clipEntry.icon || '🔧',
      favicon: clipEntry.favicon || '',
      og_image: '',
      screenshot_url: '',
      price_model: ['free', 'freemium', 'paid'].includes(clipEntry.price_model) ? clipEntry.price_model : 'free',
      is_open_source: !!clipEntry.is_open_source,
      requires_login: false,
      is_free: clipEntry.is_free !== false,
      platforms: ['web'],
      signup_required: false,
      added_by: session.user_id
    };

    const toolRes = await fetch(`${supabaseUrl}/rest/v1/tools`, {
      method: 'POST',
      headers: {
        ...headers,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(dbPayload)
    });

    if (!toolRes.ok) {
      throw new Error(`tools insert failed (${toolRes.status})`);
    }

    const insertedRows = await toolRes.json();
    const toolRow = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;
    if (!toolRow || !toolRow.id) {
      throw new Error('tools insert returned no row id');
    }
    toolId = toolRow.id;
  }

  const vaultRes = await fetch(
    `${supabaseUrl}/rest/v1/vault_items?on_conflict=user_id,tool_id`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify({
        user_id: session.user_id,
        tool_id: toolId,
        is_favorite: false,
        notes: clipEntry.notes || '',
        tags: Array.isArray(clipEntry.tags) ? clipEntry.tags : []
      })
    }
  );

  if (!vaultRes.ok) {
    throw new Error(`vault_items upsert failed (${vaultRes.status})`);
  }

  return toolId;
}

// Backfill cachedVaultDomains into ts_clipped_tools AND sync all unsynced clips directly to Supabase DB
async function backfillAndSyncToSupabase() {
  try {
    const syncCfg = await new Promise(r => chrome.storage.sync.get(['supabaseUrl', 'anonKey'], r));
    const supabaseUrl = (syncCfg.supabaseUrl && syncCfg.supabaseUrl.trim()) || DEFAULT_SUPABASE_URL;
    const anonKey = (syncCfg.anonKey && syncCfg.anonKey.trim()) || DEFAULT_ANON_KEY;

    const res = await new Promise(r =>
      chrome.storage.local.get(['cachedVaultDomains', 'ts_clipped_tools', 'ts_auth_session'], r)
    );

    const domains = Array.isArray(res.cachedVaultDomains) ? res.cachedVaultDomains : [];
    const clips = Array.isArray(res.ts_clipped_tools) ? res.ts_clipped_tools : [];
    let changed = false;

    for (const rawDomain of domains) {
      if (!rawDomain || typeof rawDomain !== 'string') continue;
      const clean = rawDomain.replace(/^www\./i, '').toLowerCase();
      const exists = clips.some(c => {
        try {
          return new URL(c.url).hostname.replace(/^www\./i, '').toLowerCase() === clean;
        } catch {
          return false;
        }
      });

      if (!exists) {
        const baseName = clean.split('.')[0] || clean;
        const prettyName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
        clips.unshift({
          id: `ext-${clean}`,
          name: prettyName,
          url: `https://${rawDomain}`,
          description: `${prettyName} — saved to your personal Vault via the ToolScribe Browser Extension.`,
          category: 'util',
          icon: '🔧',
          favicon: `https://www.google.com/s2/favicons?domain=${clean}&sz=64`,
          price_model: 'free',
          is_open_source: false,
          is_free: true,
          notes: '',
          tags: ['extension-clip'],
          created_at: new Date().toISOString(),
          syncedToCloud: false
        });
        changed = true;
      }
    }

    // Discover session from open tabs or local storage
    let session = await discoverSessionFromOpenTabs();
    if (!session && res.ts_auth_session?.access_token && res.ts_auth_session?.user_id) {
      session = res.ts_auth_session;
    }

    let syncedToDbCount = 0;
    if (session && session.access_token && session.user_id) {
      for (const clip of clips) {
        if (!clip.syncedToCloud) {
          try {
            const toolId = await upsertClipToSupabase(clip, session, supabaseUrl, anonKey);
            if (toolId) {
              clip.id = toolId;
              clip.syncedToCloud = true;
              changed = true;
              syncedToDbCount++;
            }
          } catch (e) {
            console.debug('[ToolScribe Background] Sync skipped for', clip.name, e);
          }
        }
      }
    }

    if (changed) {
      await new Promise(r => chrome.storage.local.set({ ts_clipped_tools: clips }, r));
    }

    // Broadcast to any open ToolScribe web app tabs (and reload them if new DB rows were inserted)
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (!t.id || !t.url) continue;
      if (
        t.url.includes('localhost') ||
        t.url.includes('127.0.0.1') ||
        t.url.includes('tool-scribes') ||
        t.url.includes('toolscribes')
      ) {
        chrome.tabs.sendMessage(t.id, { type: 'TS_CLIP_UPDATED', clips }).catch(() => {});
        if (syncedToDbCount > 0) {
          chrome.tabs.reload(t.id).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.debug('[ToolScribe Background] backfillAndSyncToSupabase error:', err);
  }
}

backfillAndSyncToSupabase();

// Listen for tab updates (Passive Dust Collector Tracker + Session Discovery)
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

  // If the user opened or refreshed the ToolScribe website, sync any pending clips immediately
  if (
    tab.url.includes('tool-scribes.vercel.app') ||
    tab.url.includes('localhost:8080') ||
    tab.url.includes('localhost:5173')
  ) {
    backfillAndSyncToSupabase();
  }

  let hostname = '';
  try {
    hostname = new URL(tab.url).hostname.replace(/^www\./, '');
  } catch {
    return;
  }

  if (!hostname) return;

  chrome.storage.local.get(['cachedVaultDomains', `visit_${hostname}`], async (res) => {
    const domains = res.cachedVaultDomains || [];
    const isSavedTool = domains.some(d => d.includes(hostname) || hostname.includes(d));

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
      backfillAndSyncToSupabase();
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
