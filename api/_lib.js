// Shared helpers for the Vercel functions. Supabase keys come from Vercel environment variables only.
const base = () => (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const key = () => process.env.SUPABASE_SERVICE_KEY || "";
const org = () => process.env.BSG_ORG || "bsg";
// Old-style keys (service_role, start with "eyJ") are sent as apikey + Bearer; new-style keys (sb_secret_...) only as apikey.
const auth = () => (/^eyJ/.test(key()) ? { apikey: key(), Authorization: "Bearer " + key() } : { apikey: key() });
const hdr = (extra) => ({ ...auth(), "Content-Type": "application/json", ...(extra || {}) });
const configured = () => !!(base() && key());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function load() {
  const r = await fetch(`${base()}/rest/v1/bsg_state?org=eq.${encodeURIComponent(org())}&select=data,version`, { headers: hdr() });
  if (!r.ok) throw new Error("Database read failed");
  const j = await r.json();
  return j[0] || null;
}
// the logged-in staff PIN is the key: the user must exist in the stored data
function userOk(data, uid, pin) {
  const us = data && Array.isArray(data.users) ? data.users : [];
  return us.find((u) => String(u.id) === String(uid) && String(u.pin) === String(pin)) || null;
}
async function save(row, data, version) {
  if (!row) {
    const r = await fetch(`${base()}/rest/v1/bsg_state`, { method: "POST", headers: hdr({ Prefer: "resolution=ignore-duplicates,return=representation" }), body: JSON.stringify({ org: org(), data, version: 1 }) });
    if (!r.ok) throw new Error("Database write failed");
    const j = await r.json();
    return j.length ? 1 : null;
  }
  const r = await fetch(`${base()}/rest/v1/bsg_state?org=eq.${encodeURIComponent(org())}&version=eq.${version}`, {
    method: "PATCH", headers: hdr({ Prefer: "return=representation" }), body: JSON.stringify({ data, version: version + 1, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error("Database write failed");
  const j = await r.json();
  return j.length ? version + 1 : null; // null = someone else saved first
}
async function snapshot(data, version) {
  try {
    const q = await fetch(`${base()}/rest/v1/bsg_snapshots?org=eq.${encodeURIComponent(org())}&select=created_at&order=created_at.desc&limit=1`, { headers: hdr() });
    const j = q.ok ? await q.json() : [];
    if (j.length && Date.now() - new Date(j[0].created_at).getTime() < 3600 * 1000) return;
    await fetch(`${base()}/rest/v1/bsg_snapshots`, { method: "POST", headers: hdr(), body: JSON.stringify({ org: org(), version, data }) });
    const old = await fetch(`${base()}/rest/v1/bsg_snapshots?org=eq.${encodeURIComponent(org())}&select=id&order=created_at.desc&offset=300&limit=1`, { headers: hdr() });
    const o = old.ok ? await old.json() : [];
    if (o.length) await fetch(`${base()}/rest/v1/bsg_snapshots?org=eq.${encodeURIComponent(org())}&id=lte.${o[0].id}`, { method: "DELETE", headers: hdr() });
  } catch (e) { /* history is best effort */ }
}
const body = (req) => (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});
module.exports = { base, key, org, auth, hdr, configured, sleep, load, userOk, save, snapshot, body };
