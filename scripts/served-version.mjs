const MAX_CHECKS = 12;
const DEADLINE_MS = 120_000;
const INTERVAL_MS = 5000;
const REQUEST_TIMEOUT_MS = 15_000;
const isRelease = value =>
  value &&
  typeof value.version === "string" &&
  /^\d+\.\d+\.\d+$/.test(value.version) &&
  value.releaseVersion === value.version &&
  typeof value.commit === "string" &&
  /^[a-f0-9]{40}$/.test(value.commit) &&
  value.shortCommit === value.commit.slice(0, 7) &&
  value.branch === "main";

// Only a coherent response for the captured previous source may be retried.
// HTTP/JSON errors and every other release check stay outside this loop.
export async function verifyServedVersion(readVersion, {
  source,
  version,
  previousSource,
  waitForPreviousVersion = false,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  clock = () => performance.now()
}) {
  const started = clock();
  let attempts = 0;
  const elapsed = () => Math.max(0, clock() - started);
  const timedOut = () => Error(
    `Served previous production source did not converge after ${attempts} version checks ` +
    `(${Math.round(elapsed())} ms; expected ${source}, previous ${previousSource}).`
  );
  while (true) {
    const remaining = DEADLINE_MS - elapsed();
    if (remaining <= 0) throw timedOut();
    attempts++;
    const served = await readVersion(Math.min(REQUEST_TIMEOUT_MS, remaining));
    if (elapsed() >= DEADLINE_MS) throw timedOut();
    if (isRelease(served) && served.commit === source && served.version === version)
      return { attempts, elapsedMs: Math.round(elapsed()) };
    if (!waitForPreviousVersion || !isRelease(served) ||
        served.commit !== previousSource || previousSource === source)
      throw Error("Served version does not match canonical production source.");
    if (attempts >= MAX_CHECKS) throw timedOut();
    await sleep(Math.min(INTERVAL_MS, DEADLINE_MS - elapsed()));
  }
}
