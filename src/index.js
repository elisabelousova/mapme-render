import { config } from "./config.js";
import { createWebServer } from "./web.js";
import { createRuntime } from "./runtime.js";

const runtime = await createRuntime();
const bot = config.runBot ? runtime.bot : null;

const server = createWebServer({
  store: runtime.store,
  bot,
  webhookSecret: config.webhookSecret
});

server.listen(config.port, config.host, async () => {
  console.log(`Web app: http://${config.host}:${config.port}`);

  if (!bot) return;

  if (config.telegramMode === "webhook") {
    if (!config.webappUrl.startsWith("https://")) {
      console.log("WEBAPP_URL must be an HTTPS URL before Telegram webhook can be registered.");
      return;
    }

    const webhookUrl = `${config.webappUrl.replace(/\/$/, "")}/telegram/webhook/${config.webhookSecret}`;
    try {
      await bot.setWebhook(webhookUrl);
      console.log("Telegram webhook mode started.");
    } catch (error) {
      console.error("Telegram webhook registration failed:", error.message);
    }
    return;
  }

  await bot.deleteWebhook();
  bot.start();
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function shutdown() {
  console.log("Shutting down...");
  bot?.stop();
  server.close();
  await runtime.store.save();
  process.exit(0);
}
