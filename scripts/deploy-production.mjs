import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { captureProductionBaseline } from "./production-baseline.mjs";
import { validateProductionBaseline, verifyProduction } from "./verify-production.mjs";

export const PRODUCTION = {
  accountId: "fa95f62f96a0ff3b92a45175d94a48b6",
  projectName: "shadowgarden",
  databaseId: "1a9d28bf-fe1b-46d5-afbf-47ae9e0ffb86"
};
const projectPath = `/accounts/${PRODUCTION.accountId}/pages/projects/${PRODUCTION.projectName}`;
const queryPath = `/accounts/${PRODUCTION.accountId}/d1/database/${PRODUCTION.databaseId}/query`;
const baselineQuery =
  "SELECT revision,document,updated_at FROM library_state WHERE id=1; SELECT id,created_at,sha256,document FROM snapshots ORDER BY id;";
const requireValue = (condition, message) => {
  if (!condition) throw Error(message);
};

export function assertDeploymentContext(env, config, head, dirty) {
  requireValue(
    env.GITHUB_ACTIONS === "true" &&
      env.GITHUB_REPOSITORY === "skypie0102/ShadowGarden" &&
      env.GITHUB_REF === "refs/heads/main" &&
      ["push", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME),
    "Production deployment requires this repository main workflow."
  );
  requireValue(
    /^[a-f0-9]{40}$/.test(env.GITHUB_SHA || "") && head === env.GITHUB_SHA && !dirty,
    "Production source must be the clean checked workflow commit."
  );
  requireValue(
    env.CLOUDFLARE_ACCOUNT_ID === PRODUCTION.accountId &&
      config.name === PRODUCTION.projectName &&
      config.d1_databases?.find(binding => binding.binding === "DB")?.database_id ===
        PRODUCTION.databaseId,
    "Production account, project or DB differs from the existing live site."
  );
  requireValue(
    typeof env.CLOUDFLARE_API_TOKEN === "string" &&
      env.CLOUDFLARE_API_TOKEN.length > 0 &&
      !/\s/.test(env.CLOUDFLARE_API_TOKEN),
    "Set the production CLOUDFLARE_API_TOKEN Actions secret before deployment."
  );
}

// The baseline adapter can only read this project and issue the collector's
// fixed SELECT batch. Publishing is delegated separately to pinned Wrangler.
export function createProductionReader(apiToken, fetchImpl = fetch) {
  return async options => {
    const projectRead = options.method === "GET" && options.path === projectPath && !options.body;
    const databaseRead =
      options.method === "POST" &&
      options.path === queryPath &&
      options.body?.sql === baselineQuery &&
      Object.keys(options.body).length === 1;
    requireValue(projectRead || databaseRead, "Unexpected production baseline request.");
    const response = await fetchImpl("https://api.cloudflare.com/client/v4" + options.path, {
      method: options.method,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
      ...(databaseRead ? { body: JSON.stringify(options.body) } : {})
    });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw Error(`Cloudflare baseline read returned HTTP ${response.status}.`);
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw Error("Cloudflare baseline read returned invalid JSON.");
    }
    requireValue(payload?.success === true, "Cloudflare baseline read was unsuccessful.");
    if (projectRead)
      requireValue(
        payload.result?.name === PRODUCTION.projectName &&
          payload.result?.production_branch === "main",
        "The existing live Pages project must use production branch main."
      );
    return { ...payload, status: response.status };
  };
}

export function reviewedAssets(paths) {
  const files = [
    ...new Set(
      paths
        .filter(path => /^public\/assets\/[A-Za-z0-9_./-]+\.(js|css)$/.test(path))
        .map(path => path.slice("public/".length))
    )
  ];
  requireValue(
    files.every(path => !path.split("/").some(part => !part || part === "." || part === "..")),
    "Invalid changed asset path."
  );
  requireValue(
    files.length <= 100,
    "More than 100 assets changed; review a larger release explicitly."
  );
  // Backend/configuration-only releases still check one stable public module.
  return files.length ? files : ["assets/js/library-footer-version.js"];
}

export async function waitForProduction(
  request,
  source,
  { sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 36 } = {}
) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await request({ method: "GET", path: projectPath });
    const deployment = response.result?.canonical_deployment;
    if (deployment?.deployment_trigger?.metadata?.commit_hash === source) {
      if (deployment.latest_stage?.status === "success") return;
      if (["failure", "canceled"].includes(deployment.latest_stage?.status))
        throw Error("Production deployment did not succeed.");
    }
    if (attempt + 1 < attempts) await sleep(5000);
  }
  throw Error("The checked source did not become canonical production in time.");
}

export async function deployAndVerify({
  capture,
  config,
  source,
  version,
  distDir,
  files,
  deploy,
  waitForCanonical,
  saveBaseline = async () => {},
  fetchImpl = fetch,
  sleep,
  clock,
  now = () => Date.now()
}) {
  const before = await capture();
  validateProductionBaseline(before, config, { now: now() });
  const selectedFiles = typeof files === "function" ? await files(before) : files;
  await saveBaseline("before", before);
  await deploy(before);
  await waitForCanonical();
  const after = await capture();
  await saveBaseline("after", after);
  const report = await verifyProduction({
    baseline: after,
    before,
    config,
    distDir,
    version,
    source,
    files: selectedFiles,
    fetchImpl,
    now,
    waitForPreviousVersion: true,
    sleep,
    clock
  });
  return {
    ...report,
    rollbackDeploymentId: before.deployment.id,
    rollbackSource: before.deployment.source,
    beforeCheckedAt: before.checkedAt
  };
}

export async function main() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  process.chdir(root);
  const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
  const config = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
  const env = process.env,
    source = git("rev-parse", "HEAD");
  assertDeploymentContext(env, config, source, git("status", "--porcelain"));
  const version = JSON.parse(await readFile("package.json", "utf8")).version;
  const build = JSON.parse(await readFile("dist/data/version.json", "utf8"));
  requireValue(
    build.commit === source && build.branch === "main" && build.version === version,
    "Build does not match the checked main source."
  );
  const request = createProductionReader(env.CLOUDFLARE_API_TOKEN);
  const capture = () => captureProductionBaseline(request, PRODUCTION);
  await mkdir(".wrangler", { recursive: true });
  const report = await deployAndVerify({
    capture,
    config,
    source,
    version,
    distDir: resolve("dist"),
    files: before => {
      const changed = git(
        "diff",
        "--name-only",
        "--diff-filter=ACMR",
        before.deployment.source,
        source,
        "--",
        "public/assets"
      ).split("\n");
      return reviewedAssets(changed);
    },
    deploy: async () => {
      execFileSync(
        process.execPath,
        [
          resolve("node_modules/wrangler/bin/wrangler.js"),
          "pages",
          "deploy",
          "dist",
          "--project-name",
          PRODUCTION.projectName,
          "--branch",
          "main",
          "--commit-hash",
          source,
          "--commit-dirty=false"
        ],
        { stdio: "inherit", env: { ...env, WRANGLER_SEND_METRICS: "false" } }
      );
    },
    waitForCanonical: () => waitForProduction(request, source),
    saveBaseline: (stage, baseline) =>
      writeFile(`.wrangler/production-${stage}.json`, JSON.stringify(baseline) + "\n", {
        mode: 0o600
      })
  });
  await writeFile(".wrangler/production-verification.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
