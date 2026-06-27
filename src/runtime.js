import { config } from "./config.js";
import { Store } from "./storage.js";
import { SupabaseStore } from "./supabase-store.js";
import { TelegramBot } from "./telegram.js";
import { AiPlaceExtractor } from "./ai-extractor.js";

export async function createRuntime() {
  const store = createStore();
  await store.load();

  const aiExtractor = new AiPlaceExtractor({
    apiKey: config.openaiApiKey,
    model: config.openaiModel
  });

  const bot = new TelegramBot({
    token: config.botToken,
    store,
    webappUrl: config.webappUrl,
    aiExtractor
  });

  return { config, store, bot };
}

export function createStore() {
  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    return new SupabaseStore({
      url: config.supabaseUrl,
      serviceRoleKey: config.supabaseServiceRoleKey
    });
  }

  return new Store(config.dataFile);
}

export function serializeUser(user) {
  return {
    firstName: user.firstName,
    username: user.username,
    createdAt: user.createdAt,
    places: user.places.map((place) => ({
      ...place,
      mapsUrl: googleMapsUrl(place)
    }))
  };
}

export function googleMapsUrl(place) {
  const query = [place.title, place.city !== "Нужно уточнить" ? place.city : ""].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
