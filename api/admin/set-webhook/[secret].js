import { createRuntime } from "../../../src/runtime.js";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { config, bot } = await createRuntime();
    if (req.query.secret !== config.webhookSecret) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!config.webappUrl.startsWith("https://")) {
      return res.status(400).json({ error: "WEBAPP_URL must be an HTTPS URL" });
    }

    const webhookUrl = `${config.webappUrl.replace(/\/$/, "")}/api/telegram/webhook/${config.webhookSecret}`;
    await bot.setWebhook(webhookUrl);

    return res.status(200).json({
      ok: true,
      webhookUrl
    });
  } catch (error) {
    console.error("Set webhook error:", error);
    return res.status(500).json({ error: "Internal error" });
  }
}
