import { normalizeUrl } from './storage';

export function getHostname(url: string) {
  try {
    return new URL(normalizeUrl(url)).hostname;
  } catch {
    return '';
  }
}

export function getFaviconUrl(url: string) {
  const hostname = getHostname(url);
  return hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=64` : '';
}

export async function fetchWebsiteInfo(url: string) {
  const normalizedUrl = normalizeUrl(url);
  const hostname = getHostname(normalizedUrl);
  const fallbackIcon = getFaviconUrl(normalizedUrl);

  try {
    const response = await fetch(normalizedUrl);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title =
      doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      doc.querySelector('title')?.textContent ||
      hostname;
    const description =
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
      doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
      '';
    const iconHref =
      doc.querySelector('link[rel~="icon"]')?.getAttribute('href') ||
      doc.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
      '';
    const icon = iconHref ? new URL(iconHref, normalizedUrl).toString() : fallbackIcon;

    return {
      title: title.trim(),
      description: description.trim(),
      icon,
      status: 'success' as const,
    };
  } catch {
    return {
      title: hostname,
      description: '',
      icon: fallbackIcon,
      status: 'fallback' as const,
    };
  }
}
