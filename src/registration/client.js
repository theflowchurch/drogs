import { createClient } from "@supabase/supabase-js";
import people from "./reference-people.json";
const references = people.filter((p) => p.role === "bishop");
import {
  STORAGE_KEY,
  emptyState,
  applyAction,
  visibleState,
  normalEmail,
} from "./model.mjs";
const mode = process.env.NEXT_PUBLIC_REGISTRATION_BACKEND;
const mysqlBackend = mode === "mysql";
const url = mysqlBackend || mode === "demo" ? "" : process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = mysqlBackend || mode === "demo" ? "" : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const live = mysqlBackend || Boolean(url && key);
async function server(path, body, options = {}) {
  const response = await fetch(`/api/registration/${path}`, {
    credentials: "same-origin", cache: "no-store",
    ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    ...options,
  });
  let data;
  try { data = await response.json(); } catch { throw Error("The registration server is unavailable. Please try again shortly."); }
  if (!response.ok) throw Error(data.error || "Unable to complete the request.");
  return data;
}
export const configError = Boolean(url) !== Boolean(key) || (mode === "supabase" && !url);
let client;
const supabase = () =>
  client ||
  (client = createClient(url, key, {
    auth: { storageKey: "drogs-registration-auth" },
  }));
// Member and office sessions are separate on this device, like their cookies would be.
const sessionKey = (office) =>
  `drogs-registration-demo-account:${office ? "office" : "member"}`;
// Once an account exists on this device, signing in again should not ask for
// the email a second time. In connected mode the session cookie does this and
// a new sign-in still needs the one-time code; only the demo remembers locally.
const rememberedKey = (office) =>
  `drogs-registration-demo-remembered:${office ? "office" : "member"}`;
const read = () =>
  JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || emptyState();
function mediaDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("drogs-registration-media", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function fileOperation(mode, fn) {
  const db = await mediaDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("files", mode);
      const request = fn(tx.objectStore("files"));
      let value;
      request.onsuccess = () => {
        value = request.result;
      };
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || Error("Unable to save the file."));
    });
  } finally {
    db.close();
  }
}
function check(error) {
  if (error) throw Error(error.message);
}
export async function currentActor(office = false) {
  if (mysqlBackend) return server("auth/me");
  if (configError)
    throw Error("Both Supabase URL and public key must be configured.");
  if (!live)
    return JSON.parse(
      sessionStorage.getItem(sessionKey(office)) ||
        localStorage.getItem(rememberedKey(office)) ||
        "null",
    );
  const { data, error } = await supabase().auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
}
export async function requestCode(email) {
  if (mysqlBackend) return server("auth/request", { email });
  const { error } = await supabase().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  check(error);
}
export async function verifyCode(email, token) {
  if (mysqlBackend) return server("auth/verify", { email, token });
  const { data, error } = await supabase().auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  check(error);
  return { id: data.user.id, email: data.user.email };
}
export const accessWithCode = (code, office = false) => mysqlBackend
  ? server("auth/access", { code, office })
  : null;
export function demoSignIn(email, office = false) {
  email = normalEmail(email);
  const p = read().profiles.find((p) => normalEmail(p.email) === email);
  const actor = { id: p?.id || crypto.randomUUID(), email, office };
  sessionStorage.setItem(sessionKey(office), JSON.stringify(actor));
  localStorage.setItem(rememberedKey(office), JSON.stringify(actor));
  return actor;
}
// Signing out deliberately forgets the account; the idle lock only ends the
// session, so the entrance password is asked for again but the account is not.
export async function signOut(office = false, forget = true) {
  if (mysqlBackend) return server("auth/signout", {});
  if (live) {
    const { error } = await supabase().auth.signOut();
    check(error);
  } else {
    sessionStorage.removeItem(sessionKey(office));
    if (forget) localStorage.removeItem(rememberedKey(office));
  }
}
export async function snapshot(actor) {
  if (mysqlBackend) return server("snapshot");
  if (!live) return visibleState(read(), actor, references, people);
  const { data, error } = await supabase().rpc("registration_snapshot");
  check(error);
  return data;
}
export async function action(actor, name, payload) {
  if (mysqlBackend) return server("action", { name, payload });
  if (live) {
    const { error } = await supabase().rpc("registration_action", {
      action_name: name,
      payload,
    });
    check(error);
    return;
  }
  const write = () => {
    const state = applyAction(read(), actor, name, payload);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event("registration-change"));
  };
  if (navigator.locks) await navigator.locks.request(STORAGE_KEY, write);
  else write();
}
export async function upload(actor, file, kind = "portrait") {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Choose a JPG, PNG or WebP image.");
  if (file.size > 5 * 1024 * 1024)
    throw Error("Choose an image smaller than 5 MB.");
  const image = await createImageBitmap(file);
  if (!image.width || !image.height)
    throw Error("This image could not be opened.");
  image.close();
  if (mysqlBackend) {
    const result = await server(`upload?kind=${encodeURIComponent(kind)}`, undefined, {
      method: "POST", headers: { "Content-Type": file.type }, body: file,
    });
    return result.path;
  }
  const path = `${actor.id}/${kind}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
  if (live) {
    const { error } = await supabase()
      .storage.from("registration-media")
      .upload(path, file, { contentType: file.type, upsert: false });
    check(error);
  } else await fileOperation("readwrite", (store) => store.put(file, path));
  return path;
}
export async function mediaUrl(path) {
  if (!path) return "";
  if (mysqlBackend) return (await server(`media?path=${encodeURIComponent(path)}`)).url;
  if (live) {
    const { data, error } = await supabase()
      .storage.from("registration-media")
      .createSignedUrl(path, 3600);
    check(error);
    return data.signedUrl;
  }
  const file = await fileOperation("readonly", (store) => store.get(path));
  return file ? URL.createObjectURL(file) : "";
}
export const referenceImage = (role) =>
  `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/${role === "bishop" ? "assets/brand/bishop-example.jpg" : "assets/pastors/reconciled-5.webp"}`;

// Card and mobile-money payments through Paystack. The public key is baked in
// at build time; the server verifies every reference with the secret key.
export const paystackKey = mysqlBackend
  ? process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || ""
  : "";
export const paystackVerify = (reference) =>
  server("paystack/verify", { reference });

export const apiKeysAvailable = mysqlBackend;
export const listKeys = () => server('keys');
export const issueKey = input => server('keys', input);
export const revokeKey = id => server('keys/revoke', { id });

export const accounts = (search = '', page = 1) => server(`accounts?search=${encodeURIComponent(search)}&page=${page}`);
export const logins = (user, before = '') => server(`logins?user=${encodeURIComponent(user)}&before=${encodeURIComponent(before)}`);

export const supportAvailable = mysqlBackend;
export const settingsAvailable = mysqlBackend;
export const listSettings = () => server('settings');
export const saveSettings = values => server('settings', { values });
const SUPPORT_KEY = "drogs-registration-support";
// In the demo nothing leaves the browser; the report is kept so the flow can be
// checked end to end without pretending an email was sent.
export async function reportIssue(actor, input) {
  if (mysqlBackend) return server("support", input);
  const saved = JSON.parse(localStorage.getItem(SUPPORT_KEY) || "[]");
  saved.push({ ...input, actor: actor?.email || "", at: new Date().toISOString() });
  localStorage.setItem(SUPPORT_KEY, JSON.stringify(saved.slice(-50)));
  return { ok: true, delivered: false };
}
