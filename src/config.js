import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import crypto from "node:crypto";

function bool(value, fallback) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(srcDir, "..");
loadEnvFile(path.join(rootDir, ".env"));

export const config = {
  botToken: process.env.BOT_TOKEN || "",
  webappUrl: process.env.WEBAPP_URL || vercelUrl() || "http://127.0.0.1:8787",
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 8787),
  dataFile: path.resolve(rootDir, process.env.DATA_FILE || "./data/store.json"),
  runBot: bool(process.env.RUN_BOT, true),
  telegramMode: process.env.TELEGRAM_MODE || "polling",
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || tokenSecret(process.env.BOT_TOKEN || ""),
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
};

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

function tokenSecret(token) {
  if (!token) return "telegram-webhook";
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 32);
}

function vercelUrl() {
  if (!process.env.VERCEL_URL) return "";
  return `https://${process.env.VERCEL_URL}`;
}
