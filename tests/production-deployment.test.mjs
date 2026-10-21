import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PRODUCTION,
  assertDeploymentContext,
  createProductionReader,
  reviewedAssets,
  waitForProduction,
  deployAndVerify
} from "../scripts/deploy-production.mjs";
import { validateProductionBaseline } from "../scripts/verify-production.mjs";

const source = "b".repeat(40),
  previousSource = "a".repeat(40),
  stamp = new Date().toISOString();
const sha = value => createHash("sha256").update(value).digest("hex");
const config = {
  name: PRODUCTION.projectName,
  compatibility_date: "2026-09-23",
  vars: { B2_BUCKET_NAME: "fixture-bucket" },
  d1_databases: [{ binding: "DB", database_id: PRODUCTION.databaseId }]
};
const settings = {
  compatibility_date: config.compatibility_date,
  compatibility_flags: [],
  d1_databases: { DB: { id: PRODUCTION.databaseId } },
  env_vars: {
    B2_BUCKET_NAME: { type: "plain_text", value: "fixture-bucket" },
    SESSION_SECRET: { type: "secret_text" }
  }
};
const document = JSON.stringify({ main: [], adult: [], books: {}, trash: [] });
const before = {
  schemaVersion: 1,
  checkedAt: stamp,
  projectName: PRODUCTION.projectName,
  databaseId: PRODUCTION.databaseId,
  deployment: {
    id: "11111111-1111-1111-1111-111111111111",
    source: previousSource,
    environment: "production",
    status: "success"
  },
  actual: settings,
  saved: structuredClone(settings),
  database: {
    revision: 9,
    updatedAt: stamp,
    document,
    documentSha256: sha(document),
    snapshots: []
  },
  databaseWrites: 0
};
const after = {
  ...structuredClone(before),
  deployment: { ...before.deployment, id: "22222222-2222-2222-2222-222222222222", source }
};
const env = {
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "skypie0102/ShadowGarden",
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "push",
  GITHUB_SHA: source,
  CLOUDFLARE_ACCOUNT_ID: PRODUCTION.accountId,
  CLOUDFLARE_API_TOKEN: "disposable-test-token"
};
const projectPath = `/accounts/${PRODUCTION.accountId}/pages/projects/${PRODUCTION.projectName}`;
const queryPath = `/accounts/${PRODUCTION.accountId}/d1/database/${PRODUCTION.databaseId}/query`;
const sql =
  "SELECT revision,document,updated_at FROM library_state WHERE id=1; SELECT id,created_at,sha256,document FROM snapshots ORDER BY id;";

test("production credentials are limited to clean main pushes or explicit main retries", () => {
  assert.doesNotThrow(() => assertDeploymentContext(env, config, source, ""));
  assert.doesNotThrow(() =>
    assertDeploymentContext({ ...env, GITHUB_EVENT_NAME: "workflow_dispatch" }, config, source, "")
  );
  for (const change of [
    { GITHUB_ACTIONS: "false" },
    { GITHUB_REPOSITORY: "someone/ShadowGarden" },
    { GITHUB_REF: "refs/heads/audit" },
    { GITHUB_EVENT_NAME: "pull_request" },
    { GITHUB_EVENT_NAME: "pull_request_target" },
    { GITHUB_SHA: previousSource },
    { CLOUDFLARE_ACCOUNT_ID: "c".repeat(32) },
    { CLOUDFLARE_API_TOKEN: "" },
    { CLOUDFLARE_API_TOKEN: "unsafe\nvalue" }
  ])
    assert.throws(() => assertDeploymentContext({ ...env, ...change }, config, source, ""));
  assert.throws(() => assertDeploymentContext(env, config, source, " M public/index.html"));
  assert.throws(() =>
    assertDeploymentContext(env, { ...config, name: "shadowgarden-test" }, source, "")
  );
  assert.throws(() => assertDeploymentContext(env, { ...config, d1_databases: [] }, source, ""));
});

