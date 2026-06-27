import { createRuntime, serializeUser } from "../../../src/runtime.js";
import { extractPlaces } from "../../../src/extractor.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { store } = await createRuntime();
    const user = await store.getUserByToken(req.query.token);
    if (!user) return res.status(404).json({ error: "Not found" });

    const candidates = extractPlaces(req.body?.text || "");
    const result = await store.addPlaces(user.id, candidates);
    const updated = await store.getUserByToken(req.query.token);

    return res.status(200).json({
      added: result.added,
      duplicates: result.duplicates,
      user: serializeUser(updated)
    });
  } catch (error) {
    console.error("Add places API error:", error);
    return res.status(500).json({ error: "Internal error" });
  }
}
