// Default configuration fallback (matches repository .env)
const DEFAULT_SUPABASE_URL = "https://qglvwvpsegrucrhcpzxd.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_pN6EDmb7_lIo00Gtek36zw_QFU8sb3L";
const DEFAULT_WEBAPP_URL = "https://tool-scribes-p9lk.vercel.app";

const CATEGORY_ICONS = {
  dev: '💻',
  ai: '🤖',
  design: '🎨',
  prod: '⚡',
  learn: '📚',
  util: '🔧'
};

// Known accidental backfilled / duplicate tool UUIDs to purge from DB & storage
const KNOWN_JUNK_UUIDS = new Set([
  '625c0544-9a1d-4e11-b502-e141fb5de15e', // Extensions
  'c631023c-889c-4eba-bf2b-4cd70c55828e', // Tool-scribes-beta
  'c01cb956-4193-4599-9317-35287739ffed', // Duplicate Python Certification | freeCodeCamp.org
  'cae4992f-18b9-4508-86bf-07f72d0e1e0a', // Duplicate Oracle MyLearn
  'dd1025f4-2461-459a-baa4-9fe8494404f1', // Localhost #1
  '7bf33712-9d2e-470c-8e4b-d813cb86656d'  // Localhost #2
]);

let currentTab = null;
let isSavingInFlight = false;
let activeTabBlockedReason = null;
let activeTabExistingTool = null;

let currentConfig = {
  supabaseUrl: DEFAULT_SUPABASE_URL,
  anonKey: DEFAULT_ANON_KEY,
  webappUrl: DEFAULT_WEBAPP_URL
};

// Extract clean normalized domain (e.g. "freecodecamp.org", "mylearn.oracle.com")
function normalizeToolDomain(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
  }
}

// Strict blocklist for internal browser pages, localhost, and ToolScribe's own domains
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

// Check if any tool with the same normalized domain already exists in Supabase public.tools
async function findExistingToolByDomain(url) {
  const domain = normalizeToolDomain(url);
  if (!domain) return null;

  try {
    const res = await fetch(
      `${currentConfig.supabaseUrl}/rest/v1/tools?url=ilike.*${encodeURIComponent(domain)}*&select=id,name,url,created_at&order=created_at.asc`,
      {
        headers: {
          'apikey': currentConfig.anonKey,
          'Authorization': `Bearer ${currentConfig.anonKey}`
        }
      }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;

    for (const row of rows) {
      if (!row || !row.id || KNOWN_JUNK_UUIDS.has(row.id)) continue;
      if (normalizeToolDomain(row.url) === domain) {
        return row;
      }
    }
  } catch (e) {
    console.debug('findExistingToolByDomain failed:', e);
  }
  return null;
}

// Purge invalid/blocked/duplicate items from chrome.storage.local
async function purgeInvalidClipsFromStorage() {
  return new Promise(resolve => {
    chrome.storage.local.get(['cachedVaultDomains', 'ts_clipped_tools'], (res) => {
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

      chrome.storage.local.set({
        cachedVaultDomains: cleanDomains,
        ts_clipped_tools: cleanClips
      }, () => resolve(cleanClips));
    });
  });
}

// Delete known junk/duplicate rows & any duplicate domains owned by the user in Supabase
async function cleanupDatabaseDuplicates(session) {
  if (!session?.access_token || !session?.user_id) return;

  const headers = {
    'apikey': currentConfig.anonKey,
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Fetch all tools ordered oldest-first so the original entry for each domain is preserved
    const allRes = await fetch(
      `${currentConfig.supabaseUrl}/rest/v1/tools?select=id,name,url,added_by,created_at&order=created_at.asc`,
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
            // Newer duplicate of an existing domain!
            idsToDelete.add(row.id);
          } else {
            canonicalByDomain.set(dom, row);
          }
        }
      }
    }

    // Ensure Free Code Camp canonical row is in the user's vault if they clipped the Python subpage
    const freeCodeCampCanon = canonicalByDomain.get('freecodecamp.org');
    if (freeCodeCampCanon?.id) {
      await fetch(`${currentConfig.supabaseUrl}/rest/v1/vault_items?on_conflict=user_id,tool_id`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
          user_id: session.user_id,
          tool_id: freeCodeCampCanon.id,
          is_favorite: false
        })
      }).catch(() => {});
    }

    if (idsToDelete.size > 0) {
      const idList = Array.from(idsToDelete).join(',');
      await fetch(`${currentConfig.supabaseUrl}/rest/v1/vault_items?tool_id=in.(${idList})`, {
        method: 'DELETE',
        headers
      }).catch(() => {});

      await fetch(`${currentConfig.supabaseUrl}/rest/v1/tools?id=in.(${idList})`, {
        method: 'DELETE',
        headers
      }).catch(() => {});
    }
  } catch (e) {
    console.debug('cleanupDatabaseDuplicates skipped:', e);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  const cleanClips = await purgeInvalidClipsFromStorage();
  await inspectActiveTab();
  setupEventListeners();
  const session = await ensureValidSession();
  updateAuthUI(session);
  if (session) {
    await cleanupDatabaseDuplicates(session);
    await loadUserCollections(session);
    await broadcastClipsToWebApp(cleanClips, false);
  }
});

