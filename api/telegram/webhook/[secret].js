import { createRuntime } from "../../../../src/runtime.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { config, bot } = await createRuntime();
    if (req.query.secret !== config.webhookSecret) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await bot.handleUpdate(req.body);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return res.status(500).json({ error: "Internal error" });
  }
}
