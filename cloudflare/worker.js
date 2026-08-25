var APPROVED_DATA_PATHS = new Set([
  "data/tuition.js",
  "data/calendar.js",
  "data/teachers.js",
  "data/gallery.js",
  "data/events.js",
  "data/documents.js"
]);
var MAX_JSON_BYTES = 1024 * 1024;
var MAX_MEDIA_BYTES = 2 * 1024 * 1024;
var MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
var githubTokenCache = null;
var accessKeysCache = null;

function json(payload, status, request, env) {
  var origin = request.headers.get("Origin");
  var allowedOrigin = origin && origin === env.CMS_ORIGIN ? origin : env.CMS_ORIGIN;
  return new Response(JSON.stringify(payload), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type, Cf-Access-Jwt-Assertion",
      "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
      "Vary": "Origin"
    }
  });
}

function base64Url(bytes) {
  var binary = "";
  new Uint8Array(bytes).forEach(function (byte) { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value) {
  var normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  var binary = atob(normalized);
  return Uint8Array.from(binary, function (character) { return character.charCodeAt(0); });
}

function parseJwt(token) {
  var parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Invalid identity token");
  return {
    parts: parts,
    header: JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0]))),
    payload: JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])))
  };
}

async function accessKeys(env) {
  if (accessKeysCache && accessKeysCache.expires > Date.now()) return accessKeysCache.keys;
  var response = await fetch("https://" + env.CF_ACCESS_TEAM_DOMAIN + "/cdn-cgi/access/certs");
  if (!response.ok) throw new Error("Could not load Access signing keys");
  var keys = (await response.json()).keys || [];
  accessKeysCache = { keys: keys, expires: Date.now() + 60 * 60 * 1000 };
  return keys;
}

async function verifyIdentity(request, env) {
  var token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw Object.assign(new Error("Sign in through APLS Content Studio Access."), { status: 401 });
  var parsed = parseJwt(token);
  var keys = await accessKeys(env);
  var jwk = keys.find(function (item) { return item.kid === parsed.header.kid; });
  if (!jwk) throw Object.assign(new Error("Identity signing key was not found."), { status: 401 });
  var key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  var verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(parsed.parts[2]),
    new TextEncoder().encode(parsed.parts[0] + "." + parsed.parts[1])
  );
  var audience = Array.isArray(parsed.payload.aud) ? parsed.payload.aud : [parsed.payload.aud];
  if (!verified || parsed.payload.exp * 1000 < Date.now() || audience.indexOf(env.CF_ACCESS_AUD) === -1) {
    throw Object.assign(new Error("Your Content Studio session is invalid or expired."), { status: 401 });
  }
  var email = String(parsed.payload.email || "").toLowerCase();
  var allowed = String(env.CMS_ALLOWED_EMAILS || "").split(",").map(function (value) { return value.trim().toLowerCase(); }).filter(Boolean);
  if (!email || allowed.indexOf(email) === -1) throw Object.assign(new Error("This account is not allowed to edit APLS content."), { status: 403 });
  return { email: email };
}

function pemBytes(pem) {
  var body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  return Uint8Array.from(atob(body), function (character) { return character.charCodeAt(0); });
}

async function githubAppJwt(env) {
  var now = Math.floor(Date.now() / 1000);
  var header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  var payload = base64Url(new TextEncoder().encode(JSON.stringify({ iat: now - 30, exp: now + 540, iss: env.GITHUB_APP_ID })));
  var key = await crypto.subtle.importKey("pkcs8", pemBytes(env.GITHUB_PRIVATE_KEY), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  var signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(header + "." + payload));
  return header + "." + payload + "." + base64Url(signature);
}

async function installationToken(env) {
  if (githubTokenCache && githubTokenCache.expires > Date.now() + 60000) return githubTokenCache.token;
  var response = await fetch("https://api.github.com/app/installations/" + env.GITHUB_INSTALLATION_ID + "/access_tokens", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + await githubAppJwt(env),
      "Accept": "application/vnd.github+json",
      "User-Agent": "apls-content-studio",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!response.ok) throw new Error("GitHub App installation token request failed");
  var payload = await response.json();
  githubTokenCache = { token: payload.token, expires: new Date(payload.expires_at).getTime() };
  return payload.token;
}

async function github(env, path, options) {
  options = options || {};
  options.headers = Object.assign({
    "Authorization": "Bearer " + await installationToken(env),
    "Accept": "application/vnd.github+json",
    "User-Agent": "apls-content-studio",
    "X-GitHub-Api-Version": "2022-11-28"
  }, options.headers || {});
  var response = await fetch("https://api.github.com/repos/" + env.GITHUB_OWNER + "/" + env.GITHUB_REPO + path, options);
  var payload = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(payload.message || "GitHub request failed");
  return payload;
}

