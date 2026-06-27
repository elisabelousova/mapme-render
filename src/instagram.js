const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);

export function findInstagramUrls(text) {
  return [...String(text || "").matchAll(/https?:\/\/[^\s)]+/gi)]
    .map((match) => cleanUrl(match[0]))
    .filter(isInstagramUrl);
}

export function isInstagramUrl(url) {
  try {
    return INSTAGRAM_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function resolveInstagramContent(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ru,en;q=0.9"
    }
  });

  if (!response.ok) {
    return {
      url,
      ok: false,
      reason: `Instagram вернул HTTP ${response.status}`
    };
  }

  const html = await response.text();
  const metadata = extractMetadata(html);
  const textParts = [
    metadata.title,
    metadata.description,
    metadata.ogTitle,
    metadata.ogDescription,
    metadata.twitterDescription
  ].filter(Boolean);

  return {
    url,
    ok: textParts.length > 0 || Boolean(metadata.imageUrl),
    title: metadata.title || metadata.ogTitle || "",
    text: unique(textParts).join("\n"),
    imageUrl: metadata.imageUrl || "",
    reason: textParts.length ? "" : "Не получилось достать подпись из публичных метаданных"
  };
}

function extractMetadata(html) {
  const meta = {};
  const patterns = {
    title: /<title[^>]*>([\s\S]*?)<\/title>/i,
    description: /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
    ogTitle: /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["'][^>]*>/i,
    ogDescription: /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
    twitterDescription: /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
    imageUrl: /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["'][^>]*>/i
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = html.match(pattern);
    if (match?.[1]) meta[key] = decodeHtml(match[1]).trim();
  }

  return meta;
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanUrl(value) {
  return value.replace(/[),.]+$/, "");
}

function unique(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
