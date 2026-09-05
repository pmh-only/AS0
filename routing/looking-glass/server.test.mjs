import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

let directory;
let bird;
let child;
let logs = "";

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "lg-test-"));
  const socket = join(directory, "bird.ctl");
  bird = createServer((connection) => {
    connection.on("error", () => {});
    connection.write("0001 BIRD 2.17.5 ready.\n");
    connection.on("data", (data) => {
      if (data.toString().includes("restrict")) {
        connection.write("0016 Access restricted\n");
      } else if (data.toString().includes("show protocols")) {
        connection.write(
          "2002-Name Proto Table State Since Info\n" +
          "1002-upstream BGP --- up 12:00:00 Established\n" +
          " peer_down BGP --- start 12:00:00 Active\n" +
          " route64_sg_v6 BGP --- down 12:00:00\n" +
          " rpki_cache RPKI --- up 12:00:00 Established\n0000 \n",
        );
      } else {
        connection.write("8001 Unsupported test command\n");
      }
    });
  });
  await new Promise((resolve) => bird.listen(socket, resolve));
  child = spawn(process.execPath, ["/app/server.mjs"], {
    env: { ...process.env, LG_BIRD_SOCKET: socket, LG_DISABLED_PROTOCOLS: "route64_sg_v6" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => { logs += chunk; });
  child.stderr.on("data", (chunk) => { logs += chunk; });
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch("http://127.0.0.1:8080/live")).ok) return;
    } catch {}
    await delay(50);
  }
  throw new Error(`Server did not start: ${logs}`);
});

after(async () => {
  if (child && child.exitCode === null) {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    await exited;
  }
  if (bird?.listening) await new Promise((resolve) => bird.close(resolve));
  await rm(directory, { recursive: true, force: true });
});

test("health and metrics reflect BIRD and individual peer state", async () => {
  assert.equal((await fetch("http://127.0.0.1:8080/health")).status, 200);
  const metrics = await (await fetch("http://127.0.0.1:9003/metrics")).text();
  assert.match(metrics, /as218822_bird_up\{location="core"\} 1/);
  assert.match(metrics, /protocol="upstream",type="BGP"\} 1/);
  assert.match(metrics, /protocol="peer_down",type="BGP"\} 0/);
  assert.match(metrics, /protocol="rpki_cache",type="RPKI"\} 1/);
  assert.doesNotMatch(metrics, /route64_sg_v6/);
});

test("metrics are not exposed by the public HTTP listener", async () => {
  assert.equal((await fetch("http://127.0.0.1:8080/metrics")).status, 404);
});

test("private, loopback, multicast, and scoped ping targets are rejected", async () => {
  for (const target of ["::1", "fd00::1", "fe80::1%eth0", "ff02::1", "::ffff:127.0.0.1"]) {
    const response = await fetch("http://127.0.0.1:8080/api/query", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "ping", target }),
    });
    assert.equal(response.status, 400, target);
  }
});

test("untrusted origins are rejected", async () => {
  const response = await fetch("http://127.0.0.1:8080/api/query", {
    method: "POST", headers: { "content-type": "application/json", origin: "https://invalid.example" },
    body: JSON.stringify({ type: "route", target: "2606:4700::1" }),
  });
  assert.equal(response.status, 403);
});

test("BIRD loss fails readiness without failing process liveness", async () => {
  await new Promise((resolve) => bird.close(resolve));
  await delay(10_100);
  assert.equal((await fetch("http://127.0.0.1:8080/health")).status, 503);
  assert.equal((await fetch("http://127.0.0.1:8080/live")).status, 200);
  const metrics = await (await fetch("http://127.0.0.1:9003/metrics")).text();
  assert.match(metrics, /as218822_bird_up\{location="core"\} 0/);
});
