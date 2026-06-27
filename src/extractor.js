const CITY_ALIASES = new Map([
  ["будапешт", "Будапешт"],
  ["budapest", "Будапешт"],
  ["стамбул", "Стамбул"],
  ["istanbul", "Стамбул"],
  ["константинополь", "Стамбул"],
  ["белград", "Белград"],
  ["belgrade", "Белград"],
  ["сербия", "Белград"],
  ["париж", "Париж"],
  ["paris", "Париж"],
  ["рим", "Рим"],
  ["rome", "Рим"],
  ["милан", "Милан"],
  ["milan", "Милан"],
  ["барселона", "Барселона"],
  ["barcelona", "Барселона"],
  ["лиссабон", "Лиссабон"],
  ["lisbon", "Лиссабон"],
  ["вена", "Вена"],
  ["vienna", "Вена"],
  ["прага", "Прага"],
  ["prague", "Прага"],
  ["берлин", "Берлин"],
  ["berlin", "Берлин"],
  ["тбилиси", "Тбилиси"],
  ["tbilisi", "Тбилиси"],
  ["ереван", "Ереван"],
  ["yerevan", "Ереван"],
  ["алматы", "Алматы"],
  ["almaty", "Алматы"],
  ["дубай", "Дубай"],
  ["dubai", "Дубай"],
  ["абу-даби", "Абу-Даби"],
  ["abu dhabi", "Абу-Даби"],
  ["баку", "Баку"],
  ["baku", "Баку"],
  ["каппадокия", "Каппадокия"],
  ["cappadocia", "Каппадокия"],
  ["гёреме", "Каппадокия"],
  ["goreme", "Каппадокия"],
  ["афины", "Афины"],
  ["athens", "Афины"],
  ["санторини", "Санторини"],
  ["santorini", "Санторини"],
  ["миконос", "Миконос"],
  ["mykonos", "Миконос"],
  ["гонконг", "Гонконг"],
  ["hong kong", "Гонконг"],
  ["сидней", "Сидней"],
  ["sydney", "Сидней"],
  ["бали", "Бали"],
  ["bali", "Бали"],
  ["убуд", "Убуд"],
  ["ubud", "Убуд"],
  ["бангкок", "Бангкок"],
  ["bangkok", "Бангкок"],
  ["пхукет", "Пхукет"],
  ["phuket", "Пхукет"],
  ["сеул", "Сеул"],
  ["seoul", "Сеул"],
  ["токио", "Токио"],
  ["tokyo", "Токио"],
  ["амстердам", "Амстердам"],
  ["amsterdam", "Амстердам"],
  ["сараево", "Сараево"],
  ["sarajevo", "Сараево"],
  ["мостар", "Мостар"],
  ["mostar", "Мостар"],
  ["котор", "Котор"],
  ["kotor", "Котор"],
  ["будва", "Будва"],
  ["budva", "Будва"],
  ["подгорица", "Подгорица"],
  ["podgorica", "Подгорица"],
  ["нови сад", "Нови-Сад"],
  ["novi sad", "Нови-Сад"],
  ["варшава", "Варшава"],
  ["warsaw", "Варшава"],
  ["краков", "Краков"],
  ["krakow", "Краков"],
  ["минск", "Минск"],
  ["minsk", "Минск"],
  ["сочи", "Сочи"],
  ["sochi", "Сочи"],
  ["ташкент", "Ташкент"],
  ["tashkent", "Ташкент"],
  ["самарканд", "Самарканд"],
  ["samarkand", "Самарканд"],
  ["бухара", "Бухара"],
  ["bukhara", "Бухара"],
  ["хива", "Хива"],
  ["khiva", "Хива"]
]);

const CATEGORY_KEYWORDS = [
  ["cafe", ["кафе", "кофе", "coffee", "cafe", "завтрак", "brunch"]],
  ["restaurant", ["ресторан", "ужин", "обед", "еда", "гирос", "restaurant", "food"]],
  ["bar", ["бар", "вино", "коктейль", "барчик", "wine", "bar"]],
  ["museum", ["музей", "галерея", "выставка", "museum", "gallery"]],
  ["hotel", ["отель", "гостиница", "hotel", "hostel"]],
  ["viewpoint", ["видовая", "смотровая", "закат", "view", "sunset"]],
  ["beach", ["пляж", "море", "beach"]],
  ["neighborhood", ["район", "улица", "квартал", "neighborhood", "street"]],
  ["transport", ["вокзал", "аэропорт", "станция", "airport", "station"]]
];

