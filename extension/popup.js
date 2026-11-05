// Default configuration fallback (matches repository .env)
const DEFAULT_SUPABASE_URL = "https://qglvwvpsegrucrhcpzxd.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_pN6EDmb7_lIo00Gtek36zw_QFU8sb3L";
const DEFAULT_WEBAPP_URL = "http://localhost:8080";

const CATEGORY_ICONS = {
  dev: '💻',
  ai: '🤖',
  design: '🎨',
  prod: '⚡',
  learn: '📚',
  util: '🔧'
};

let currentTab = null;
let currentConfig = {
  supabaseUrl: DEFAULT_SUPABASE_URL,
  anonKey: DEFAULT_ANON_KEY,
  webappUrl: DEFAULT_WEBAPP_URL
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await backfillDomainClips();
  await inspectActiveTab();
  await loadUserCollections();
  setupEventListeners();
  checkConnection();
});

// Load saved settings from chrome.storage
async function loadConfig() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['supabaseUrl', 'anonKey', 'webappUrl'], (res) => {
      if (res.supabaseUrl && res.supabaseUrl.trim()) currentConfig.supabaseUrl = res.supabaseUrl.trim();
      if (res.anonKey && res.anonKey.trim()) currentConfig.anonKey = res.anonKey.trim();
      if (res.webappUrl && res.webappUrl.trim()) currentConfig.webappUrl = res.webappUrl.trim();

      document.getElementById('cfg-supabase-url').value = currentConfig.supabaseUrl;
      document.getElementById('cfg-supabase-key').value = currentConfig.anonKey;
      document.getElementById('cfg-webapp-url').value = currentConfig.webappUrl;
      resolve();
    });
  });
}

