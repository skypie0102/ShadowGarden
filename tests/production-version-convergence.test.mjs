import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deployAndVerify, PRODUCTION } from "../scripts/deploy-production.mjs";
import { verifyProduction, validateProductionBaseline } from "../scripts/verify-production.mjs";
import { verifyServedVersion } from "../scripts/served-version.mjs";

async function fixture(t) {
  const source = "b".repeat(40), previousSource = "a".repeat(40);
  const stamp = new Date().toISOString();
  const config = {
    name: PRODUCTION.projectName,
    compatibility_date: "2026-09-23",
    d1_databases: [{ binding: "DB", database_id: PRODUCTION.databaseId }]
  };
  const settings = {
    compatibility_date: config.compatibility_date, compatibility_flags: [],
    d1_databases: { DB: { id: PRODUCTION.databaseId } }, env_vars: {}
  };
  const document = JSON.stringify({ main: [], adult: [], books: {}, trash: [] });
  const before = {
    schemaVersion: 1, checkedAt: stamp,
    projectName: PRODUCTION.projectName, databaseId: PRODUCTION.databaseId,
    deployment: {
      id: "11111111-1111-1111-1111-111111111111", source: previousSource,
      environment: "production", status: "success"
    },
    actual: settings, saved: structuredClone(settings), databaseWrites: 0,
    database: {
      revision: 9, updatedAt: stamp, document,
      documentSha256: createHash("sha256").update(document).digest("hex"), snapshots: []
    }
  };
  const after = structuredClone(before);
  after.deployment = { ...before.deployment, id: "22222222-2222-2222-2222-222222222222", source };
  const version = {
    version: "2.18.6", releaseVersion: "2.18.6", commit: source,
    shortCommit: source.slice(0, 7), branch: "main"
  };
  const previousVersion = {
    ...version, version: "2.18.5", releaseVersion: "2.18.5",
    commit: previousSource, shortCommit: previousSource.slice(0, 7)
  };
  const distDir = await mkdtemp(join(tmpdir(), "sg-version-wait-"));
  t.after(() => rm(distDir, { recursive: true, force: true }));
  await mkdir(join(distDir, "data"));
  await mkdir(join(distDir, "assets/js"), { recursive: true });
  await writeFile(join(distDir, "data/version.json"), JSON.stringify(version));
  await writeFile(join(distDir, "assets/js/reviewed.js"), "reviewed\n");
  const catalogs = validateProductionBaseline(after, config);
  const responses = new Map([
    ["/data/version.json", () => Response.json(version)],
    ["/media/shadow-garden/data/catalog.json", () => Response.json(catalogs.main)],
    ["/media/shadow-garden/data/adult-catalog.json", () => Response.json(catalogs.adult)],
    ["/assets/js/reviewed.js", () => new Response("reviewed\n", {
      headers: { "content-type": "application/javascript" }
    })]
  ]);
  const calls = [], delays = [], saved = [], events = [];
  let elapsed = 0, captures = 0, selections = 0;
  const options = {
    config, source, version: version.version, distDir,
    capture: async () => {
      events.push("capture");
      return structuredClone(captures++ ? after : before);
    },
    files: baseline => {
      selections++;
      assert.deepEqual(baseline, before);
      return ["assets/js/reviewed.js"];
    },
    saveBaseline: async (stage, baseline) => saved.push({ stage, baseline: structuredClone(baseline) }),
    deploy: async baseline => {
      assert.deepEqual(baseline, before);
      events.push("deploy");
    },
    waitForCanonical: async () => events.push("canonical"),
    fetchImpl: async (url, request) => {
      const path = new URL(url).pathname;
      calls.push({ path, request });
      return responses.get(path)();
    },
    sleep: async ms => { delays.push(ms); elapsed += ms; },
    clock: () => elapsed,
    now: () => Date.parse(stamp) + elapsed
  };
  return {
    options, version, previousVersion, before, after, responses, calls, delays, saved, events,
    advance: ms => { elapsed += ms; },
    selectionCount: () => selections
  };
}

