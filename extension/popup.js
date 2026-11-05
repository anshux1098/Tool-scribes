// Default configuration fallback (matches repository .env)
const DEFAULT_SUPABASE_URL = "https://qglvwvpsegrucrhcpzxd.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_pN6EDmb7_lIo00Gtek36zw_QFU8sb3L";
const DEFAULT_WEBAPP_URL = "https://tool-scribes.vercel.app";

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
  setupEventListeners();
  const session = await ensureValidSession();
  updateAuthUI(session);
  if (session) {
    await loadUserCollections(session);
    await syncAllPendingClipsToDatabase(session);
  }
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
  // Always try scanning open tabs first so we pick up the latest login immediately
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

  // Verify token against Supabase /auth/v1/user
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

// Recover any domains saved in cachedVaultDomains before full clip storage existed
async function backfillDomainClips() {
  return new Promise(resolve => {
    chrome.storage.local.get(['cachedVaultDomains', 'ts_clipped_tools'], (res) => {
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
        chrome.storage.local.set({ ts_clipped_tools: clips }, resolve);
      } else {
        resolve();
      }
    });
  });
}

// Upsert a single clip entry into public.tools and public.vault_items in Supabase
async function upsertClipToSupabase(clipEntry, session) {
  if (!session?.access_token || !session?.user_id) {
    throw new Error('Not signed in to Supabase');
  }

  const headers = {
    'apikey': currentConfig.anonKey,
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };

  let toolId = null;

  // 1. Check if a tool with this exact URL already exists in public.tools
  const existingRes = await fetch(
    `${currentConfig.supabaseUrl}/rest/v1/tools?url=eq.${encodeURIComponent(clipEntry.url)}&select=id,name,url&limit=1`,
    { headers }
  );
  if (existingRes.ok) {
    const existingRows = await existingRes.json();
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      toolId = existingRows[0].id;
    }
  }

  // 2. If not found, insert into public.tools
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
    toolId = toolRow.id;
  }

  // 3. Upsert into public.vault_items (with explicit on_conflict=user_id,tool_id)
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
        tool_id: toolId,
        is_favorite: false,
        notes: clipEntry.notes || '',
        tags: Array.isArray(clipEntry.tags) ? clipEntry.tags : []
      })
    }
  );

  if (!vaultRes.ok) {
    const errText = await vaultRes.text();
    throw new Error(`vault_items upsert failed (${vaultRes.status}): ${errText}`);
  }

  // 4. Optional collection_tools insert
  if (clipEntry.collection_id && clipEntry.collection_id !== 'vault') {
    await fetch(
      `${currentConfig.supabaseUrl}/rest/v1/collection_tools?on_conflict=collection_id,tool_id`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          collection_id: clipEntry.collection_id,
          tool_id: toolId
        })
      }
    ).catch(() => {});
  }

  return toolId;
}

// Automatically sync any previously clipped items (e.g. Instagram, Oracle) that haven't been saved to Supabase yet
async function syncAllPendingClipsToDatabase(session) {
  if (!session?.access_token || !session?.user_id) return 0;

  const storageData = await new Promise(r => chrome.storage.local.get(['ts_clipped_tools'], r));
  const clips = Array.isArray(storageData.ts_clipped_tools) ? storageData.ts_clipped_tools : [];
  const pending = clips.filter(c => !c.syncedToCloud);
  if (pending.length === 0) return 0;

  let syncedCount = 0;
  for (const clip of pending) {
    try {
      const cloudId = await upsertClipToSupabase(clip, session);
      if (cloudId) {
        clip.id = cloudId;
        clip.syncedToCloud = true;
        syncedCount++;
      }
    } catch (e) {
      console.warn('[ToolScribe Popup] Pending clip sync failed for', clip.name, e);
    }
  }

  if (syncedCount > 0) {
    await new Promise(r => chrome.storage.local.set({ ts_clipped_tools: clips }, r));
    await broadcastClipsToWebApp(clips, true);
  }
  return syncedCount;
}

// Inspect active tab DOM
async function inspectActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  currentTab = tab;

  document.getElementById('page-url').textContent = tab.url || 'No active URL';
  document.getElementById('tool-name').value = cleanTitle(tab.title || '');

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
        t.url.includes('tool-scribes.vercel.app') ||
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
    await loadUserCollections(session);
    const count = await syncAllPendingClipsToDatabase(session);
    if (count > 0) {
      const banner = document.getElementById('result-banner');
      const resultText = document.getElementById('result-text');
      banner.classList.remove('hidden');
      resultText.textContent = `Signed in & synced ${count} pending clip(s) to DB!`;
    }
  } catch (err) {
    errEl.textContent = err.message || 'Sign in failed';
    errEl.classList.remove('hidden');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In & Sync Pending Clips';
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

// Save tool to Vault (Direct Supabase DB Insert + Local Cache)
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
    const storageData = await new Promise(resolve => {
      chrome.storage.local.get(['ts_clipped_tools', 'cachedVaultDomains'], resolve);
    });

    const session = await ensureValidSession();
    updateAuthUI(session);

    let dbErrorMsg = null;
    if (session && session.access_token && session.user_id) {
      try {
        const cloudToolId = await upsertClipToSupabase(clipEntry, session);
        clipEntry.id = cloudToolId;
        clipEntry.syncedToCloud = true;
      } catch (dbErr) {
        console.error('[ToolScribe Popup] Supabase insert error:', dbErr);
        dbErrorMsg = dbErr.message;
      }
    }

    // Always store in ts_clipped_tools & cachedVaultDomains
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

    // Broadcast and reload open ToolScribe tabs if synced to DB
    await broadcastClipsToWebApp(updatedClips, clipEntry.syncedToCloud);

    banner.classList.remove('hidden');
    if (clipEntry.syncedToCloud) {
      resultText.textContent = `✓ Saved "${name}" to Supabase Database & Vault!`;
      saveBtn.textContent = '✓ Saved to Supabase DB';
      saveBtn.style.backgroundColor = 'var(--ts-success)';
    } else if (!session) {
      resultText.textContent = `Queued locally — sign in above to write to Supabase DB!`;
      saveBtn.textContent = 'Sign In Above to Sync DB';
      document.getElementById('auth-panel').classList.remove('hidden');
    } else {
      resultText.textContent = `DB Error: ${dbErrorMsg || 'Could not insert'}`;
      saveBtn.textContent = 'Retry Save';
    }
  } catch (err) {
    console.error('Error saving tool:', err);
    banner.classList.remove('hidden');
    resultText.textContent = `Error: ${err.message}`;
    saveBtn.textContent = 'Retry Save';
  } finally {
    setTimeout(() => {
      saveBtn.disabled = false;
    }, 1200);
  }
}