test("baseline adapter confines the token to the live project and fixed SELECT batch", async () => {
  const calls = [];
  const request = createProductionReader("disposable", async (url, options) => {
    calls.push({ url, options });
    return Response.json({
      success: true,
      result:
        options.method === "GET" ? { name: PRODUCTION.projectName, production_branch: "main" } : []
    });
  });
  await request({ method: "GET", path: projectPath });
  await request({ method: "POST", path: queryPath, body: { sql } });
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.ok(
      call.url.startsWith(
        "https://api.cloudflare.com/client/v4/accounts/" + PRODUCTION.accountId + "/"
      )
    );
    assert.equal(call.options.headers.authorization, "Bearer disposable");
    assert.equal(call.options.redirect, "manual");
    assert.ok(call.options.signal instanceof AbortSignal);
  }
  assert.equal(calls[1].options.body, JSON.stringify({ sql }));
});

test("baseline adapter refuses writes, another resource and unexpected parameters before fetching", async () => {
  let calls = 0;
  const request = createProductionReader("disposable", async () => {
    calls++;
  });
  for (const options of [
    { method: "DELETE", path: projectPath },
    { method: "GET", path: projectPath + "/deployments" },
    { method: "GET", path: "https://untrusted.invalid" },
    { method: "POST", path: queryPath, body: { sql: "DELETE FROM library_state" } },
    { method: "POST", path: queryPath, body: { sql, params: [] } },
    {
      method: "POST",
      path: queryPath.replace(PRODUCTION.databaseId, "another-database"),
      body: { sql }
    }
  ])
    await assert.rejects(request(options), /Unexpected/);
  assert.equal(calls, 0);
});

test("Cloudflare HTTP errors, malformed JSON and API failures cannot become valid baselines", async () => {
  for (const response of [
    () => new Response(null, { status: 302, headers: { location: "https://untrusted.invalid" } }),
    () => new Response("private upstream detail", { status: 403 }),
    () => new Response("<html>login</html>"),
    () => Response.json({ success: false, errors: [{ message: "private upstream detail" }] })
  ]) {
    const request = createProductionReader("disposable", async () => response());
    await assert.rejects(
      request({ method: "GET", path: projectPath }),
      error =>
        !error.message.includes("private upstream detail") && !error.message.includes("disposable")
    );
  }
});

test("a test Pages project or different production branch cannot pass the baseline adapter", async () => {
  for (const result of [
    { name: "shadowgarden-test", production_branch: "main" },
    { name: PRODUCTION.projectName, production_branch: "legacy" }
  ])
    await assert.rejects(
      createProductionReader("disposable", async () => Response.json({ success: true, result }))({
        method: "GET",
        path: projectPath
      }),
      /live Pages project/
    );
});

test("changed asset selection includes JS/CSS, deduplicates and uses a stable backend-only check", () => {
  assert.deepEqual(
    reviewedAssets([
      "public/assets/js/library.js",
      "server/state.js",
      "public/assets/js/library.js",
      "public/assets/css/site.css"
    ]),
    ["assets/js/library.js", "assets/css/site.css"]
  );
  assert.deepEqual(reviewedAssets(["server/state.js"]), ["assets/js/library-footer-version.js"]);
  assert.throws(() => reviewedAssets(["public/assets/../private.js"]), /Invalid/);
  assert.throws(
    () => reviewedAssets(Array.from({ length: 101 }, (_, i) => `public/assets/js/file${i}.js`)),
    /100/
  );
});

test("canonical deployment wait ignores previous source and waits for checked-source success", async () => {
  const steps = [
      { source: previousSource, status: "success" },
      { source, status: "active" },
      { source, status: "success" }
    ],
    delays = [];
  await waitForProduction(
    async () => {
      const step = steps.shift();
      return {
        result: {
          canonical_deployment: {
            deployment_trigger: { metadata: { commit_hash: step.source } },
            latest_stage: { status: step.status }
          }
        }
      };
    },
    source,
    {
      sleep: async ms => {
        delays.push(ms);
      },
      attempts: 3
    }
  );
  assert.deepEqual(delays, [5000, 5000]);
  assert.equal(steps.length, 0);
});

test("failed and timed-out canonical deployments never report success", async () => {
  for (const status of ["failure", "canceled"])
    await assert.rejects(
      waitForProduction(
        async () => ({
          result: {
            canonical_deployment: {
              deployment_trigger: { metadata: { commit_hash: source } },
              latest_stage: { status }
            }
          }
        }),
        source
      ),
      /did not succeed/
    );
  let calls = 0;
  await assert.rejects(
    waitForProduction(
      async () => {
        calls++;
        return { result: {} };
      },
      source,
      { attempts: 2, sleep: async () => {} }
    ),
    /in time/
  );
  assert.equal(calls, 2);
});

