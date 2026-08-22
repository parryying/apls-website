"use strict";

var childProcess = require("node:child_process");

var base = process.env.CMS_BASE_SHA;
var head = process.env.CMS_HEAD_SHA || "HEAD";
if (!base) throw new Error("CMS_BASE_SHA is required");

var changed = childProcess.execFileSync("git", ["diff", "--name-only", base, head], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);
var approvedFiles = new Set([
  "data/tuition.js",
  "data/calendar.js",
  "data/teachers.js",
  "data/gallery.js",
  "data/events.js"
]);
var rejected = changed.filter(function (file) {
  return !approvedFiles.has(file) && !/^images\/uploads\/\d{4}\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(file);
});

console.log("CMS submission files:\n" + changed.map(function (file) { return "- " + file; }).join("\n"));
if (!changed.length) throw new Error("CMS submission contains no changed files");
if (rejected.length) {
  console.error("CMS submission contains paths outside the allowlist:\n" + rejected.map(function (file) { return "- " + file; }).join("\n"));
  process.exitCode = 1;
}