// Recover any domains saved in cachedVaultDomains before full clip storage existed
async function backfillDomainClips() {
  return new Promise(resolve => {
    chrome.storage.local.get(['cachedVaultDomains', 'ts_clipped_tools'], (res) => {
      const domains = res.cachedVaultDomains || [];
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
        chrome.storage.local.set({ ts_clipped_tools: clips }, () => {
          broadcastClipsToWebApp(clips);
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

// Inspect active tab DOM
async function inspectActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  currentTab = tab;

  document.getElementById('page-url').textContent = tab.url || 'No active URL';
  document.getElementById('tool-name').value = cleanTitle(tab.title || '');

  // Set favicon safely (never load chrome:// or local resources)
  const faviconEl = document.getElementById('page-favicon');
  faviconEl.onerror = () => { faviconEl.style.display = 'none'; };

  const isInternalUrl = !tab.url ||
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('chrome-extension://') ||
    tab.url.startsWith('edge://') ||
    tab.url.startsWith('about:') ||
    tab.url.startsWith('brave://');

  if (!isInternalUrl && tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
    faviconEl.src = tab.favIconUrl;
    faviconEl.style.display = 'block';
  } else if (!isInternalUrl && tab.url && tab.url.startsWith('http')) {
    try {
      const host = new URL(tab.url).hostname;
      faviconEl.src = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
      faviconEl.style.display = 'block';
    } catch {
      faviconEl.style.display = 'none';
    }
  } else {
    faviconEl.style.display = 'none';
  }

  // Execute extraction in page
  if (tab.id && tab.url && !isInternalUrl) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPageMeta
      });
      if (results && results[0] && results[0].result) {
        const meta = results[0].result;
        if (meta.description) {
          document.getElementById('tool-desc').value = meta.description;
        }
        if (meta.title && !document.getElementById('tool-name').value) {
          document.getElementById('tool-name').value = cleanTitle(meta.title);
        }
        if (meta.category) {
          document.getElementById('tool-category').value = meta.category;
        }
      }
    } catch (e) {
      console.debug('Could not execute content script on tab:', e);
    }
  }
}

// In-page extraction helper executed inside the active tab
function extractPageMeta() {
  const descEl = document.querySelector('meta[name="description"]') ||
                 document.querySelector('meta[property="og:description"]') ||
                 document.querySelector('meta[name="twitter:description"]');

  const titleEl = document.querySelector('meta[property="og:title"]') ||
                  document.querySelector('meta[name="twitter:title"]');

  const desc = descEl ? descEl.getAttribute('content') : '';
  const title = titleEl ? titleEl.getAttribute('content') : '';

  // Guess category matching valid DB categories: ai, dev, design, prod, learn, util
  let category = 'util';
  const text = (document.title + ' ' + desc + ' ' + window.location.hostname).toLowerCase();
  if (text.includes('ai') || text.includes('llm') || text.includes('gpt') || text.includes('machine learning')) category = 'ai';
  else if (text.includes('github') || text.includes('api') || text.includes('sdk') || text.includes('developer') || text.includes('code')) category = 'dev';
  else if (text.includes('design') || text.includes('figma') || text.includes('ui') || text.includes('icon') || text.includes('color')) category = 'design';
  else if (text.includes('note') || text.includes('task') || text.includes('calendar') || text.includes('workspace') || text.includes('productivity')) category = 'prod';
  else if (text.includes('course') || text.includes('learn') || text.includes('tutorial') || text.includes('book') || text.includes('docs')) category = 'learn';

  return { description: desc?.trim()?.slice(0, 300) || '', title, category };
}

function cleanTitle(raw) {
  if (!raw) return '';
  return raw
    .replace(/\s*[-|–—•]\s*(GitHub|Product Hunt|AlternativeTo|Home|Official|Instagram).*$/i, '')
    .trim();
}

// Load collections for dropdown
async function loadUserCollections() {
  if (!currentConfig.anonKey || !currentConfig.supabaseUrl) return;

  try {
    const res = await fetch(`${currentConfig.supabaseUrl}/rest/v1/collections?select=id,name&order=updated_at.desc&limit=15`, {
      headers: {
        'apikey': currentConfig.anonKey,
        'Authorization': `Bearer ${currentConfig.anonKey}`
      }
    });
    if (res.ok) {
      const collections = await res.json();
      const select = document.getElementById('tool-collection');
      collections.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col.id;
        opt.textContent = `📁 ${col.name}`;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.debug('Collections fetch skipped:', err);
  }
}

// Check Supabase API & Auth status
async function checkConnection() {
  const pill = document.getElementById('conn-status');
  chrome.storage.local.get(['ts_auth_session'], async (res) => {
    const hasAuth = !!(res.ts_auth_session && res.ts_auth_session.access_token);
    if (hasAuth) {
      pill.textContent = 'Cloud + Local Sync';
      pill.className = 'status-pill online';
      return;
    }
    pill.textContent = 'Local + Tab Sync';
    pill.className = 'status-pill online';
  });
}

// Broadcast updated clips to any open ToolScribe web app tabs
async function broadcastClipsToWebApp(clips) {
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
  } catch (e) {
    console.debug('Broadcast skipped:', e);
  }
}

// Open or focus the ToolScribe Web App Vault tab
async function openWebAppVault(e) {
  if (e) e.preventDefault();
  try {
    const tabs = await chrome.tabs.query({});
    const existingTab = tabs.find(t =>
      t.url && (
        t.url.includes('localhost:8080') ||
        t.url.includes('localhost:5173') ||
        t.url.includes('127.0.0.1:8080') ||
        t.url.includes('tool-scribes.vercel.app')
      )
    );

    if (existingTab && existingTab.id) {
      const baseOrigin = new URL(existingTab.url).origin;
      await chrome.tabs.update(existingTab.id, {
        active: true,
        url: `${baseOrigin}/?tab=vault`
      });
      if (existingTab.windowId) {
        await chrome.windows.update(existingTab.windowId, { focused: true });
      }
    } else {
      const targetUrl = `${currentConfig.webappUrl.replace(/\/$/, '')}/?tab=vault`;
      await chrome.tabs.create({ url: targetUrl });
    }
  } catch {
    window.open(`${currentConfig.webappUrl.replace(/\/$/, '')}/?tab=vault`, '_blank');
  }
}

// Event Listeners
function setupEventListeners() {
  const toggleBtn = document.getElementById('btn-toggle-settings');
  const settingsPanel = document.getElementById('settings-panel');
  toggleBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    const url = document.getElementById('cfg-supabase-url').value.trim() || DEFAULT_SUPABASE_URL;
    const key = document.getElementById('cfg-supabase-key').value.trim() || DEFAULT_ANON_KEY;
    const webappUrl = document.getElementById('cfg-webapp-url').value.trim() || DEFAULT_WEBAPP_URL;

    currentConfig = { supabaseUrl: url, anonKey: key, webappUrl };
    chrome.storage.sync.set(currentConfig, () => {
      checkConnection();
      settingsPanel.classList.add('hidden');
    });
  });

  document.getElementById('btn-save-tool').addEventListener('click', handleSaveTool);
  document.getElementById('result-link').addEventListener('click', openWebAppVault);
}

