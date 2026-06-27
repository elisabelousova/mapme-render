import crypto from "node:crypto";
import { normalizeKey } from "./storage.js";

export class SupabaseStore {
  constructor({ url, serviceRoleKey }) {
    this.url = String(url || "").replace(/\/$/, "");
    this.serviceRoleKey = serviceRoleKey || "";
  }

  get enabled() {
    return Boolean(this.url && this.serviceRoleKey);
  }

  async load() {}

  async save() {}

  async getOrCreateUser(from) {
    this.assertEnabled();
    const telegramId = String(from.id);
    const existing = await this.getUserByTelegramId(telegramId);

    if (existing) {
      const patch = {
        first_name: from.first_name || existing.first_name || "",
        username: from.username || existing.username || ""
      };
      const [updated] = await this.request(
        `/rest/v1/users?telegram_id=eq.${encodeURIComponent(telegramId)}&select=*`,
        {
          method: "PATCH",
          body: patch,
          prefer: "return=representation"
        }
      );
      return this.mapUserWithPlaces(updated || existing, existing.places || []);
    }

    const token = crypto.randomBytes(18).toString("base64url");
    const [created] = await this.request("/rest/v1/users?select=*", {
      method: "POST",
      body: {
        telegram_id: telegramId,
        token,
        first_name: from.first_name || "",
        username: from.username || ""
      },
      prefer: "return=representation"
    });

    return this.mapUserWithPlaces(created, []);
  }

  async getUserByToken(token) {
    this.assertEnabled();
    const users = await this.request(
      `/rest/v1/users?token=eq.${encodeURIComponent(token)}&select=*&limit=1`
    );
    const user = users[0];
    if (!user) return null;
    const places = await this.getPlacesForUser(user.id);
    return this.mapUserWithPlaces(user, places);
  }

  async addPlaces(userId, places) {
    this.assertEnabled();
    const existing = await this.getPlacesForUser(userId);
    const existingByKey = new Map(existing.map((place) => [place.key, place]));
    const seenKeys = new Set(existingByKey.keys());
    const added = [];
    const duplicates = [];
    const rows = [];

    for (const place of places) {
      const key = normalizeKey(place.title, place.city);
      if (existingByKey.has(key)) {
        duplicates.push(this.mapPlace(existingByKey.get(key)));
        continue;
      }
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      rows.push({
        user_id: userId,
        key,
        title: place.title,
        city: place.city,
        category: place.category || "place",
        note: place.note || "",
        source_url: place.sourceUrl || "",
        raw_text: place.rawText || "",
        confidence: place.confidence || 0.5
      });
    }

    if (rows.length) {
      const created = await this.request("/rest/v1/places?select=*", {
        method: "POST",
        body: rows,
        prefer: "return=representation"
      });
      added.push(...created.map((place) => this.mapPlace(place)));
    }

    return { added, duplicates };
  }

  async deleteUser(userId) {
    this.assertEnabled();
    await this.request(`/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, {
      method: "DELETE"
    });
  }

  async getUserByTelegramId(telegramId) {
    const users = await this.request(
      `/rest/v1/users?telegram_id=eq.${encodeURIComponent(telegramId)}&select=*&limit=1`
    );
    const user = users[0];
    if (!user) return null;
    const places = await this.getPlacesForUser(user.id);
    return { ...user, places };
  }

  async getPlacesForUser(userId) {
    return this.request(
      `/rest/v1/places?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc`
    );
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.url}${path}`, {
      method: options.method || "GET",
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(options.prefer ? { Prefer: options.prefer } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase ${response.status}: ${text || response.statusText}`);
    }

    if (response.status === 204) return [];
    const text = await response.text();
    return text ? JSON.parse(text) : [];
  }

  mapUserWithPlaces(user, places) {
    return {
      id: user.id,
      token: user.token,
      firstName: user.first_name || "",
      username: user.username || "",
      createdAt: user.created_at,
      places: places.map((place) => this.mapPlace(place))
    };
  }

  mapPlace(place) {
    return {
      id: place.id,
      key: place.key,
      title: place.title,
      city: place.city,
      category: place.category || "place",
      note: place.note || "",
      sourceUrl: place.source_url || "",
      rawText: place.raw_text || "",
      confidence: Number(place.confidence || 0.5),
      createdAt: place.created_at
    };
  }

  assertEnabled() {
    if (!this.enabled) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    }
  }
}
