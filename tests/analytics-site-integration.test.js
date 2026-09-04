"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var os = require("node:os");
var path = require("node:path");
var childProcess = require("node:child_process");
var test = require("node:test");

var repositoryRoot = path.resolve(__dirname, "..");
var bash = process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash";

function sitemapPages() {
  var sitemap = fs.readFileSync(path.join(repositoryRoot, "sitemap.xml"), "utf8");

  return Array.from(sitemap.matchAll(/<loc>https:\/\/www\.apls\.org\/?([^<]*)<\/loc>/g), function (match) {
    return match[1] || "index.html";
  });
}

test("every public sitemap page ships the consent-gated analytics controller", function () {
  var pages = sitemapPages();

  assert.ok(pages.includes("privacy.html"), "privacy notice is a public sitemap page");
  pages.forEach(function (page) {
    var html = fs.readFileSync(path.join(repositoryRoot, page), "utf8");
    assert.match(html, /<script src="js\/analytics\.js\?v=1"><\/script>/, page + " loads analytics consent");
    assert.match(html, /<link rel="stylesheet" href="css\/styles\.css\?v=23" \/>/, page + " loads consent styles");
  });
});

test("deployment package contains the privacy notice and analytics controller", function (context) {
  var destination = fs.mkdtempSync(path.join(os.tmpdir(), "apls-analytics-package-"));
  context.after(function () { fs.rmSync(destination, { force: true, recursive: true }); });

  var result = childProcess.spawnSync(bash, [".github/scripts/prepare-site.sh", destination], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(destination, "privacy.html")), true);
  assert.equal(fs.existsSync(path.join(destination, "js", "analytics.js")), true);
});

test("tour page loads analytics before the Cal.com integration registers callbacks", function () {
  var html = fs.readFileSync(path.join(repositoryRoot, "tour.html"), "utf8");
  var analyticsIndex = html.indexOf('<script src="js/analytics.js?v=1"></script>');
  var bookingIndex = html.indexOf('<script src="js/tour-booking.js?v=3"></script>');

  assert.notEqual(analyticsIndex, -1);
  assert.notEqual(bookingIndex, -1);
  assert.ok(analyticsIndex < bookingIndex, "analytics API is available before tour booking initializes");
});