// Load saved settings from chrome.storage
async function loadConfig() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['supabaseUrl', 'anonKey', 'webappUrl'], (res) => {
      if (res.supabaseUrl && res.supabaseUrl.trim()) currentConfig.supabaseUrl = res.supabaseUrl.trim();
      if (res.anonKey && res.anonKey.trim()) currentConfig.anonKey = res.anonKey.trim();
      if (
        res.webappUrl &&
        res.webappUrl.trim() &&
        !res.webappUrl.includes('tool-scribes.vercel.app') &&
        !res.webappUrl.includes('tool-scribes-beta.vercel.app')
      ) {
        currentConfig.webappUrl = res.webappUrl.trim().replace(/\/$/, '');
      } else {
        currentConfig.webappUrl = DEFAULT_WEBAPP_URL;
        chrome.storage.sync.set({ webappUrl: DEFAULT_WEBAPP_URL });
      }

      document.getElementById('cfg-supabase-url').value = currentConfig.supabaseUrl;
      document.getElementById('cfg-supabase-key').value = currentConfig.anonKey;
      document.getElementById('cfg-webapp-url').value = currentConfig.webappUrl;
      resolve();
    });
  });
}

// Actively scan all open browser tabs for a Supabase auth session in localStorage
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
    console.debug('discoverSessionFromOpenTabs error:', e);
  }
  return null;
}

// Refresh access token using refresh_token
async function refreshSessionToken(session) {
  if (!session?.refresh_token) return null;
  try {
    const res = await fetch(`${currentConfig.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'apikey': currentConfig.anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.access_token && data.user?.id) {
      const updated = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || session.refresh_token,
        expires_at: data.expires_at || 0,
        user_id: data.user.id,
        user_email: data.user.email || session.user_email || ''
      };
      await new Promise(r => chrome.storage.local.set({ ts_auth_session: updated }, r));
      return updated;
    }
  } catch (e) {
    console.debug('refreshSessionToken failed:', e);
  }
  return null;
}

// Verify or obtain a valid authenticated Supabase session
async function ensureValidSession() {
  let session = await discoverSessionFromOpenTabs();

  if (!session) {
    const stored = await new Promise(r => chrome.storage.local.get(['ts_auth_session'], r));
    session = stored.ts_auth_session || null;
  }

  if (!session || !session.access_token || !session.user_id) {
    return null;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at < nowSec + 120 && session.refresh_token) {
    const refreshed = await refreshSessionToken(session);
    if (refreshed) session = refreshed;
  }

  try {
    const userRes = await fetch(`${currentConfig.supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': currentConfig.anonKey,
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      if (userData?.id) {
        session.user_id = userData.id;
        session.user_email = userData.email || session.user_email || '';
        return session;
      }
    } else if (userRes.status === 401 && session.refresh_token) {
      const refreshed = await refreshSessionToken(session);
      if (refreshed) return refreshed;
    }
  } catch {
    return session;
  }

  return null;
}

// Update header pill and inline login panel based on auth status
function updateAuthUI(session) {
  const pill = document.getElementById('conn-status');
  const authPanel = document.getElementById('auth-panel');
  if (session && session.access_token && session.user_id) {
    const label = session.user_email ? session.user_email.split('@')[0] : 'Connected';
    pill.textContent = `✓ DB: ${label}`;
    pill.className = 'status-pill online';
    authPanel.classList.add('hidden');
  } else {
    pill.textContent = 'Sign In Required';
    pill.className = 'status-pill offline';
    authPanel.classList.remove('hidden');
  }
}

// Inspect active tab DOM and immediately check for blocked URLs or existing DB tools
async function inspectActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  currentTab = tab;

  const saveBtn = document.getElementById('btn-save-tool');
  const banner = document.getElementById('result-banner');
  const resultText = document.getElementById('result-text');

  document.getElementById('page-url').textContent = tab.url || 'No active URL';
  document.getElementById('tool-name').value = cleanTitle(tab.title || '');

  const faviconEl = document.getElementById('page-favicon');
  faviconEl.onerror = () => { faviconEl.style.display = 'none'; };

  // 1. Check if URL is internal, localhost, or ToolScribe itself
  if (isBlockedToolUrl(tab.url)) {
    activeTabBlockedReason = 'Localhost, browser pages, and ToolScribe itself cannot be added as tools.';
    faviconEl.style.display = 'none';
    saveBtn.disabled = true;
    saveBtn.textContent = '🚫 Cannot Save Internal / ToolScribe Site';
    banner.classList.remove('hidden');
    resultText.textContent = activeTabBlockedReason;
    return;
  }

  const host = normalizeToolDomain(tab.url);
  if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
    faviconEl.src = tab.favIconUrl;
    faviconEl.style.display = 'block';
  } else if (host) {
    faviconEl.src = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
    faviconEl.style.display = 'block';
  } else {
    faviconEl.style.display = 'none';
  }

  // 2. Extract page metadata
  if (tab.id && tab.url) {
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

  // 3. Check if a tool with this domain is ALREADY in the Supabase database
  const existingTool = await findExistingToolByDomain(tab.url);
  if (existingTool) {
    activeTabExistingTool = existingTool;
    saveBtn.disabled = true;
    saveBtn.textContent = `✓ Already in Database (${existingTool.name})`;
    banner.classList.remove('hidden');
    resultText.textContent = `"${existingTool.name}" (${host}) is already in the ToolScribe database. Duplicate tools are not allowed.`;
  }
}

