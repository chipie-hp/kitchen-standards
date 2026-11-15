// Vercel function: photo evidence in a PRIVATE Supabase Storage bucket (bsg-evidence). Staff PIN is checked first.
const L = require("./_lib");
const BUCKET = "bsg-evidence";
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!L.configured()) return res.status(500).json({ error: "Server is not configured (add the Vercel environment variables)" });
  let b;
  try { b = L.body(req); } catch (e) { return res.status(400).json({ error: "Bad request" }); }
  const name = String(b.name || "");
  if (!/^[\w\-\/.]+$/.test(name) || name.includes("..") || name.startsWith("/")) return res.status(400).json({ error: "Bad request" });
  try {
    const row = await L.load();
    if (!row || !L.userOk(row.data, b.uid, b.pin)) { await L.sleep(600); return res.status(401).json({ error: "Wrong PIN" }); }
    const svc = { apikey: L.key(), Authorization: "Bearer " + L.key() };
    if (b.op === "upload") {
      if (!b.b64 || b.b64.length > 1500000) return res.status(413).json({ error: "Photo too large" });
      const up = await fetch(`${L.base()}/storage/v1/object/${BUCKET}/${name}`, { method: "POST", headers: { ...svc, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: Buffer.from(b.b64, "base64") });
      if (!up.ok) return res.status(502).json({ error: "Upload failed: " + (await up.text()) });
      return res.status(200).json({ ok: true });
    }
    if (b.op === "sign") {
      const sg = await fetch(`${L.base()}/storage/v1/object/sign/${BUCKET}/${name}`, { method: "POST", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 3600 }) });
      if (!sg.ok) return res.status(404).json({ error: "Photo not found" });
      const j = await sg.json();
      return res.status(200).json({ url: `${L.base()}/storage/v1${j.signedURL}` });
    }
    return res.status(400).json({ error: "Bad request" });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
