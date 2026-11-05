// ToolScribe Content Script: Web App Sync Bridge + In-Page Radar

(function() {
  if (window.top !== window.self) return;

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
            const userId = parsed?.user?.id || parsed?.currentSession?.user?.id;
            if (accessToken && userId) {
              chrome.storage.local.set({
                ts_auth_session: {
                  access_token: accessToken,
                  user_id: userId,
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

    // B. Push extension clips from chrome.storage.local -> web app localStorage + live DOM event
    function pushClipsToWebApp() {
      chrome.storage.local.get(['ts_clipped_tools', 'cachedVaultDomains'], (res) => {
        const domains = Array.isArray(res.cachedVaultDomains) ? res.cachedVaultDomains : [];
        const clips = Array.isArray(res.ts_clipped_tools) ? res.ts_clipped_tools : [];
        let backfilled = false;

        // Backfill any domain that was saved into cachedVaultDomains (e.g. www.instagram.com)
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
            backfilled = true;
          }
        }

        if (backfilled) {
          chrome.storage.local.set({ ts_clipped_tools: clips });
        }

        try {
          localStorage.setItem('ts_extension_clips', JSON.stringify(clips));
          window.dispatchEvent(new CustomEvent('ts:extension-clips-updated', { detail: clips }));
        } catch (e) {
          console.debug('[ToolScribe Bridge] Failed to write localStorage clips:', e);
        }
      });
    }

    // Run immediately and on focus/visibility change
    syncAuthToExtension();
    pushClipsToWebApp();
    window.addEventListener('focus', () => {
      syncAuthToExtension();
      pushClipsToWebApp();
    });

    // Listen for live clip updates from popup or background
    if (chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === 'TS_CLIP_UPDATED' && Array.isArray(msg.clips)) {
          try {
            localStorage.setItem('ts_extension_clips', JSON.stringify(msg.clips));
            window.dispatchEvent(new CustomEvent('ts:extension-clips-updated', { detail: msg.clips }));
          } catch {}
        }
      });
    }

    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && (changes.ts_clipped_tools || changes.cachedVaultDomains)) {
          pushClipsToWebApp();
        }
      });
    }

    // Listen for web app notifying that an offline clip was synced to Supabase
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
        chrome.storage.local.set({ ts_clipped_tools: next });
      });
    });

    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. EXTERNAL SITES: CONTEXTUAL TOOLSCRIBE RADAR PILL
  // ═══════════════════════════════════════════════════════════════════════════
  if (document.getElementById('toolscribe-radar-root')) return;

  // Don't show radar pill on search engines
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
        📌 Clip to My Vault
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
    clipBtn.textContent = '✓ Saved to Vault!';
    clipBtn.style.backgroundColor = '#059669';

    if (chrome?.storage?.local) {
      const cleanHost = host.replace(/^www\./i, '');
      const descEl = document.querySelector('meta[name="description"]') || document.querySelector('meta[property="og:description"]');
      const desc = descEl?.getAttribute('content')?.trim()?.slice(0, 300) || `${toolName} — clipped via ToolScribe Radar.`;

      const clipEntry = {
        id: `ext-${cleanHost}`,
        name: toolName,
        url: window.location.href,
        description: desc,
        category: host.includes('github.com') ? 'dev' : 'util',
        icon: host.includes('github.com') ? '💻' : '🔧',
        favicon: `https://www.google.com/s2/favicons?domain=${cleanHost}&sz=64`,
        price_model: 'free',
        is_open_source: host.includes('github.com'),
        is_free: true,
        notes: '',
        tags: ['radar-clip'],
        created_at: new Date().toISOString(),
        syncedToCloud: false
      };

      chrome.storage.local.get(['cachedVaultDomains', 'ts_clipped_tools'], (res) => {
        const domains = Array.isArray(res.cachedVaultDomains) ? res.cachedVaultDomains : [];
        if (!domains.includes(cleanHost)) domains.push(cleanHost);

        const existing = Array.isArray(res.ts_clipped_tools) ? res.ts_clipped_tools : [];
        const filtered = existing.filter(c => c.url !== clipEntry.url && c.id !== clipEntry.id);
        chrome.storage.local.set({
          cachedVaultDomains: domains,
          ts_clipped_tools: [clipEntry, ...filtered]
        });
      });
    }

    setTimeout(() => {
      card.style.display = 'none';
    }, 1200);
  });

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
