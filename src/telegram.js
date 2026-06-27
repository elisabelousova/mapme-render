import { extractPlaces } from "./extractor.js";
import { findInstagramUrls, resolveInstagramContent } from "./instagram.js";

const POLL_TIMEOUT = 25;

export class TelegramBot {
  constructor({ token, store, webappUrl, aiExtractor }) {
    this.token = token;
    this.store = store;
    this.webappUrl = webappUrl.replace(/\/$/, "");
    this.aiExtractor = aiExtractor;
    this.offset = 0;
    this.stopped = false;
  }

  async start() {
    if (!this.token) {
      console.log("BOT_TOKEN is empty. Web app is running without Telegram bot.");
      return;
    }

    console.log("Telegram bot long polling started.");
    while (!this.stopped) {
      try {
        const updates = await this.call("getUpdates", {
          offset: this.offset,
          timeout: POLL_TIMEOUT,
          allowed_updates: ["message"]
        });

        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      } catch (error) {
        console.error("Polling error:", error.message);
        await sleep(1500);
      }
    }
  }

  stop() {
    this.stopped = true;
  }

  async setWebhook(url) {
    if (!this.token) {
      console.log("BOT_TOKEN is empty. Webhook was not registered.");
      return;
    }

    await this.call("setWebhook", {
      url,
      allowed_updates: ["message"],
      drop_pending_updates: false
    });
  }

  async deleteWebhook() {
    if (!this.token) return;
    await this.call("deleteWebhook", { drop_pending_updates: false });
  }

  async handleUpdate(update) {
    const message = update.message;
    if (!message || !message.chat || !message.from) return;

    const user = await this.store.getOrCreateUser(message.from);

    if (message.text?.startsWith("/")) {
      await this.handleCommand(message, user);
      return;
    }

    if (message.photo?.length) {
      await this.saveFromPhoto(message.chat.id, user, message);
      return;
    }

    const input = [message.text, message.caption].filter(Boolean).join("\n");
    await this.saveFromMessageText(message.chat.id, user, input);
  }

  async handleCommand(message, user) {
    const [command, ...args] = message.text.trim().split(/\s+/);
    const chatId = message.chat.id;

    if (command === "/start") {
      await this.sendMessage(chatId, startText(this.mapUrl(user)), this.mapKeyboard(user));
      return;
    }

    if (command === "/help") {
      await this.sendMessage(chatId, helpText(), this.mapKeyboard(user));
      return;
    }

    if (command === "/map") {
      await this.sendMessage(chatId, `Твоя карта: ${this.mapUrl(user)}`, this.mapKeyboard(user));
      return;
    }

    if (command === "/cities") {
      await this.sendMessage(chatId, citiesText(user), this.mapKeyboard(user));
      return;
    }

    if (command === "/places") {
      await this.sendMessage(chatId, placesText(user), this.mapKeyboard(user));
      return;
    }

    if (command === "/delete" && args[0] === "YES") {
      await this.store.deleteUser(user.id);
      await this.sendMessage(chatId, "Готово, я удалила твои сохраненные места и личную ссылку.");
      return;
    }

    if (command === "/delete") {
      await this.sendMessage(chatId, "Чтобы удалить все данные, отправь `/delete YES`.");
      return;
    }

    await this.sendMessage(chatId, "Не знаю такую команду. Нажми /help, покажу примеры.");
  }

  async saveFromText(chatId, user, input) {
    const candidates = extractPlaces(input);
    if (candidates.length === 0) {
      await this.sendMessage(chatId, noCandidatesText(), this.mapKeyboard(user));
      return;
    }

    const result = await this.store.addPlaces(user.id, candidates);

    await this.sendMessage(chatId, savedText(result, this.mapUrl(user)), this.mapKeyboard(user));
  }

  async saveFromMessageText(chatId, user, input) {
    const instagramUrls = findInstagramUrls(input);
    if (instagramUrls.length) {
      await this.saveFromInstagram(chatId, user, input, instagramUrls);
      return;
    }

    await this.saveFromText(chatId, user, input);
  }

  async saveFromInstagram(chatId, user, input, urls) {
    await this.sendMessage(chatId, "Вижу Instagram-ссылку. Пробую достать описание и текст из превью.");

    const allCandidates = [];
    const notes = [];

    for (const url of urls.slice(0, 3)) {
      try {
        const content = await resolveInstagramContent(url);
        const combinedText = [input, content.text].filter(Boolean).join("\n\n");
        let candidates = [];

        if (this.aiExtractor?.enabled && (content.text || content.imageUrl)) {
          candidates = await this.aiExtractor.extractFromContent({
            text: combinedText,
            imageUrl: content.imageUrl,
            sourceUrl: url
          });
        }

        if (!candidates.length) {
          candidates = extractPlaces(combinedText).map((candidate) => ({
            ...candidate,
            sourceUrl: url
          }));
        }

        allCandidates.push(...candidates.filter(isUsefulCandidate));

        if (!content.ok) {
          notes.push(`По одной ссылке Instagram не отдал описание: ${content.reason}.`);
        } else if (!this.aiExtractor?.enabled) {
          notes.push("AI-распознавание не включено, поэтому я использовала только простой парсер текста.");
        }

        if (content.ok && !content.text && content.imageUrl && !this.aiExtractor?.enabled) {
          notes.push("Картинка в превью есть, но OCR включится только после добавления OPENAI_API_KEY.");
        }
      } catch (error) {
        notes.push(`Не смогла прочитать Instagram-ссылку: ${error.message}`);
      }
    }

    if (!allCandidates.length) {
      await this.sendMessage(chatId, instagramFallbackText(notes), this.mapKeyboard(user));
      return;
    }

    const result = await this.store.addPlaces(user.id, allCandidates);

    await this.sendMessage(chatId, savedText(result, this.mapUrl(user), notes), this.mapKeyboard(user));
  }