function extractPageMeta() {
  const descEl = document.querySelector('meta[name="description"]') ||
                 document.querySelector('meta[property="og:description"]') ||
                 document.querySelector('meta[name="twitter:description"]');

  const titleEl = document.querySelector('meta[property="og:title"]') ||
                  document.querySelector('meta[name="twitter:title"]');

  const desc = descEl ? descEl.getAttribute('content') : '';
  const title = titleEl ? titleEl.getAttribute('content') : '';

  let category = 'util';
  const text = (document.title + ' ' + desc + ' ' + window.location.hostname).toLowerCase();
  if (text.includes('ai') || text.includes('llm') || text.includes('gpt') || text.includes('machine learning')) category = 'ai';
  else if (text.includes('github') || text.includes('api') || text.includes('sdk') || text.includes('developer') || text.includes('code') || text.includes('cloud') || text.includes('database') || text.includes('oracle')) category = 'dev';
  else if (text.includes('design') || text.includes('figma') || text.includes('ui') || text.includes('icon') || text.includes('color')) category = 'design';
  else if (text.includes('note') || text.includes('task') || text.includes('calendar') || text.includes('workspace') || text.includes('productivity')) category = 'prod';
  else if (text.includes('course') || text.includes('learn') || text.includes('tutorial') || text.includes('book') || text.includes('docs')) category = 'learn';

  return { description: desc?.trim()?.slice(0, 300) || '', title, category };
}

function cleanTitle(raw) {
  if (!raw) return '';
  return raw
    .replace(/\s*[-|–—•]\s*(GitHub|Product Hunt|AlternativeTo|Home|Official|Instagram|Oracle).*$/i, '')
    .trim();
}

