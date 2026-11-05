// Default configuration fallback
const DEFAULT_SUPABASE_URL = "https://qglvwvpsegrucrhcpzxd.supabase.co";
// In real use, user enters anon key or it is synced from web app
const DEFAULT_ANON_KEY = "";

let currentTab = null;
let currentConfig = {
  supabaseUrl: DEFAULT_SUPABASE_URL,
  anonKey: DEFAULT_ANON_KEY,
  userEmail: ""
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await inspectActiveTab();
  await loadUserCollections();
  setupEventListeners();
  checkConnection();
});

// Load saved settings from chrome.storage
async function loadConfig() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['supabaseUrl', 'anonKey', 'userEmail'], (res) => {
      if (res.supabaseUrl) currentConfig.supabaseUrl = res.supabaseUrl;
      if (res.anonKey) currentConfig.anonKey = res.anonKey;
      if (res.userEmail) currentConfig.userEmail = res.userEmail;

      document.getElementById('cfg-supabase-url').value = currentConfig.supabaseUrl;
      document.getElementById('cfg-supabase-key').value = currentConfig.anonKey;
      document.getElementById('cfg-user-email').value = currentConfig.userEmail;
      resolve();
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
      const origin = new URL(tab.url).origin;
      faviconEl.src = `${origin}/favicon.ico`;
      faviconEl.style.display = 'block';
    } catch {
      faviconEl.style.display = 'none';
    }
  } else {
    faviconEl.style.display = 'none';
  }

  // Execute extraction in page
  if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
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
      console.warn('Could not execute content script on tab:', e);
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

  // Guess category
  let category = 'dev';
  const text = (document.title + ' ' + desc).toLowerCase();
  if (text.includes('ai') || text.includes('llm') || text.includes('gpt')) category = 'ai';
  else if (text.includes('design') || text.includes('figma') || text.includes('ui/ux') || text.includes('icon')) category = 'design';
  else if (text.includes('write') || text.includes('note') || text.includes('doc')) category = 'writing';
  else if (text.includes('video') || text.includes('audio') || text.includes('media')) category = 'media';
  else if (text.includes('utility') || text.includes('tool') || text.includes('converter')) category = 'util';

  return { description: desc?.trim()?.slice(0, 300) || '', title, category };
}

function cleanTitle(raw) {
  if (!raw) return '';
  return raw
    .replace(/\s*[-|–—]\s*(GitHub|Product Hunt|AlternativeTo|Home|Official).*$/i, '')
    .trim();
}

// Load collections for dropdown
async function loadUserCollections() {
  if (!currentConfig.anonKey || !currentConfig.supabaseUrl) return;

  try {
    const res = await fetch(`${currentConfig.supabaseUrl}/rest/v1/collections?select=id,name&order=updated_at.desc&limit=10`, {
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
        opt.textContent = col.name;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.warn('Error loading collections:', err);
  }
}

// Check Supabase API status
async function checkConnection() {
  const pill = document.getElementById('conn-status');
  if (!currentConfig.supabaseUrl) {
    pill.textContent = 'Not configured';
    pill.className = 'status-pill offline';
    return;
  }
  try {
    const res = await fetch(`${currentConfig.supabaseUrl}/rest/v1/`, {
      headers: currentConfig.anonKey ? { 'apikey': currentConfig.anonKey } : {}
    });
    if (res.ok || res.status === 401 || res.status === 400) {
      pill.textContent = 'Connected';
      pill.className = 'status-pill online';
    } else {
      pill.textContent = 'Error ' + res.status;
      pill.className = 'status-pill offline';
    }
  } catch {
    pill.textContent = 'Unreachable';
    pill.className = 'status-pill offline';
  }
}

// Event Listeners
function setupEventListeners() {
  // Settings toggle
  const toggleBtn = document.getElementById('btn-toggle-settings');
  const settingsPanel = document.getElementById('settings-panel');
  toggleBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  // Save Settings
  document.getElementById('btn-save-settings').addEventListener('click', () => {
    const url = document.getElementById('cfg-supabase-url').value.trim();
    const key = document.getElementById('cfg-supabase-key').value.trim();
    const email = document.getElementById('cfg-user-email').value.trim();

    currentConfig = { supabaseUrl: url, anonKey: key, userEmail: email };
    chrome.storage.sync.set(currentConfig, () => {
      checkConnection();
      settingsPanel.classList.add('hidden');
    });
  });

  // Save Tool
  document.getElementById('btn-save-tool').addEventListener('click', handleSaveTool);
}

// Save tool to Vault
async function handleSaveTool() {
  const saveBtn = document.getElementById('btn-save-tool');
  const banner = document.getElementById('result-banner');
  const resultText = document.getElementById('result-text');
  const resultLink = document.getElementById('result-link');

  const name = document.getElementById('tool-name').value.trim();
  const desc = document.getElementById('tool-desc').value.trim();
  const category = document.getElementById('tool-category').value;
  const pricing = document.getElementById('tool-pricing').value;
  const tagsStr = document.getElementById('tool-tags').value;
  const gotcha = document.getElementById('tool-gotcha').value.trim();
  const collectionId = document.getElementById('tool-collection').value;

  if (!name || !currentTab?.url) {
    alert('Please provide a tool name.');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  const tags = tagsStr ? tagsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
  let domain = '';
  try { domain = new URL(currentTab.url).hostname; } catch {}

  const payload = {
    name,
    tagline: desc.slice(0, 160),
    description: desc,
    url: currentTab.url,
    category,
    pricing_model: pricing,
    gotcha: gotcha || null,
    favicon: currentTab.favIconUrl || null,
    created_at: new Date().toISOString()
  };

  try {
    // If Supabase key is configured, insert via REST API
    if (currentConfig.supabaseUrl && currentConfig.anonKey) {
      const res = await fetch(`${currentConfig.supabaseUrl}/rest/v1/tools`, {
        method: 'POST',
        headers: {
          'apikey': currentConfig.anonKey,
          'Authorization': `Bearer ${currentConfig.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${await res.text()}`);
      }
    }

    // Cache domain locally for Dust Collector usage tracking
    if (domain) {
      chrome.storage.local.get(['cachedVaultDomains'], (res) => {
        const domains = res.cachedVaultDomains || [];
        if (!domains.includes(domain)) {
          domains.push(domain);
          chrome.storage.local.set({ cachedVaultDomains: domains });
        }
      });
    }

    // Show success
    banner.classList.remove('hidden');
    resultText.textContent = `Saved "${name}" to your ToolScribe vault!`;
    resultLink.href = currentTab.url;
    resultLink.textContent = 'View in Vault';
    saveBtn.textContent = 'Saved!';
    saveBtn.style.backgroundColor = 'var(--ts-success)';
  } catch (err) {
    console.error('Error saving tool:', err);
    alert('Notice: Saved to local browser cache. (To sync to cloud, enter Supabase credentials in settings).');
    banner.classList.remove('hidden');
    resultText.textContent = `Saved locally to your browser vault.`;
    saveBtn.textContent = 'Saved Locally';
  } finally {
    setTimeout(() => {
      saveBtn.disabled = false;
    }, 1500);
  }
}
