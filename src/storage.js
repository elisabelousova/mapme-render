import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export class Store {
  constructor(file) {
    this.file = file;
    this.data = { users: {} };
    this.writeQueue = Promise.resolve();
  }

  async load() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      const raw = await fs.readFile(this.file, "utf8");
      this.data = JSON.parse(raw);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.save();
    }
  }

  async save() {
    this.writeQueue = this.writeQueue.then(async () => {
      const tmp = `${this.file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(this.data, null, 2));
      await fs.rename(tmp, this.file);
    });
    return this.writeQueue;
  }

  async getOrCreateUser(from) {
    const id = String(from.id);
    if (!this.data.users[id]) {
      this.data.users[id] = {
        id,
        token: crypto.randomBytes(18).toString("base64url"),
        firstName: from.first_name || "",
        username: from.username || "",
        createdAt: new Date().toISOString(),
        places: []
      };
    } else {
      this.data.users[id].firstName = from.first_name || this.data.users[id].firstName;
      this.data.users[id].username = from.username || this.data.users[id].username;
    }
    await this.save();
    return this.data.users[id];
  }

  async getUserByToken(token) {
    return Object.values(this.data.users).find((user) => user.token === token) || null;
  }

  async addPlaces(userId, places) {
    const user = this.data.users[String(userId)];
    if (!user) throw new Error("User not found");

    const added = [];
    const duplicates = [];
    for (const place of places) {
      const key = normalizeKey(place.title, place.city);
      const existing = user.places.find((saved) => saved.key === key);
      if (existing) {
        duplicates.push(existing);
        continue;
      }

      const saved = {
        id: crypto.randomUUID(),
        key,
        title: place.title,
        city: place.city,
        category: place.category || "place",
        note: "",
        sourceUrl: place.sourceUrl || "",
        rawText: place.rawText || "",
        confidence: place.confidence || 0.5,
        createdAt: new Date().toISOString()
      };
      user.places.unshift(saved);
      added.push(saved);
    }
    await this.save();
    return { added, duplicates };
  }

  async deleteUser(userId) {
    delete this.data.users[String(userId)];
    await this.save();
  }
}

export function normalizeKey(title, city) {
  return `${city || ""}:${title || ""}`
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^а-яa-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