// Load user's collections for dropdown
async function loadUserCollections(session) {
  if (!currentConfig.anonKey || !currentConfig.supabaseUrl) return;
  const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${currentConfig.anonKey}`;
  const filter = session?.user_id ? `?user_id=eq.${session.user_id}&select=id,name&order=updated_at.desc` : `?select=id,name&order=updated_at.desc&limit=15`;

  try {
    const res = await fetch(`${currentConfig.supabaseUrl}/rest/v1/collections${filter}`, {
      headers: {
        'apikey': currentConfig.anonKey,
        'Authorization': authHeader
      }
    });
    if (res.ok) {
      const collections = await res.json();
      const select = document.getElementById('tool-collection');
      select.innerHTML = '<option value="vault">Personal Vault + Discover</option>';
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

// Broadcast updated clips & reload open ToolScribe tabs so DB changes show immediately
async function broadcastClipsToWebApp(clips, reloadWebApp = false) {
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
        if (reloadWebApp) {
          chrome.tabs.reload(t.id).catch(() => {});
        }
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
        t.url.includes('tool-scribes-p9lk.vercel.app') ||
        t.url.includes('tool-scribes.vercel.app') ||
        t.url.includes('tool-scribes-beta.vercel.app') ||
        t.url.includes('localhost:8080') ||
        t.url.includes('localhost:5173') ||
        t.url.includes('127.0.0.1:8080')
      )
    );

    if (existingTab && existingTab.id) {
      await chrome.tabs.reload(existingTab.id);
      await chrome.tabs.update(existingTab.id, { active: true });
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

// Handle direct email/password sign-in inside the popup
async function handleInlineLogin() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');
  const loginBtn = document.getElementById('btn-login');

  if (!email || !password) {
    errEl.textContent = 'Please enter both email and password.';
    errEl.classList.remove('hidden');
    return;
  }

  errEl.classList.add('hidden');
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';

  try {
    const res = await fetch(`${currentConfig.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': currentConfig.anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok || !data.access_token || !data.user?.id) {
      throw new Error(data.error_description || data.msg || 'Invalid login credentials');
    }

    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || '',
      expires_at: data.expires_at || 0,
      user_id: data.user.id,
      user_email: data.user.email || email
    };

    await new Promise(r => chrome.storage.local.set({ ts_auth_session: session }, r));
    updateAuthUI(session);
    await cleanupDatabaseDuplicates(session);
    await loadUserCollections(session);
  } catch (err) {
    errEl.textContent = err.message || 'Sign in failed';
    errEl.classList.remove('hidden');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
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
    chrome.storage.sync.set(currentConfig, async () => {
      const s = await ensureValidSession();
      updateAuthUI(s);
      settingsPanel.classList.add('hidden');
    });
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    chrome.storage.local.remove(['ts_auth_session'], () => {
      updateAuthUI(null);
      settingsPanel.classList.add('hidden');
    });
  });

  const connectBtn = document.getElementById('btn-connect-webapp');
  if (connectBtn) {
    connectBtn.addEventListener('click', openWebAppVault);
  }
  document.getElementById('btn-login').addEventListener('click', handleInlineLogin);
  document.getElementById('btn-save-tool').addEventListener('click', handleSaveTool);
  document.getElementById('result-link').addEventListener('click', openWebAppVault);
}

