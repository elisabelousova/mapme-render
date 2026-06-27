import { createRuntime, serializeUser } from "../../src/runtime.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { store } = await createRuntime();
    const user = await store.getUserByToken(req.query.token);
    if (!user) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(serializeUser(user));
  } catch (error) {
    console.error("User API error:", error);
    return res.status(500).json({ error: "Internal error" });
  }
}
