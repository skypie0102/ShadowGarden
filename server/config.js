// Existing deployment names were supplied by the owner; values stay in Cloudflare.
const aliases=Object.freeze({
  ADMIN_TOKEN:'SG_ADMIN_TOKEN',
  BOOK_SIGNING_SECRET:'SG_MEDIA_SIGNING_SECRET',
  TURNSTILE_SITE_KEY:'SG_TURNSTILE_SITE_KEY',
  TURNSTILE_SECRET_KEY:'SG_TURNSTILE_SECRET_KEY'
});

export function setting(env,name) {
  // An explicitly configured canonical value wins, including an invalid/empty
  // value. Do not silently reactivate an old credential after a bad rotation.
  return env[name]!==undefined?env[name]:aliases[name]?env[aliases[name]]:undefined;
}

export function storageCredentials(env,access) {
  const prefix=access==='read'?'B2_READ':'B2_WRITE';
  const id=env[`${prefix}_KEY_ID`],key=env[`${prefix}_APPLICATION_KEY`];
  // A role-specific pair is indivisible. Never mix it with the shared pair or
  // switch to write credentials when read credentials are missing/invalid.
  if(id!==undefined || key!==undefined)return {id,key};
  return {id:env.B2_APPLICATION_KEY_ID,key:env.B2_APPLICATION_KEY};
}