async function fixture(t) {
  const distDir = await mkdtemp(join(tmpdir(), "sg-auto-deploy-"));
  t.after(() => rm(distDir, { recursive: true, force: true }));
  await mkdir(join(distDir, "data"));
  await mkdir(join(distDir, "assets/js"), { recursive: true });
  const version = {
    version: "2.18.1",
    releaseVersion: "2.18.1",
    commit: source,
    shortCommit: source.slice(0, 7),
    branch: "main"
  };
  await writeFile(join(distDir, "data/version.json"), JSON.stringify(version));
  await writeFile(join(distDir, "assets/js/changed.js"), "reviewed\n");
  const catalogs = validateProductionBaseline(after, config),
    events = [];
  let captures = 0;
  const responses = new Map([
    ["/data/version.json", () => Response.json(version)],
    ["/media/shadow-garden/data/catalog.json", () => Response.json(catalogs.main)],
    ["/media/shadow-garden/data/adult-catalog.json", () => Response.json(catalogs.adult)],
    [
      "/assets/js/changed.js",
      () => new Response("reviewed\n", { headers: { "content-type": "application/javascript" } })
    ]
  ]);
  const options = {
    config,
    source,
    version: "2.18.1",
    distDir,
    files: ["assets/js/changed.js"],
    capture: async () => {
      events.push("capture");
      return structuredClone(captures++ ? after : before);
    },
    saveBaseline: async stage => {
      events.push("save-" + stage);
    },
    deploy: async () => {
      events.push("deploy");
    },
    waitForCanonical: async () => {
      events.push("canonical");
    },
    fetchImpl: async url => {
      events.push("public-get");
      return responses.get(new URL(url).pathname)();
    }
  };
  return { options, events, responses };
}

test("automatic publication captures and preserves state, waits for production and verifies served bytes", async t => {
  const { options, events } = await fixture(t),
    report = await deployAndVerify({
      ...options,
      files: baseline => {
        assert.equal(baseline.deployment.source, previousSource);
        assert.deepEqual(events, ["capture"]);
        return options.files;
      }
    });
  assert.deepEqual(events.slice(0, 6), [
    "capture",
    "save-before",
    "deploy",
    "canonical",
    "capture",
    "save-after"
  ]);
  assert.equal(report.preservationChecked, true);
  assert.equal(report.checks.length, 4);
  assert.equal(report.rollbackDeploymentId, before.deployment.id);
  assert.equal(report.source, source);
  assert.equal(JSON.stringify(report).includes("SESSION_SECRET"), false);
});

test("invalid before-state blocks publication and all public requests", async t => {
  const { options, events } = await fixture(t);
  const damaged = structuredClone(before);
  damaged.database.document += " ";
  await assert.rejects(deployAndVerify({ ...options, capture: async () => damaged }), /checksum/);
  assert.deepEqual(events, []);
});

test("failed upload or canonical wait cannot proceed to after-state acceptance", async t => {
  for (const stage of ["deploy", "waitForCanonical"]) {
    const { options, events } = await fixture(t);
    await assert.rejects(
      deployAndVerify({
        ...options,
        [stage]: async () => {
          throw Error("disposable failure");
        }
      }),
      /disposable failure/
    );
    assert.equal(events.filter(event => event === "capture").length, 1);
    assert.equal(events.includes("public-get"), false);
  }
});

test("changed database or configuration after publication fails preservation before public acceptance", async t => {
  for (const edit of [
    value => value.database.revision++,
    value => {
      value.actual.env_vars.NEW_SECRET = { type: "secret_text" };
      value.saved.env_vars.NEW_SECRET = { type: "secret_text" };
    }
  ]) {
    const { options, events } = await fixture(t);
    const changed = structuredClone(after);
    edit(changed);
    let count = 0;
    await assert.rejects(
      deployAndVerify({
        ...options,
        capture: async () => structuredClone(count++ ? changed : before)
      }),
      /changed/
    );
    assert.equal(events.includes("public-get"), false);
  }
});

test("wrong served asset bytes fail the post-publication check", async t => {
  const { options, responses } = await fixture(t);
  responses.set(
    "/assets/js/changed.js",
    () => new Response("different", { headers: { "content-type": "application/javascript" } })
  );
  await assert.rejects(deployAndVerify(options), /Served asset/);
});
