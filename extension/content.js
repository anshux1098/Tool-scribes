// ToolScribe Radar Content Script

(function() {
  // Prevent running in iframes or duplicate injections
  if (window.top !== window.self) return;
  if (document.getElementById('toolscribe-radar-root')) return;

  // Don't show on search engines or private portals
  const host = window.location.hostname.toLowerCase();
  const ignoredHosts = ['google.', 'bing.', 'duckduckgo.', 'baidu.', 'facebook.', 'instagram.', 'twitter.', 'x.com', 'reddit.'];
  if (ignoredHosts.some(h => host.includes(h))) return;

  // Check if dismissed in this tab session
  if (sessionStorage.getItem('ts_radar_dismissed')) return;

  // Simple heuristic: Is this page likely a developer / software / SaaS tool?
  const isLikelyTool = (
    host.includes('github.com') ||
    document.querySelector('meta[name="description"]')?.getAttribute('content')?.toLowerCase()?.includes('tool') ||
    document.querySelector('a[href*="/pricing"], a[href*="/docs"], a[href*="/download"]') !== null
  );

  if (!isLikelyTool) return;

  // Create UI Root
  const root = document.createElement('div');
  root.id = 'toolscribe-radar-root';

  const toolName = document.title.split(/[-|–]/)[0].trim() || host;

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

  // Setup interactions
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
    clipBtn.textContent = 'Saved to Vault!';
    clipBtn.style.backgroundColor = '#059669';

    // Store in local storage cache
    if (chrome?.storage?.local) {
      chrome.storage.local.get(['cachedVaultDomains'], (res) => {
        const domains = res.cachedVaultDomains || [];
        if (!domains.includes(host)) {
          domains.push(host);
          chrome.storage.local.set({ cachedVaultDomains: domains });
        }
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
