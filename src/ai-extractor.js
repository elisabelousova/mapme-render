export class AiPlaceExtractor {
  constructor({ apiKey, model }) {
    this.apiKey = apiKey;
    this.model = model || "gpt-4.1-mini";
  }

  get enabled() {
    return Boolean(this.apiKey);
  }

  async extractFromContent({ text = "", imageUrl = "", sourceUrl = "" }) {
    if (!this.enabled) return [];

    const content = [
      {
        type: "input_text",
        text: [
          "Ты извлекаешь travel-места из Instagram/Telegram контента.",
          "Верни только JSON-массив без markdown.",
          "Каждый объект: title, city, category, note.",
          "category: cafe | restaurant | bar | museum | hotel | viewpoint | beach | neighborhood | transport | place.",
          "Если город неизвестен, city = \"Нужно уточнить\".",
          "Не выдумывай места. Если мест нет, верни [].",
          "",
          "Контент:",
          text || "(текста нет)",
          "",
          sourceUrl ? `Источник: ${sourceUrl}` : ""
        ].join("\n")
      }
    ];

    if (imageUrl) {
      content.push({
        type: "input_image",
        image_url: imageUrl
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        input: [
          {
            role: "user",
            content
          }
        ]
      })
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error?.message || `OpenAI API error: ${response.status}`);
    }

    return normalizePlaces(parseJsonOutput(json), sourceUrl, text);
  }
}

function parseJsonOutput(response) {
  const outputText =
    response.output_text ||
    response.output
      ?.flatMap((item) => item.content || [])
      .map((item) => item.text || "")
      .join("\n") ||
    "";

  const cleaned = outputText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  if (!cleaned) return [];

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) return [];
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

function normalizePlaces(items, sourceUrl, rawText) {
  return items
    .filter((item) => item && typeof item === "object" && item.title)
    .map((item) => ({
      title: String(item.title || "").trim(),
      city: String(item.city || "Нужно уточнить").trim() || "Нужно уточнить",
      category: normalizeCategory(item.category),
      note: String(item.note || "").trim(),
      sourceUrl,
      rawText,
      confidence: 0.82
    }))
    .filter((item) => item.title);
}

function normalizeCategory(value) {
  const allowed = new Set([
    "cafe",
    "restaurant",
    "bar",
    "museum",
    "hotel",
    "viewpoint",
    "beach",
    "neighborhood",
    "transport",
    "place"
  ]);
  return allowed.has(value) ? value : "place";
}