async function mainRef(env) {
  return github(env, "/git/ref/heads/" + (env.GITHUB_BASE_BRANCH || "main"));
}

function safeBranchEmail(email) {
  return email.split("@")[0].toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "editor";
}

function validateSubmissionFiles(files) {
  var entries = Object.entries(files || {});
  if (!entries.length) throw Object.assign(new Error("No changed content was submitted."), { status: 400 });
  entries.forEach(function (entry) {
    var filePath = entry[0];
    var file = entry[1] || {};
    var isData = APPROVED_DATA_PATHS.has(filePath);
    var isMedia = /^images\/uploads\/\d{4}\/[A-Za-z0-9][A-Za-z0-9._-]*\.webp$/.test(filePath);
    var isDocument = /^pdfs\/uploads\/\d{4}\/[A-Za-z0-9][A-Za-z0-9._-]*\.pdf$/.test(filePath);
    if (!isData && !isMedia && !isDocument) throw Object.assign(new Error("Submission path is not allowed: " + filePath), { status: 400 });
    if (file.encoding !== "utf-8" && file.encoding !== "base64") throw Object.assign(new Error("Unsupported encoding for " + filePath), { status: 400 });
    var size = file.encoding === "base64" ? Math.ceil(String(file.content || "").length * 0.75) : new TextEncoder().encode(String(file.content || "")).length;
    if (isData && (file.encoding !== "utf-8" || size > MAX_JSON_BYTES)) throw Object.assign(new Error("Invalid data payload for " + filePath), { status: 400 });
    if (isMedia) {
      if (file.encoding !== "base64" || size > MAX_MEDIA_BYTES) throw Object.assign(new Error("Invalid media payload for " + filePath), { status: 400 });
      var bytes = decodeBase64Url(String(file.content || "").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
      var webp = bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
      if (!webp) throw Object.assign(new Error("Media payload is not a valid WebP image: " + filePath), { status: 400 });
    }
    if (isDocument) {
      if (file.encoding !== "base64" || size > MAX_DOCUMENT_BYTES) throw Object.assign(new Error("Invalid document payload for " + filePath), { status: 400 });
      var documentBytes = decodeBase64Url(String(file.content || "").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
      if (new TextDecoder().decode(documentBytes.slice(0, 5)) !== "%PDF-") throw Object.assign(new Error("Document payload is not a valid PDF: " + filePath), { status: 400 });
    }
  });
  return entries;
}

// A newer submission replaces the editor's previous one, so only one review stays open.
async function supersedePreviousSubmissions(env, identity, currentPrNumber, currentUrl) {
  var previous = await env.DB.prepare("SELECT pr_number, branch FROM submissions WHERE editor_email = ? AND pr_number != ? ORDER BY id DESC LIMIT 5")
    .bind(identity.email, currentPrNumber).all();
  for (var index = 0; index < (previous.results || []).length; index++) {
    var row = previous.results[index];
    try {
      var pull = await github(env, "/pulls/" + row.pr_number);
      if (pull.state !== "open") continue;
      await github(env, "/issues/" + row.pr_number + "/comments", {
        method: "POST",
        body: JSON.stringify({ body: "Superseded by a newer Content Studio submission: " + currentUrl })
      });
      await github(env, "/pulls/" + row.pr_number, { method: "PATCH", body: JSON.stringify({ state: "closed" }) });
      await github(env, "/git/refs/heads/" + row.branch, { method: "DELETE" });
    } catch (error) {
      console.error("Could not supersede pull request " + row.pr_number + ": " + error.message);
    }
  }
}

async function createSubmission(request, env, identity) {
  var body = await request.json();
  var entries = validateSubmissionFiles(body.files);
  var ref = await mainRef(env);
  var baseSha = ref.object.sha;
  if (body.baseSha !== baseSha) {
    return json({ error: "Website content changed. Reload the latest version before submitting.", code: "STALE_BASE", baseSha: baseSha }, 409, request, env);
  }
  var baseCommit = await github(env, "/git/commits/" + baseSha);
  var blobs = await Promise.all(entries.map(async function (entry) {
    var file = entry[1];
    var blob = await github(env, "/git/blobs", {
      method: "POST",
      body: JSON.stringify({ content: file.content, encoding: file.encoding })
    });
    return { path: entry[0], mode: "100644", type: "blob", sha: blob.sha };
  }));
  var tree = await github(env, "/git/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: blobs })
  });
  var now = new Date().toISOString();
  var commit = await github(env, "/git/commits", {
    method: "POST",
    body: JSON.stringify({
      message: "CMS content update from " + identity.email,
      tree: tree.sha,
      parents: [baseSha],
      author: { name: "APLS Content Studio", email: identity.email, date: now }
    })
  });
  var branch = "cms/" + safeBranchEmail(identity.email) + "/" + now.replace(/[-:.TZ]/g, "");
  await github(env, "/git/refs", { method: "POST", body: JSON.stringify({ ref: "refs/heads/" + branch, sha: commit.sha }) });
  var pull = await github(env, "/pulls", {
    method: "POST",
    body: JSON.stringify({
      title: "CMS content update",
      head: branch,
      base: env.GITHUB_BASE_BRANCH || "main",
      body: "Submitted by " + identity.email + ".\n\n" + (String(body.note || "").trim() || "No reviewer note provided.")
    })
  });
  await env.DB.prepare("INSERT INTO submissions (editor_email, branch, pr_number, head_sha, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(identity.email, branch, pull.number, commit.sha, "submitted", now, now).run();
  await supersedePreviousSubmissions(env, identity, pull.number, pull.html_url);
  return json({ submission: { branch: branch, prNumber: pull.number, headSha: commit.sha, url: pull.html_url, status: "submitted" } }, 201, request, env);
}

async function route(request, env) {
  if (request.method === "OPTIONS") return json({}, 204, request, env);
  var identity = await verifyIdentity(request, env);
  var url = new URL(request.url);
  if (url.pathname === "/api/content" && request.method === "GET") {
    var ref = await mainRef(env);
    var draft = await env.DB.prepare("SELECT base_sha, payload, changed_sections, updated_at FROM drafts WHERE editor_email = ?").bind(identity.email).first();
    return json({ identity: identity, baseSha: ref.object.sha, draft: draft ? {
      baseSha: draft.base_sha,
      state: JSON.parse(draft.payload),
      changedSections: JSON.parse(draft.changed_sections),
      updatedAt: draft.updated_at
    } : null }, 200, request, env);
  }
  if (url.pathname === "/api/draft" && request.method === "PUT") {
    var body = await request.json();
    var payload = JSON.stringify(body.state || {});
    if (new TextEncoder().encode(payload).length > MAX_JSON_BYTES) return json({ error: "Draft is too large." }, 413, request, env);
    var now = new Date().toISOString();
    await env.DB.prepare("INSERT INTO drafts (editor_email, base_sha, payload, changed_sections, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(editor_email) DO UPDATE SET base_sha = excluded.base_sha, payload = excluded.payload, changed_sections = excluded.changed_sections, updated_at = excluded.updated_at")
      .bind(identity.email, body.baseSha, payload, JSON.stringify(body.changedSections || []), now).run();
    return json({ savedAt: now }, 200, request, env);
  }
  if (url.pathname === "/api/draft" && request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM drafts WHERE editor_email = ?").bind(identity.email).run();
    return json({ discarded: true }, 200, request, env);
  }
  if (url.pathname === "/api/submissions" && request.method === "POST") return createSubmission(request, env, identity);
  if (url.pathname === "/api/submissions/current" && request.method === "GET") {
    var row = await env.DB.prepare("SELECT branch, pr_number, head_sha, status, updated_at FROM submissions WHERE editor_email = ? ORDER BY id DESC LIMIT 1").bind(identity.email).first();
    if (!row) return json({ submission: null }, 200, request, env);
    var pull = await github(env, "/pulls/" + row.pr_number);
    var checks = await github(env, "/commits/" + row.head_sha + "/check-runs");
    var checkRuns = checks.check_runs || [];
    var status = pull.merged_at ? "merged" : pull.state === "closed" ? "closed" : !checkRuns.length || checkRuns.some(function (check) { return check.status !== "completed"; }) ? "checks-running" : checkRuns.some(function (check) { return check.conclusion !== "success" && check.conclusion !== "skipped"; }) ? "checks-failed" : "staging-ready";
    // The draft is kept while a submission is open so a refresh can restore it; clear it once resolved.
    if (status === "merged" || status === "closed") {
      await env.DB.prepare("DELETE FROM drafts WHERE editor_email = ?").bind(identity.email).run();
    }
    return json({ submission: { branch: row.branch, prNumber: row.pr_number, headSha: row.head_sha, status: status, url: pull.html_url, updatedAt: row.updated_at } }, 200, request, env);
  }
  return json({ error: "Not found" }, 404, request, env);
}

export default {
  async fetch(request, env) {
    // Runs as a Pages _worker.js: anything outside /api/ is a static asset.
    if (!new URL(request.url).pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await route(request, env);
    } catch (error) {
      console.error(error);
      return json({ error: error.message || "Content Studio API failed." }, error.status || 500, request, env);
    }
  }
};