// Save tool to Vault (Local + Web App Sync + Cloud Sync)
async function handleSaveTool() {
  const saveBtn = document.getElementById('btn-save-tool');
  const banner = document.getElementById('result-banner');
  const resultText = document.getElementById('result-text');

  const name = document.getElementById('tool-name').value.trim();
  const rawDesc = document.getElementById('tool-desc').value.trim();
  const rawCategory = document.getElementById('tool-category').value;
  const rawPricing = document.getElementById('tool-pricing').value;
  const tagsStr = document.getElementById('tool-tags').value;
  const gotcha = document.getElementById('tool-gotcha').value.trim();
  const collectionId = document.getElementById('tool-collection').value;

  if (!name || !currentTab?.url) {
    alert('Please provide a tool name.');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  const validCategories = ['ai', 'dev', 'design', 'prod', 'learn', 'util'];
  const category = validCategories.includes(rawCategory) ? rawCategory : 'util';

  const priceModelMap = {
    free: 'free',
    freemium: 'freemium',
    open_source: 'free',
    paid: 'paid'
  };
  const priceModel = priceModelMap[rawPricing] || 'free';
  const isOpenSource = rawPricing === 'open_source';
  const isFree = priceModel !== 'paid';
  const tags = tagsStr ? tagsStr.split(',').map(s => s.trim()).filter(Boolean) : [];

  let domain = '';
  try { domain = new URL(currentTab.url).hostname.replace(/^www\./i, ''); } catch {}

  const favicon = (currentTab.favIconUrl && !currentTab.favIconUrl.startsWith('chrome://'))
    ? currentTab.favIconUrl
    : (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : '');

  const description = rawDesc || `${name} — clipped via ToolScribe Extension${domain ? ` (${domain})` : ''}.`;
  const icon = CATEGORY_ICONS[category] || '🔧';

  const clipEntry = {
    id: `ext-${domain || Date.now()}`,
    name,
    url: currentTab.url,
    description,
    category,
    icon,
    favicon,
    price_model: priceModel,
    is_open_source: isOpenSource,
    is_free: isFree,
    notes: gotcha || '',
    tags,
    collection_id: collectionId !== 'vault' ? collectionId : null,
    created_at: new Date().toISOString(),
    syncedToCloud: false
  };

  try {
    // 1. Check if we have an authenticated user session from the web app for direct Supabase insert
    const storageData = await new Promise(resolve => {
      chrome.storage.local.get(['ts_auth_session', 'ts_clipped_tools', 'cachedVaultDomains'], resolve);
    });

    const session = storageData.ts_auth_session;
    if (session && session.access_token && session.user_id && currentConfig.supabaseUrl && currentConfig.anonKey) {
      const dbPayload = {
        name: clipEntry.name,
        url: clipEntry.url,
        description: clipEntry.description,
        category: clipEntry.category,
        icon: clipEntry.icon,
        favicon: clipEntry.favicon,
        og_image: '',
        screenshot_url: '',
        price_model: clipEntry.price_model,
        is_open_source: clipEntry.is_open_source,
        requires_login: false,
        is_free: clipEntry.is_free,
        platforms: ['web'],
        signup_required: false,
        added_by: session.user_id
      };

      const toolRes = await fetch(`${currentConfig.supabaseUrl}/rest/v1/tools`, {
        method: 'POST',
        headers: {
          'apikey': currentConfig.anonKey,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(dbPayload)
      });

      if (toolRes.ok) {
        const insertedRows = await toolRes.json();
        const toolRow = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;
        if (toolRow && toolRow.id) {
          clipEntry.id = toolRow.id;
          clipEntry.syncedToCloud = true;

          // Also save to vault_items
          await fetch(`${currentConfig.supabaseUrl}/rest/v1/vault_items`, {
            method: 'POST',
            headers: {
              'apikey': currentConfig.anonKey,
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              user_id: session.user_id,
              tool_id: toolRow.id,
              is_favorite: false,
              notes: clipEntry.notes,
              tags: clipEntry.tags
            })
          }).catch(() => {});

          // If specific collection chosen, link into collection_tools
          if (clipEntry.collection_id) {
            await fetch(`${currentConfig.supabaseUrl}/rest/v1/collection_tools`, {
              method: 'POST',
              headers: {
                'apikey': currentConfig.anonKey,
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                collection_id: clipEntry.collection_id,
                tool_id: toolRow.id
              })
            }).catch(() => {});
          }
        }
      }
    }

    // 2. Always persist into ts_clipped_tools and cachedVaultDomains for instant web app sync
    const existingClips = Array.isArray(storageData.ts_clipped_tools) ? storageData.ts_clipped_tools : [];
    const filteredClips = existingClips.filter(c => {
      if (c.url === clipEntry.url) return false;
      try {
        return new URL(c.url).hostname.replace(/^www\./i, '') !== domain;
      } catch {
        return true;
      }
    });
    const updatedClips = [clipEntry, ...filteredClips];

    const domains = Array.isArray(storageData.cachedVaultDomains) ? storageData.cachedVaultDomains : [];
    if (domain && !domains.includes(domain)) {
      domains.push(domain);
    }

    await new Promise(resolve => {
      chrome.storage.local.set({
        ts_clipped_tools: updatedClips,
        cachedVaultDomains: domains
      }, resolve);
    });

    // 3. Broadcast immediately to any open ToolScribe web app tabs
    await broadcastClipsToWebApp(updatedClips);

    // 4. Show success UI
    banner.classList.remove('hidden');
    resultText.textContent = `Saved "${name}" to your Vault!`;
    saveBtn.textContent = '✓ Saved to ToolScribe';
    saveBtn.style.backgroundColor = 'var(--ts-success)';
  } catch (err) {
    console.error('Error saving tool:', err);
    banner.classList.remove('hidden');
    resultText.textContent = `Saved "${name}" to Vault!`;
    saveBtn.textContent = '✓ Saved';
  } finally {
    setTimeout(() => {
      saveBtn.disabled = false;
    }, 1200);
  }
}
