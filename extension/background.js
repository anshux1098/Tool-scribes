// ToolScribe Background Service Worker (Manifest V3)

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

// Listen for tab updates (Passive Dust Collector Tracker)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  // Ignore internal/browser urls
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
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
    const { supabaseUrl, anonKey } = await chrome.storage.sync.get(['supabaseUrl', 'anonKey']);
    if (!supabaseUrl || !anonKey) return;

    // Ping Supabase Edge Function or REST endpoint to record active tool visit
    await fetch(`${supabaseUrl}/rest/v1/rpc/record_tool_visit`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tool_domain: domain })
    }).catch(() => {
      // Endpoint may be custom or offline, quiet fallback
    });
  } catch (err) {
    console.debug('[ToolScribe Background] Visit sync skipped:', err);
  }
}

// Right click context menu integration (safely guarded)
if (typeof chrome !== 'undefined' && chrome.contextMenus) {
  chrome.runtime.onInstalled.addListener(() => {
    try {
      chrome.contextMenus.create({
        id: "toolscribe-clip-page",
        title: "Save page to ToolScribe Vault",
        contexts: ["page", "link"]
      });
    } catch (e) {
      console.debug('Context menu init:', e);
    }
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "toolscribe-clip-page" && tab?.id) {
      if (chrome.action && chrome.action.openPopup) {
        chrome.action.openPopup().catch(() => {});
      }
    }
  });
}
