"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var os = require("node:os");
var path = require("node:path");
var test = require("node:test");
var generator = require("../scripts/prerender-tuition.js");

var repositoryRoot = path.resolve(__dirname, "..");
var pages = [
  "tuition.html",
  "preschool.html",
  "kindergarten.html",
  "after-school.html",
  "saturday-school.html",
  "summer-camp.html",
  "ap-prep.html"
];

function createArtifact() {
  var root = fs.mkdtempSync(path.join(os.tmpdir(), "apls-prerender-test-"));
  fs.cpSync(path.join(repositoryRoot, "data"), path.join(root, "data"), { recursive: true });
  fs.copyFileSync(path.join(repositoryRoot, "llms.txt"), path.join(root, "llms.txt"));
  pages.forEach(function (page) {
    fs.copyFileSync(path.join(repositoryRoot, page), path.join(root, page));
  });
  return root;
}

function read(root, file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function generatedRegion(text, startMarker, endMarker) {
  return text.slice(text.indexOf(startMarker) + startMarker.length, text.indexOf(endMarker));
}

function jsonLd(text) {
  var region = generatedRegion(text, generator.JSONLD_START, generator.JSONLD_END);
  var match = region.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(match, "generated JSON-LD script is present");
  return JSON.parse(match[1]);
}

test("prerendered pages expose canonical tuition without JavaScript", function (context) {
  var root = createArtifact();
  context.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  generator.prerender(root);

  var tuition = generatedRegion(read(root, "tuition.html"), generator.CONTENT_START, generator.CONTENT_END);
  assert.match(tuition, /Monthly tuition/);
  assert.match(tuition, /\$650/);
  assert.match(tuition, /\$1,100/);
  assert.match(tuition, /\$2,050/);
  assert.match(tuition, /<table class="schedule-table tuition-table">/);
  assert.match(tuition, /<th scope="col">/);
  assert.match(tuition, /Registration &amp; other fees/);

  pages.slice(1).forEach(function (page) {
    var content = generatedRegion(read(root, page), generator.CONTENT_START, generator.CONTENT_END);
    assert.match(content, /<h2>/, page + " has a generated tuition heading");
  });

  var preschool = generatedRegion(read(root, "preschool.html"), generator.CONTENT_START, generator.CONTENT_END);
  assert.match(preschool, /Monthly tuition/);
  assert.match(preschool, /\$2,050/);
  assert.match(preschool, /Sibling discount/);
  var preschoolSummary = generatedRegion(read(root, "preschool.html"), generator.SUMMARY_START, generator.SUMMARY_END);
  assert.match(preschoolSummary, /\$650–\$2,050 per month/);

  var saturday = generatedRegion(read(root, "saturday-school.html"), generator.CONTENT_START, generator.CONTENT_END);
  assert.match(saturday, /Fall 2026 Saturday School tuition/);
  assert.match(saturday, /New-student application fee/);
  assert.doesNotMatch(saturday, /Extended care/);

  var apPrep = generatedRegion(read(root, "ap-prep.html"), generator.CONTENT_START, generator.CONTENT_END);
  assert.match(apPrep, /Contact for tuition/);
  assert.doesNotMatch(apPrep, /<table/);
});

test("generated schema and llms.txt agree with canonical prices", function (context) {
  var root = createArtifact();
  context.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  generator.prerender(root);

  var preschoolSchema = jsonLd(read(root, "preschool.html"));
  var service = preschoolSchema["@graph"][0];
  assert.equal(service["@type"], "Service");
  assert.equal(service.offers.length, 8);
  assert.equal(service.offers[0].priceSpecification.unitText, "MONTH");
  assert.ok(service.offers.some(function (offer) { return offer.price === "2050"; }));

  var centralSchema = jsonLd(read(root, "tuition.html"));
  assert.equal(centralSchema["@graph"].length, 6);
  assert.equal(centralSchema["@graph"][5].name, "AP Prep tuition");
  assert.equal(Object.prototype.hasOwnProperty.call(centralSchema["@graph"][5], "offers"), false);

  var llms = generatedRegion(read(root, "llms.txt"), generator.CONTENT_START, generator.CONTENT_END);
  assert.match(llms, /Monthly tuition/);
  assert.match(llms, /Half day \(AM\): \$1,100/);
  assert.match(llms, /New-student application fee/);
});

test("generation is idempotent and propagates a temporary canonical change", function (context) {
  var root = createArtifact();
  context.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  generator.prerender(root);
  var first = pages.concat(["llms.txt"]).map(function (file) { return read(root, file); });
  generator.prerender(root);
  var second = pages.concat(["llms.txt"]).map(function (file) { return read(root, file); });
  assert.deepEqual(second, first);

  var tuitionDataFile = path.join(root, "data", "tuition.js");
  var tuitionData = fs.readFileSync(tuitionDataFile, "utf8");
  assert.equal((tuitionData.match(/\$1,100/g) || []).length, 1);
  fs.writeFileSync(tuitionDataFile, tuitionData.replace("$1,100", "$1,101"), "utf8");
  generator.prerender(root);

  var central = generatedRegion(read(root, "tuition.html"), generator.CONTENT_START, generator.CONTENT_END);
  var preschool = generatedRegion(read(root, "preschool.html"), generator.CONTENT_START, generator.CONTENT_END);
  assert.match(central, /\$1,101/);
  assert.match(preschool, /\$1,101/);
  assert.doesNotMatch(central, /\$1,100/);
  assert.doesNotMatch(preschool, /\$1,100/);
  assert.doesNotMatch(read(root, "kindergarten.html"), /\$1,101/);

  tuitionData = fs.readFileSync(tuitionDataFile, "utf8");
  fs.writeFileSync(tuitionDataFile, tuitionData.replace("$650", "$651"), "utf8");
  generator.prerender(root);
  var summary = generatedRegion(read(root, "preschool.html"), generator.SUMMARY_START, generator.SUMMARY_END);
  assert.match(summary, /\$651–\$2,050 per month/);
});

test("generation escapes content and rejects invalid markers", function () {
  assert.equal(generator.escapeHtml('<script>"A&B"</script>'), '&lt;script&gt;&quot;A&amp;B&quot;&lt;/script&gt;');
  assert.throws(function () {
    generator.replaceGeneratedRegion("no markers", generator.CONTENT_START, generator.CONTENT_END, "content", "test.html");
  }, /must contain exactly one/);
  assert.throws(function () {
    generator.replaceGeneratedRegion(
      generator.CONTENT_START + generator.CONTENT_START + generator.CONTENT_END,
      generator.CONTENT_START,
      generator.CONTENT_END,
      "content",
      "test.html"
    );
  }, /must contain exactly one/);
});