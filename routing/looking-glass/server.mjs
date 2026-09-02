import { createServer } from "node:http";
import { resolve6 } from "node:dns/promises";
import { isIP } from "node:net";
import { spawn } from "node:child_process";

const host = process.env.LG_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.LG_PORT ?? "8080", 10);
const location = process.env.LG_LOCATION ?? "core";
const birdSocket = process.env.LG_BIRD_SOCKET ?? "/run/bird/bird.ctl";
const trustProxy = process.env.LG_TRUST_PROXY === "1";
const allowedOrigins = new Set(
  (process.env.LG_ALLOWED_ORIGINS ?? "https://as218822.net,https://www.as218822.net")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const requests = new Map();

const jobs = {
  route: {
    timeout: 5_000,
    resolve: resolveRouteTarget,
    command: (target) => [
      "birdc",
      ["-r", "-s", birdSocket, `show route for ${target} all`],
    ],
  },
  ping: {
    timeout: 12_000,
    resolve: resolveHostTarget,
    command: (target) => ["ping", ["-n", "-c", "4", "-W", "2", target]],
  },
  traceroute: {
    timeout: 45_000,
    resolve: resolveHostTarget,
    command: (target) => [
      "traceroute",
      ["-n", "-m", "20", "-w", "2", "-q", "1", target],
    ],
  },
};

function isNetwork(value) {
  const [address, prefix, extra] = value.split("/");
  if (!isIPv6Address(address) || extra !== undefined) return false;
  if (prefix === undefined) return true;
  if (!/^\d{1,3}$/.test(prefix)) return false;
  return Number(prefix) <= 128;
}

function isIPv6Address(value) {
  return isIP(value) === 6;
}

function isHostname(value) {
  const hostname = value.endsWith(".") ? value.slice(0, -1) : value;
  if (hostname.length > 253 || !hostname.includes(".")) return false;
  return hostname.split(".").every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label),
  );
}

async function resolveHostname(value) {
  if (!isHostname(value)) throw new Error("Invalid IPv6 address or hostname");
  try {
    const addresses = await resolve6(value);
    if (addresses.length > 0) return addresses[0];
  } catch {
    // Return the same public error for missing and invalid AAAA records.
  }
  throw new Error("Hostname has no IPv6 address");
}

async function resolveRouteTarget(value) {
  if (isNetwork(value)) return value;
  return resolveHostname(value);
}

async function resolveHostTarget(value) {
  if (isIPv6Address(value)) return value;
  return resolveHostname(value);
}

function corsHeaders(origin) {
  if (!origin || !allowedOrigins.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "Origin",
  };
}

function respond(response, status, body, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function rateLimited(address) {
  const now = Date.now();
  const recent = (requests.get(address) ?? []).filter((time) => now - time < 60_000);
  recent.push(now);
  requests.set(address, recent);
  return recent.length > 20;
}

function clientAddress(request) {
  const forwarded = request.headers["x-forwarded-for"];
  const peer = request.socket.remoteAddress ?? "unknown";
  if (
    typeof forwarded === "string" &&
    (trustProxy || peer === "127.0.0.1" || peer === "::1" || peer === "::ffff:127.0.0.1")
  ) {
    return forwarded.split(",", 1)[0].trim();
  }
  return peer;
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2_048) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function run(command, args, timeout) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      child.kill("SIGKILL");
    }, timeout);

    const append = (chunk) => {
      output += chunk.toString("utf8");
      if (output.length > 32_768) child.kill("SIGKILL");
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", reject);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (output.length > 32_768) return reject(new Error("Command output limit exceeded"));
      if (expired) return reject(new Error("Query timed out"));
      resolve({ code: code ?? 1, signal, output: output.trim() });
    });
  });
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  const cors = corsHeaders(origin);

  if (request.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) return respond(response, 403, { error: "Origin is not allowed" });
    response.writeHead(204, cors);
    return response.end();
  }

  if (request.method === "GET" && request.url === "/health") {
    return respond(response, 200, { status: "ok", location });
  }

  if (request.method !== "POST" || request.url !== "/api/query") {
    return respond(response, 404, { error: "Not found" }, cors);
  }
  if (origin && !allowedOrigins.has(origin)) {
    return respond(response, 403, { error: "Origin is not allowed" });
  }
  if (request.headers["content-type"]?.split(";", 1)[0] !== "application/json") {
    return respond(response, 415, { error: "Content-Type must be application/json" }, cors);
  }
  if (rateLimited(clientAddress(request))) {
    return respond(response, 429, { error: "Rate limit exceeded" }, cors);
  }

  try {
    const body = await readJson(request);
    const job = jobs[body.type];
    const target = typeof body.target === "string" ? body.target.trim() : "";
    if (!job || !target) {
      return respond(response, 400, { error: "Invalid query type or target" }, cors);
    }

    let queryTarget;
    try {
      queryTarget = await job.resolve(target);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid query target";
      return respond(response, 400, { error: message }, cors);
    }

    const startedAt = performance.now();
    const [command, args] = job.command(queryTarget);
    const result = await run(command, args, job.timeout);
    return respond(response, 200, {
      ok: result.code === 0,
      type: body.type,
      target,
      resolvedTarget: queryTarget === target ? undefined : queryTarget,
      location,
      elapsedMs: Math.round(performance.now() - startedAt),
      exitCode: result.code,
      output: result.output || `Command exited with status ${result.code}`,
    }, cors);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Query failed";
    return respond(response, error instanceof SyntaxError ? 400 : 500, { error: message }, cors);
  }
});

server.listen(port, host, () => {
  console.log(`Looking glass listening on http://${host}:${port}`);
});