  async saveFromPhoto(chatId, user, message) {
    if (!this.aiExtractor?.enabled) {
      const caption = message.caption || "";
      if (caption) {
        await this.saveFromMessageText(chatId, user, caption);
        return;
      }

      await this.sendMessage(
        chatId,
        "Скрин вижу, но OCR включится только после добавления OPENAI_API_KEY. Пока пришли рядом текстом город и название места, например: Будапешт: New York Cafe."
      );
      return;
    }

    await this.sendMessage(chatId, "Скрин вижу. Пробую распознать текст и места на картинке.");

    try {
      const imageUrl = await this.getTelegramPhotoDataUrl(message.photo);
      const candidates = await this.aiExtractor.extractFromContent({
        text: message.caption || "",
        imageUrl,
        sourceUrl: ""
      });

      if (!candidates.length) {
        await this.sendMessage(chatId, "На скрине не нашла понятных мест. Можешь прислать город или подпись рядом текстом?");
        return;
      }

      const result = await this.store.addPlaces(user.id, candidates);
      await this.sendMessage(chatId, savedText(result, this.mapUrl(user)), this.mapKeyboard(user));
    } catch (error) {
      await this.sendMessage(chatId, `Не получилось распознать скрин: ${error.message}`);
    }
  }

  async getTelegramPhotoDataUrl(photos) {
    const photo = [...photos].sort((a, b) => (b.file_size || 0) - (a.file_size || 0))[0];
    const file = await this.call("getFile", { file_id: photo.file_id });
    const response = await fetch(`https://api.telegram.org/file/bot${this.token}/${file.file_path}`);
    if (!response.ok) throw new Error(`Telegram file HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const mimeType = file.file_path?.endsWith(".png") ? "image/png" : "image/jpeg";
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${mimeType};base64,${base64}`;
  }

  mapUrl(user) {
    return `${this.webappUrl}/u/${user.token}`;
  }

  mapKeyboard(user) {
    return {
      reply_markup: {
        inline_keyboard: [[{ text: "Открыть карту", url: this.mapUrl(user) }]]
      }
    };
  }

  async sendMessage(chatId, text, extra = {}) {
    return this.call("sendMessage", {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...extra
    });
  }

  async call(method, payload) {
    const response = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    if (!json.ok) throw new Error(json.description || `Telegram API error: ${method}`);
    return json.result;
  }
}

function startText(mapUrl) {
  return [
    "Привет. Я собираю travel-сохраненки в карту.",
    "",
    "Кидай мне место, ссылку или список. Например:",
    "`Будапешт: New York Cafe, Fisherman's Bastion`",
    "`Pink Mamma, Paris`",
    "",
    `Твоя карта: ${mapUrl}`
  ].join("\n");
}

function helpText() {
  return [
    "Как лучше присылать места:",
    "",
    "`Город: место 1, место 2`",
    "`место, город`",
    "`ссылка + подпись своими словами`",
    "",
    "Если это скрин или рилс без текста, добавь хотя бы город. AI-распознавание скринов подключим следующим шагом."
  ].join("\n");
}

function noCandidatesText() {
  return [
    "Я пока не поняла, что сохранить.",
    "",
    "Попробуй так:",
    "`Стамбул: Hafiz Mustafa`",
    "или",
    "`New York Cafe, Будапешт`"
  ].join("\n");
}

function savedText(result, mapUrl, notes = []) {
  const lines = [];
  if (result.added.length) {
    lines.push(`Сохранила: ${result.added.length}`);
    lines.push(...result.added.map((place) => `• ${place.title} · ${place.city}`));
  }
  if (result.duplicates.length) {
    lines.push("");
    lines.push(`Уже было в карте: ${result.duplicates.length}`);
  }
  if (notes.length) {
    lines.push("");
    lines.push(...notes.slice(0, 3));
  }
  lines.push("");
  lines.push(`Карта: ${mapUrl}`);
  return lines.join("\n");
}

function instagramFallbackText(notes) {
  return [
    "Я увидела Instagram-ссылку, но не смогла достать из неё место.",
    "",
    ...notes.slice(0, 3),
    "",
    "Что можно сделать сейчас:",
    "1. Пришли подпись к посту текстом.",
    "2. Или пришли скрин с названием места.",
    "3. Или напиши так: Город: название места."
  ].join("\n");
}

function isUsefulCandidate(candidate) {
  if (!candidate?.title) return false;
  if (candidate.title === "Место из ссылки") return false;
  if (candidate.city === "Нужно уточнить" && candidate.confidence < 0.5) return false;
  return true;
}

function citiesText(user) {
  const counts = new Map();
  for (const place of user.places) counts.set(place.city, (counts.get(place.city) || 0) + 1);
  if (!counts.size) return "Пока нет городов. Пришли первое место.";
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([city, count]) => `${city}: ${count}`)
    .join("\n");
}

function placesText(user) {
  if (!user.places.length) return "Пока нет мест. Пришли мне ссылку или название.";
  return user.places
    .slice(0, 10)
    .map((place) => `• ${place.title} · ${place.city}`)
    .join("\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