test("served previous source converges without republishing, recapturing or replacing rollback/assets", async t => {
  const f = await fixture(t);
  let probes = 0;
  f.responses.set("/data/version.json", () => Response.json(++probes < 3 ? f.previousVersion : f.version));
  const report = await deployAndVerify(f.options);
  assert.deepEqual(f.events, ["capture", "deploy", "canonical", "capture"]);
  assert.deepEqual(f.saved, [{ stage: "before", baseline: f.before }, { stage: "after", baseline: f.after }]);
  assert.equal(f.selectionCount(), 1);
  assert.deepEqual(f.delays, [5000, 5000]);
  assert.equal(report.rollbackDeploymentId, f.before.deployment.id);
  assert.equal(report.rollbackSource, f.before.deployment.source);
  assert.equal(report.beforeCheckedAt, f.before.checkedAt);
  assert.equal(report.preservationChecked, true);
  assert.equal(report.checks.at(-1).path, "/assets/js/reviewed.js");
  assert.deepEqual(report.versionCheck, { attempts: 3, elapsedMs: 10000 });
  assert.equal(report.checkedAt, new Date(Date.parse(f.before.checkedAt) + 10000).toISOString());
  assert.deepEqual(f.calls.map(call => call.path), [
    ...Array(3).fill("/data/version.json"),
    "/media/shadow-garden/data/catalog.json", "/media/shadow-garden/data/adult-catalog.json",
    "/assets/js/reviewed.js"
  ]);
  for (const { request } of f.calls) {
    assert.equal(request.method, "GET");
    assert.equal(request.redirect, "manual");
    assert.equal(request.cache, "no-store");
    assert.equal(request.headers["cache-control"], "no-cache");
    assert.ok(request.signal instanceof AbortSignal);
    assert.equal(request.body, undefined);
    assert.equal(request.headers.authorization, undefined);
  }
});

test("served version already current completes immediately and records one check", async t => {
  const f = await fixture(t), report = await deployAndVerify(f.options);
  assert.deepEqual(f.delays, []);
  assert.deepEqual(report.versionCheck, { attempts: 1, elapsedMs: 0 });
});

test("previous source exhausts twelve checks without accepting or deploying again", async t => {
  const f = await fixture(t);
  f.responses.set("/data/version.json", () => Response.json(f.previousVersion));
  await assert.rejects(deployAndVerify(f.options), /did not converge after 12 version checks/);
  assert.equal(f.calls.length, 12);
  assert.deepEqual(f.delays, Array(11).fill(5000));
  assert.deepEqual(f.events, ["capture", "deploy", "canonical", "capture"]);
  assert.equal(f.selectionCount(), 1);
});

test("two-minute deadline includes response time and stops before another request", async t => {
  const f = await fixture(t);
  f.responses.set("/data/version.json", () => {
    f.advance(15000);
    return Response.json(f.previousVersion);
  });
  await assert.rejects(deployAndVerify(f.options), /did not converge after 6 version checks.*120000 ms/);
  assert.equal(f.calls.length, 6);
  assert.deepEqual(f.delays, Array(6).fill(5000));
});

test("last version request receives only the remaining overall time budget", async () => {
  const source = "b".repeat(40), previousSource = "a".repeat(40);
  let elapsed = 0;
  const budgets = [];
  const report = await verifyServedVersion(async timeoutMs => {
    budgets.push(timeoutMs);
    const current = budgets.length === 7;
    elapsed += current ? 5999 : 14000;
    const commit = current ? source : previousSource;
    return {
      version: "2.18.6", releaseVersion: "2.18.6", commit,
      shortCommit: commit.slice(0, 7), branch: "main"
    };
  }, {
    source, version: "2.18.6", previousSource, waitForPreviousVersion: true,
    clock: () => elapsed, sleep: async ms => { elapsed += ms; }
  });
  assert.deepEqual(budgets, [...Array(6).fill(15000), 6000]);
  assert.deepEqual(report, { attempts: 7, elapsedMs: 119999 });
});

test("matching response received beyond the deadline cannot be accepted", async t => {
  const f = await fixture(t);
  f.responses.set("/data/version.json", () => {
    f.advance(120001);
    return Response.json(f.version);
  });
  await assert.rejects(deployAndVerify(f.options), /did not converge after 1 version checks/);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.delays, []);
});

