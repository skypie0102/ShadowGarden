import { cleanIdentities, cleanIdentity, isBookId } from "../domain/book-identity.js";
import { readBookmarksAliases, writeBookmarksAliases } from "../domain/bookmarks.js";
import { progressForAliases, writeProgressAliases } from "../domain/progress.js";
import { readJson, writeJson } from "../domain/storage.js";

export const READER_SETTINGS_KEY = "sg-reader-settings";
export const LEGACY_GESTURE_SETTINGS_KEY = "sg-reader-polish-settings";

export function readJSON(key, fallback) {
  return readJson(key, fallback);
}

export function writeJSON(key, value) {
  return writeJson(key, value);
}

function storageDescriptor(input,options={}){
  if(input&&typeof input==="object"&&!Array.isArray(input)){
    return{
      sourceIdentity:input.sourceIdentity||input.sourcePath||input.bookUrl||"",
      publicIdentity:input.publicIdentity||input.publicBookId||""
    };
  }
  return{sourceIdentity:input||"",publicIdentity:options.publicIdentity||""};
}

export function createReaderStorage(input,options={}) {
  const descriptor=storageDescriptor(input,options);
  const sourceIdentity = cleanIdentity(descriptor.sourceIdentity) || "__missing__";
  const publicIdentity = cleanIdentity(descriptor.publicIdentity);
  const canonicalIdentity = isBookId(publicIdentity) ? publicIdentity : sourceIdentity;
  const aliases = cleanIdentities([sourceIdentity, canonicalIdentity]);

  return {
    identities: aliases,
    canonicalIdentity,
    loadProgress() {
      return progressForAliases(aliases);
    },
    saveProgress(value) {
      return writeProgressAliases(aliases, value, { canonicalIdentity });
    },
    loadBookmarks() {
      return readBookmarksAliases(aliases);
    },
    saveBookmarks(value) {
      return writeBookmarksAliases(aliases, Array.isArray(value) ? value : []);
    },
    loadSettings(defaults) {
      const main=readJson(READER_SETTINGS_KEY,{})||{};
      const legacy=readJson(LEGACY_GESTURE_SETTINGS_KEY,{})||{};
      return { ...defaults, ...main, swipeTurns: typeof main.swipeTurns==="boolean" ? main.swipeTurns : legacy.swipeTurns!==false };
    },
    saveSettings(value) {
      const saved=writeJson(READER_SETTINGS_KEY,value);
      const legacySaved=writeJson(LEGACY_GESTURE_SETTINGS_KEY,{swipeTurns:value?.swipeTurns!==false});
      return saved&&legacySaved;
    }
  };
}