export function extractPlaces(input) {
  const text = normalizeInput(input);
  if (!text) return [];

  const urls = [...text.matchAll(/https?:\/\/\S+/gi)].map((match) => cleanUrl(match[0]));
  const candidates = [];
  const lines = splitIntoLines(text);

  for (const line of lines) {
    candidates.push(...extractFromLine(line, urls));
  }

  if (candidates.length === 0 && urls.length > 0) {
    candidates.push({
      title: "Место из ссылки",
      city: "Нужно уточнить",
      category: "unknown",
      sourceUrl: urls[0],
      rawText: text,
      confidence: 0.2
    });
  }

  return dedupe(candidates).slice(0, 20);
}

function normalizeInput(input) {
  return String(input || "")
    .replace(/\r/g, "\n")
    .replace(/[•·]/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

function splitIntoLines(text) {
  const rough = text
    .split(/\n|(?:^|\s)\d{1,2}[.)]\s/g)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rough.length > 1) return rough;

  return text
    .split(/;|\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractFromLine(line, urls) {
  const clean = stripNoise(line);
  if (!clean) return [];

  const cityPrefix = clean.match(/^([^:]{2,40}):\s*(.+)$/);
  if (cityPrefix) {
    const city = detectCity(cityPrefix[1]);
    if (city) return splitPlaceList(cityPrefix[2]).map((title) => buildCandidate(title, city, line, urls));
  }

  const dashed = clean.match(/^(.{2,80}?)\s+[—-]\s+(.{2,50})$/);
  if (dashed) {
    const cityA = detectCity(dashed[1]);
    const cityB = detectCity(dashed[2]);
    if (cityA) return [buildCandidate(dashed[2], cityA, line, urls)];
    if (cityB) return [buildCandidate(dashed[1], cityB, line, urls)];
  }

  const comma = clean.match(/^(.{2,80}?),\s*([^,]{2,50})$/);
  if (comma) {
    const city = detectCity(comma[2]);
    if (city) return [buildCandidate(comma[1], city, line, urls)];
  }

  const city = detectCity(clean) || "Нужно уточнить";
  const title = inferTitle(clean, city);
  if (!title && !urls.length) return [];

  return [buildCandidate(title || "Место из ссылки", city, line, urls)];
}

function buildCandidate(title, city, rawText, urls) {
  const cleanTitle = title
    .replace(/^это\s+/i, "")
    .replace(/^(хочу сохранить|сохранить|место|кафе|ресторан)\s+/i, "")
    .trim();

  return {
    title: cleanTitle || "Место без названия",
    city,
    category: detectCategory(cleanTitle) || "place",
    sourceUrl: urls.find((url) => rawText.includes(url)) || urls[0] || "",
    rawText,
    confidence: city === "Нужно уточнить" ? 0.45 : 0.7
  };
}

function splitPlaceList(value) {
  return value
    .split(/,|\n| и /g)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function detectCity(value) {
  const lower = value.toLowerCase();
  const sortedAliases = [...CITY_ALIASES.keys()].sort((a, b) => b.length - a.length);
  const alias = sortedAliases.find((key) => new RegExp(`(^|[^а-яa-z])${escapeRegExp(key)}([^а-яa-z]|$)`, "i").test(lower));
  return alias ? CITY_ALIASES.get(alias) : "";
}

function inferTitle(value, city) {
  let title = value.replace(/https?:\/\/\S+/gi, "");
  if (city !== "Нужно уточнить") {
    for (const [alias, canonical] of CITY_ALIASES.entries()) {
      if (canonical === city) title = title.replace(new RegExp(escapeRegExp(alias), "gi"), "");
    }
  }
  title = title
    .replace(/[#@]\S+/g, "")
    .replace(/\b(хочу|сохранить|место|в|во|это|называется|называют|локация|город|куда|сходить|посмотреть)\b/gi, " ")
    .replace(/[,:;()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (title.length > 80) return title.slice(0, 77).trim() + "...";
  return title;
}

function detectCategory(value) {
  const lower = value.toLowerCase();
  const match = CATEGORY_KEYWORDS.find(([, words]) => words.some((word) => lower.includes(word)));
  return match ? match[0] : "";
}

function stripNoise(value) {
  return value
    .replace(/^[-–—*\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanUrl(value) {
  return value.replace(/[),.]+$/, "");
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.city}:${item.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
