export interface MetadataResult {
  name: string;
  description: string;
  ogImage: string;
  favicon: string;
}

export async function fetchMetadata(url: string): Promise<MetadataResult | null> {
  try {
    const hostname = new URL(url).hostname;
    const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const name = doc.querySelector('title')?.textContent || '';
    const description =
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
      doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
    const ogImage =
      doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

    return { name, description, ogImage, favicon };
  } catch (e) {
    console.error('Metadata fetch failed', e);
    try {
      const hostname = new URL(url).hostname;
      return {
        name: '',
        description: '',
        ogImage: '',
        favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
      };
    } catch {
      return null;
    }
  }
}