test("a different source and inconsistent version metadata fail without a retry", async t => {
  for (const edit of [
    value => { value.commit = "c".repeat(40); value.shortCommit = "c".repeat(7); },
    value => { value.releaseVersion = "2.18.4"; },
    value => { value.shortCommit = "bad"; },
    value => { value.branch = "preview"; },
    value => { value.version = value.releaseVersion = "invalid"; }
  ]) {
    const f = await fixture(t), value = structuredClone(f.previousVersion);
    edit(value);
    f.responses.set("/data/version.json", () => Response.json(value));
    await assert.rejects(deployAndVerify(f.options), /Served version/);
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.delays, []);
  }
  const f = await fixture(t);
  f.responses.set("/data/version.json", () => Response.json({ ...f.version, version: "2.18.4" }));
  await assert.rejects(deployAndVerify(f.options), /Served version/);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.delays, []);
});

test("HTTP, JSON and transport failures are never converted into convergence retries", async t => {
  for (const response of [
    () => new Response(null, { status: 302, headers: { location: "/elsewhere" } }),
    () => new Response("unavailable", { status: 503 }),
    () => new Response("<html>OK</html>", { headers: { "content-type": "text/html" } }),
    () => new Response("{", { headers: { "content-type": "application/json" } }),
    () => new Response(new Uint8Array([0xff]), { headers: { "content-type": "application/json" } }),
    () => { throw new DOMException("timed out", "TimeoutError"); }
  ]) {
    const f = await fixture(t);
    f.responses.set("/data/version.json", response);
    await assert.rejects(deployAndVerify(f.options));
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.delays, []);
  }
});

test("version response has a 64 KiB limit and cancels excess bytes without retrying", async t => {
  const f = await fixture(t);
  let canceled = false;
  const bytes = new TextEncoder().encode(JSON.stringify({ ...f.previousVersion, padding: "x".repeat(65536) }));
  f.responses.set("/data/version.json", () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(bytes); },
    pull(controller) { controller.close(); },
    cancel() { canceled = true; }
  }, { highWaterMark: 0 }), { headers: { "content-type": "application/json" } }));
  await assert.rejects(deployAndVerify(f.options), /exceeds verification limit/);
  assert.equal(canceled, true);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.delays, []);
});

test("catalog or asset failures after convergence never restart verification", async t => {
  for (const path of ["/media/shadow-garden/data/catalog.json", "/assets/js/reviewed.js"]) {
    const f = await fixture(t);
    let probes = 0;
    f.responses.set("/data/version.json", () => Response.json(++probes === 1 ? f.previousVersion : f.version));
    f.responses.set(path, () => new Response("wrong", { headers: { "content-type": "text/html" } }));
    await assert.rejects(deployAndVerify(f.options));
    assert.equal(probes, 2);
    assert.equal(f.calls.filter(call => call.path === path).length, 1);
    assert.deepEqual(f.delays, [5000]);
    assert.equal(f.events.filter(event => event === "deploy").length, 1);
  }
});

test("preservation drift fails before a lagging version can be polled", async t => {
  const f = await fixture(t);
  f.after.database.revision++;
  f.responses.set("/data/version.json", () => Response.json(f.previousVersion));
  await assert.rejects(deployAndVerify(f.options), /changed/);
  assert.equal(f.calls.length, 0);
  assert.deepEqual(f.delays, []);
});

test("a wrong local build fails before a lagging public version can be polled", async t => {
  const f = await fixture(t);
  await writeFile(join(f.options.distDir, "data/version.json"), JSON.stringify(f.previousVersion));
  await assert.rejects(deployAndVerify(f.options), /Local dist/);
  assert.equal(f.calls.length, 0);
  assert.deepEqual(f.delays, []);
});

test("standalone verifier retains one-shot behavior unless automatic waiting is requested", async t => {
  const f = await fixture(t);
  f.responses.set("/data/version.json", () => Response.json(f.previousVersion));
  await assert.rejects(verifyProduction({
    ...f.options, baseline: f.after, before: f.before,
    files: ["assets/js/reviewed.js"], now: Date.parse(f.before.checkedAt)
  }), /Served version/);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.delays, []);
});
