// ToolScribe Background Service Worker (Manifest V3)

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const DEFAULT_SUPABASE_URL = "https://qglvwvpsegrucrhcpzxd.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_pN6EDmb7_lIo00Gtek36zw_QFU8sb3L";

// Backfill any domains in cachedVaultDomains into full ts_clipped_tools entries immediately on worker boot
function backfillAndBroadcast() {
  chrome.storage.local.get(['cachedVaultDomains', 'ts_clipped_tools'], async (res) => {
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

    if (changed) {
      chrome.storage.local.set({ ts_clipped_tools: clips });
    }

    // Broadcast to any open ToolScribe web app tabs
    try {
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
        }
      }
    } catch {}
  });
}

backfillAndBroadcast();

// Listen for tab updates (Passive Dust Collector Tracker)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  // Ignore internal/browser urls
  if (
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('chrome-extension://') ||
    tab.url.startsWith('edge://') ||
    tab.url.startsWith('about:') ||
    tab.url.startsWith('brave://')
  ) {
    return;
  }

  let hostname = '';
  try {
    hostname = new URL(tab.url).hostname.replace(/^www\./, '');
  } catch {
    return;
  }

  if (!hostname) return;

  // Check if hostname matches any tool saved in the user's Vault
  chrome.storage.local.get(['cachedVaultDomains', `visit_${hostname}`], async (res) => {
    const domains = res.cachedVaultDomains || [];
    const isSavedTool = domains.some(d => d.includes(hostname) || hostname.includes(d));

    if (!isSavedTool) return;

    const lastVisit = res[`visit_${hostname}`] || 0;
    const now = Date.now();

    // Debounce to at most once every 24 hours per tool
    if (now - lastVisit < TWENTY_FOUR_HOURS) {
      return;
    }

    console.log(`[ToolScribe Background] Tool usage logged for: ${hostname}`);

    // Update local visit timestamp
    const updates = {};
    updates[`visit_${hostname}`] = now;
    chrome.storage.local.set(updates);

    // Sync visit timestamp to Supabase if configured
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
      backfillAndBroadcast();
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