// Save tool to Vault (Strict Domain Deduplication + Direct Supabase Insert)
async function handleSaveTool() {
  if (isSavingInFlight) return;

  const saveBtn = document.getElementById('btn-save-tool');
  const banner = document.getElementById('result-banner');
  const resultText = document.getElementById('result-text');

  if (!currentTab?.url || isBlockedToolUrl(currentTab.url)) {
    banner.classList.remove('hidden');
    resultText.textContent = activeTabBlockedReason || 'Cannot save internal or ToolScribe URLs.';
    saveBtn.disabled = true;
    return;
  }

  if (activeTabExistingTool) {
    banner.classList.remove('hidden');
    resultText.textContent = `"${activeTabExistingTool.name}" is already in the ToolScribe database.`;
    saveBtn.disabled = true;
    return;
  }

  const name = document.getElementById('tool-name').value.trim();
  const rawDesc = document.getElementById('tool-desc').value.trim();
  const rawCategory = document.getElementById('tool-category').value;
  const rawPricing = document.getElementById('tool-pricing').value;
  const tagsStr = document.getElementById('tool-tags').value;
  const gotcha = document.getElementById('tool-gotcha').value.trim();
  const collectionId = document.getElementById('tool-collection').value;

  if (!name) {
    alert('Please provide a tool name.');
    return;
  }

  isSavingInFlight = true;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Checking Database...';

  try {
    const domain = normalizeToolDomain(currentTab.url);

    // 1. Strict pre-insert duplicate check by domain against Supabase
    const existingTool = await findExistingToolByDomain(currentTab.url);
    if (existingTool) {
      activeTabExistingTool = existingTool;
      banner.classList.remove('hidden');
      resultText.textContent = `"${existingTool.name}" (${domain}) is already in the database. Duplicates are not allowed.`;
      saveBtn.textContent = `✓ Already in Database (${existingTool.name})`;
      return;
    }

    const session = await ensureValidSession();
    updateAuthUI(session);

    if (!session || !session.access_token || !session.user_id) {
      banner.classList.remove('hidden');
      resultText.textContent = 'Please sign in above (or open ToolScribe web app) to save tools to the database.';
      saveBtn.textContent = 'Sign In Above to Save';
      document.getElementById('auth-panel').classList.remove('hidden');
      saveBtn.disabled = false;
      return;
    }

    saveBtn.textContent = 'Saving to Database...';

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

    const favicon = (currentTab.favIconUrl && !currentTab.favIconUrl.startsWith('chrome://'))
      ? currentTab.favIconUrl
      : (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : '');

    const description = rawDesc || `${name} — clipped via ToolScribe Extension (${domain}).`;
    const icon = CATEGORY_ICONS[category] || '🔧';

    // Store clean canonical origin URL (e.g. https://mylearn.oracle.com)
    let canonicalUrl = currentTab.url;
    try {
      canonicalUrl = new URL(currentTab.url).origin;
    } catch {}

    const headers = {
      'apikey': currentConfig.anonKey,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    };

    const dbPayload = {
      name,
      url: canonicalUrl,
      description,
      category,
      icon,
      favicon,
      og_image: '',
      screenshot_url: '',
      price_model: priceModel,
      is_open_source: isOpenSource,
      requires_login: false,
      is_free: isFree,
      platforms: ['web'],
      signup_required: false,
      added_by: session.user_id
    };

    const toolRes = await fetch(`${currentConfig.supabaseUrl}/rest/v1/tools`, {
      method: 'POST',
      headers: {
        ...headers,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(dbPayload)
    });

    if (!toolRes.ok) {
      const errText = await toolRes.text();
      throw new Error(`tools insert failed (${toolRes.status}): ${errText}`);
    }

    const insertedRows = await toolRes.json();
    const toolRow = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;
    if (!toolRow || !toolRow.id) {
      throw new Error('tools insert returned no row id');
    }

    // Upsert into public.vault_items
    const vaultRes = await fetch(
      `${currentConfig.supabaseUrl}/rest/v1/vault_items?on_conflict=user_id,tool_id`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
          user_id: session.user_id,
          tool_id: toolRow.id,
          is_favorite: false,
          notes: gotcha || '',
          tags
        })
      }
    );

    if (!vaultRes.ok) {
      const errText = await vaultRes.text();
      throw new Error(`vault_items upsert failed (${vaultRes.status}): ${errText}`);
    }

    if (collectionId && collectionId !== 'vault') {
      await fetch(
        `${currentConfig.supabaseUrl}/rest/v1/collection_tools?on_conflict=collection_id,tool_id`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            collection_id: collectionId,
            tool_id: toolRow.id
          })
        }
      ).catch(() => {});
    }

    const clipEntry = {
      id: toolRow.id,
      name,
      url: canonicalUrl,
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
      created_at: toolRow.created_at || new Date().toISOString(),
      syncedToCloud: true
    };

    const storageData = await new Promise(resolve => {
      chrome.storage.local.get(['ts_clipped_tools', 'cachedVaultDomains'], resolve);
    });

    const existingClips = Array.isArray(storageData.ts_clipped_tools) ? storageData.ts_clipped_tools : [];
    const filteredClips = existingClips.filter(c => normalizeToolDomain(c.url) !== domain);
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

    activeTabExistingTool = toolRow;
    await broadcastClipsToWebApp(updatedClips, true);

    banner.classList.remove('hidden');
    resultText.textContent = `✓ Saved "${name}" to Supabase Database & Vault!`;
    saveBtn.textContent = `✓ Already in Database (${name})`;
    saveBtn.style.backgroundColor = 'var(--ts-success)';
    saveBtn.disabled = true;
  } catch (err) {
    console.error('Error saving tool:', err);
    banner.classList.remove('hidden');
    resultText.textContent = `Error: ${err.message}`;
    saveBtn.textContent = 'Retry Save';
    saveBtn.disabled = false;
  } finally {
    isSavingInFlight = false;
  }
}
