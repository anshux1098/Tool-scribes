// ToolScribe Content Script: Web App Sync Bridge + In-Page Radar

(function() {
  if (window.top !== window.self) return;

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
    const h = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    if (!h || !h.includes('.')) return true; // blocks 'localhost', 'extensions', 'newtab', etc.
    if (
      h === '127.0.0.1' ||
      h === '0.0.0.0' ||
      h.endsWith('.localhost') ||
      h.endsWith('.local') ||
      h.includes('tool-scribes') ||
      h.includes('toolscribes')
    ) {
      return true;
    }
    return false;
  }

  function sanitizeClips(rawClips) {
    if (!Array.isArray(rawClips)) return [];
    const seenDomains = new Set();
    const cleaned = [];
    for (const c of rawClips) {
      if (!c || !c.url || isBlockedToolUrl(c.url)) continue;
      if (c.id && KNOWN_JUNK_UUIDS.has(c.id)) continue;
      const dom = normalizeToolDomain(c.url);
      if (!dom || seenDomains.has(dom)) continue;
      seenDomains.add(dom);
      cleaned.push(c);
    }
    return cleaned;
  }

  const host = window.location.hostname.toLowerCase();
  const isToolScribeWebApp =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.includes('tool-scribes') ||
    host.includes('toolscribes');

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. TOOLSCRIBE WEB APP BRIDGE (Syncs Extension Clips <-> Website & Auth)
  // ═══════════════════════════════════════════════════════════════════════════
  if (isToolScribeWebApp && typeof chrome !== 'undefined' && chrome.storage?.local) {
    // A. Capture Supabase auth session from web app localStorage -> extension storage
    function syncAuthToExtension() {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            const accessToken = parsed?.access_token || parsed?.currentSession?.access_token;
            const refreshToken = parsed?.refresh_token || parsed?.currentSession?.refresh_token;
            const expiresAt = parsed?.expires_at || parsed?.currentSession?.expires_at;
            const user = parsed?.user || parsed?.currentSession?.user;
            if (accessToken && user?.id) {
              chrome.storage.local.set({
                ts_auth_session: {
                  access_token: accessToken,
                  refresh_token: refreshToken || '',
                  expires_at: expiresAt || 0,
                  user_id: user.id,
                  user_email: user.email || '',
                  updated_at: Date.now()
                }
              });
              return;
            }
          }
        }
      } catch (e) {
        console.debug('[ToolScribe Bridge] Auth sync skipped:', e);
      }
    }

    // B. Push sanitized extension clips from chrome.storage.local -> web app localStorage
    function pushClipsToWebApp() {
      chrome.storage.local.get(['ts_clipped_tools'], (res) => {
        const rawClips = Array.isArray(res.ts_clipped_tools) ? res.ts_clipped_tools : [];
        const cleanClips = sanitizeClips(rawClips);

        if (cleanClips.length !== rawClips.length) {
          chrome.storage.local.set({ ts_clipped_tools: cleanClips });
        }

        try {
          localStorage.setItem('ts_extension_clips', JSON.stringify(cleanClips));
          window.dispatchEvent(new CustomEvent('ts:extension-clips-updated', { detail: cleanClips }));
        } catch (e) {
          console.debug('[ToolScribe Bridge] Failed to write localStorage clips:', e);
        }
      });
    }

    syncAuthToExtension();
    pushClipsToWebApp();
    window.addEventListener('focus', () => {
      syncAuthToExtension();
      pushClipsToWebApp();
    });

    if (chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === 'TS_CLIP_UPDATED' && Array.isArray(msg.clips)) {
          try {
            const clean = sanitizeClips(msg.clips);
            localStorage.setItem('ts_extension_clips', JSON.stringify(clean));
            window.dispatchEvent(new CustomEvent('ts:extension-clips-updated', { detail: clean }));
          } catch {}
        }
      });
    }

    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.ts_clipped_tools) {
          pushClipsToWebApp();
        }
      });
    }

    window.addEventListener('ts:mark-clip-synced', (e) => {
      const detail = e?.detail;
      if (!detail || !detail.url) return;
      chrome.storage.local.get(['ts_clipped_tools'], (res) => {
        const clips = Array.isArray(res.ts_clipped_tools) ? res.ts_clipped_tools : [];
        const next = clips.map(c =>
          c.url === detail.url
            ? { ...c, id: detail.cloudUuid || c.id, syncedToCloud: true }
            : c
        );
        chrome.storage.local.set({ ts_clipped_tools: sanitizeClips(next) });
      });
    });

    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. EXTERNAL SITES: CONTEXTUAL TOOLSCRIBE RADAR PILL
  // ═══════════════════════════════════════════════════════════════════════════
  if (isBlockedToolUrl(window.location.href)) return;
  if (document.getElementById('toolscribe-radar-root')) return;

  const searchEngines = ['google.', 'bing.', 'duckduckgo.', 'baidu.'];
  if (searchEngines.some(h => host.includes(h))) return;

  if (sessionStorage.getItem('ts_radar_dismissed')) return;

  const isLikelyTool = (
    host.includes('github.com') ||
    document.querySelector('meta[name="description"]')?.getAttribute('content')?.toLowerCase()?.includes('tool') ||
    document.querySelector('a[href*="/pricing"], a[href*="/docs"], a[href*="/download"]') !== null
  );

  if (!isLikelyTool) return;

  const root = document.createElement('div');
  root.id = 'toolscribe-radar-root';

  const toolName = document.title.split(/[-|–—•]/)[0].trim() || host;

  root.innerHTML = `
    <div id="toolscribe-radar-pill" title="ToolScribe Community Radar">
      <div class="ts-radar-icon">⚡</div>
      <span class="ts-radar-text">ToolScribe</span>
      <span class="ts-radar-score">Radar</span>
    </div>

    <div id="toolscribe-radar-card" style="display: none;">
      <div class="ts-card-header">
        <span class="ts-card-title">${escapeHtml(toolName)}</span>
        <button id="ts-card-close-btn" class="ts-card-close" title="Dismiss">&times;</button>
      </div>
      <div class="ts-card-body">
        <p>Curator-moderated community insights & gotchas for this platform.</p>
        <div class="ts-card-highlight">
          <strong>Gotcha / Best For:</strong> Inspect pricing tiers & open-source alternatives before committing.
        </div>
      </div>
      <button id="ts-card-clip-btn" class="ts-card-cta">
        📌 Open Extension Popup to Save
      </button>
    </div>
  `;

  document.body.appendChild(root);

  const pill = root.querySelector('#toolscribe-radar-pill');
  const card = root.querySelector('#toolscribe-radar-card');
  const closeBtn = root.querySelector('#ts-card-close-btn');
  const clipBtn = root.querySelector('#ts-card-clip-btn');

  pill.addEventListener('click', () => {
    const isVisible = card.style.display !== 'none';
    card.style.display = isVisible ? 'none' : 'flex';
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    root.remove();
    sessionStorage.setItem('ts_radar_dismissed', '1');
  });

  clipBtn.addEventListener('click', () => {
    clipBtn.textContent = 'Click the ⚡ ToolScribe icon in your toolbar!';
    setTimeout(() => {
      card.style.display = 'none';
    }, 1500);
  });

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
