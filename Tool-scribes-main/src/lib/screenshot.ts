export async function captureScreenshot(url: string): Promise<string | null> {
  try {
    const domain = extractDomain(url);
    if (!domain) return null;

    const screenshotUrl = await tryMicrolink(url);
    if (screenshotUrl) return screenshotUrl;

    const fallbackUrl = await tryHermesForge(url);
    if (fallbackUrl) return fallbackUrl;

    return null;
  } catch {
    return null;
  }
}

function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function tryMicrolink(url: string): Promise<string | null> {
  try {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const body = await res.json();
    const screenshotUrl = body?.data?.screenshot?.url;
    if (typeof screenshotUrl === 'string' && screenshotUrl.startsWith('http')) return screenshotUrl;
    return null;
  } catch {
    return null;
  }
}

async function tryHermesForge(url: string): Promise<string | null> {
  try {
    const apiUrl = `https://hermesforge.dev/api/screenshot?url=${encodeURIComponent(url)}&format=webp&width=1280&height=720`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.startsWith('image/')) {
      return apiUrl;
    }

    const text = await res.text();
    try {
      const body = JSON.parse(text);
      if (body?.screenshot_url && typeof body.screenshot_url === 'string') return body.screenshot_url;
      if (body?.url && typeof body.url === 'string') return body.url;
    } catch {
      return null;
    }

    return null;
  } catch {
    return null;
  }
}
