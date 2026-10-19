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
  return writeChanges([{key, value: () => JSON.stringify(value)}]);
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
  return writeChanges([{key, value: () => String(value)}]);
}

export function removeKey(key) {
  return writeChanges([{key, value: null}]);
}

// Web Storage is atomic per key, not per group. Read every original before any
// write; on failure restore only values still owned by this attempt. Another
// tab's later value must never be overwritten by rollback. A browser that also
// refuses rollback can still leave a partial update; callers always get false.
export function writeChanges(changes) {
  let target;
  const applied = [];
  try {
    target = storage();
    if (!target) return false;
    const planned = [...new Map(changes.map(change => [String(change.key), change])).entries()].map(([key, change]) => {
      const before = target.getItem(key);
      const after = typeof change.value === "function" ? change.value(before) : change.value;
      if (after !== null && typeof after !== "string") throw new TypeError("Invalid browser storage value");
      return {key, before, after};
    });
    for (const entry of planned) {
      if (target.getItem(entry.key) !== entry.before) throw new Error("Browser data changed during save");
      if (entry.before === entry.after) continue;
      if (entry.after === null) target.removeItem(entry.key);
      else target.setItem(entry.key, entry.after);
      applied.push(entry);
    }
    if (planned.some(entry => target.getItem(entry.key) !== entry.after)) throw new Error("Browser data changed during save");
    return true;
  } catch (error) {
    // Release newly added records first so restoring larger originals has room.
    const undo = [...applied.filter(entry => entry.before === null), ...applied.filter(entry => entry.before !== null).reverse()];
    let restored = true;
    for (const entry of undo) {
      try {
        if (target.getItem(entry.key) !== entry.after) continue;
        if (entry.before === null) target.removeItem(entry.key);
        else target.setItem(entry.key, entry.before);
      } catch { restored = false; }
    }
    console.warn("Shadow Garden could not persist browser data", error);
    if (!restored) console.warn("Shadow Garden could not restore all browser data after a failed save");
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
