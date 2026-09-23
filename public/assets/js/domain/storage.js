/* Shadow Garden R2 — browser-local persistence primitives. */

function storage() {
  return globalThis.localStorage;
}

export function readJson(key, fallback = null) {
  try {
    const raw = storage()?.getItem(String(key));
    if (raw == null) return fallback;
    const value = JSON.parse(raw);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    storage()?.setItem(String(key), JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("Shadow Garden could not persist browser data", error);
    return false;
  }
}

export function readText(key, fallback = "") {
  try {
    const value = storage()?.getItem(String(key));
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeText(key, value) {
  try {
    storage()?.setItem(String(key), String(value));
    return true;
  } catch (error) {
    console.warn("Shadow Garden could not persist browser data", error);
    return false;
  }
}

export function removeKey(key) {
  try {
    storage()?.removeItem(String(key));
    return true;
  } catch (error) {
    console.warn("Shadow Garden could not remove browser data", error);
    return false;
  }
}

export function listKeys(prefix = "") {
  const wanted = String(prefix || "");
  try {
    const target = storage();
    if (!target) return [];
    const keys = [];
    for (let index = 0; index < target.length; index += 1) {
      const key = target.key(index);
      if (key && (!wanted || key.startsWith(wanted))) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

export function dispatchLocalEvent(type, detail) {
  try {
    if (typeof globalThis.dispatchEvent !== "function" || typeof globalThis.CustomEvent !== "function") return false;
    globalThis.dispatchEvent(new CustomEvent(type, { detail }));
    return true;
  } catch {
    return false;
  }
}
