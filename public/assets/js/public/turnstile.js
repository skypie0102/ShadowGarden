/* Shared explicit-widget loader; callers own verification policy and UI. */
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading = null;

export function loadTurnstile() {
  if (window.turnstile?.render) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-sg-turnstile]");
    const script = existing || document.createElement("script");
    const cleanup = () => {
      script.removeEventListener("load", ready);
      script.removeEventListener("error", failed);
    };
    const failed = () => {
      cleanup();
      script.remove();
      reject(new Error("Human verification could not be loaded."));
    };
    const ready = () => {
      cleanup();
      if (window.turnstile?.render) resolve(window.turnstile);
      else {
        script.remove();
        reject(new Error("Human verification did not initialize."));
      }
    };
    script.addEventListener("load", ready, { once: true });
    script.addEventListener("error", failed, { once: true });
    if (!existing) {
      script.src = TURNSTILE_SCRIPT;
      script.async = true;
      script.defer = true;
      script.dataset.sgTurnstile = "1";
      document.head.appendChild(script);
    }
  }).catch(error => {
    loading = null;
    throw error;
  });
  return loading;
}
