"use strict";

var fs = require("node:fs");
var path = require("node:path");
var childProcess = require("node:child_process");

var root = path.resolve(__dirname, "..");
var output = path.join(root, "dist-cms");
var directories = ["cms", "css", "data", "images", "js", "pdfs", "videos"];
var pages = fs.readdirSync(root).filter(function (name) { return /\.html$/.test(name) && !/^(logo-concepts|social-card-preview)\.html$/.test(name); });

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
directories.forEach(function (directory) { fs.cpSync(path.join(root, directory), path.join(output, directory), { recursive: true }); });
// The public site never ships pdfs/archive, so the preview must not either, or a bad link passes here and 404s live.
fs.rmSync(path.join(output, "pdfs", "archive"), { recursive: true, force: true });
pages.forEach(function (page) { fs.copyFileSync(path.join(root, page), path.join(output, page)); });
["robots.txt", "sitemap.xml"].forEach(function (file) {
  if (fs.existsSync(path.join(root, file))) fs.copyFileSync(path.join(root, file), path.join(output, file));
});
var sha = process.env.CF_PAGES_COMMIT_SHA || childProcess.execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
fs.writeFileSync(path.join(output, "cms", "build-config.js"), "window.APLS_CMS_BUILD = " + JSON.stringify({ sourceSha: sha }) + ";\n");
fs.copyFileSync(path.join(root, "cloudflare", "worker.js"), path.join(output, "_worker.js"));
console.log("Cloud CMS build created at " + output + " for " + sha);