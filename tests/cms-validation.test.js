"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var test = require("node:test");
var vm = require("node:vm");
var validation = require("../cms/shared-validation.js");

function loadData() {
  var context = { window: {} };
  vm.createContext(context);
  ["tuition", "calendar", "teachers", "gallery", "events", "documents"].forEach(function (name) {
    var file = path.join(__dirname, "..", "data", name + ".js");
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  });
  return {
    tuition: JSON.parse(JSON.stringify(context.window.APLS_TUITION)),
    calendar: JSON.parse(JSON.stringify(context.window.APLS_CALENDAR)),
    teachers: JSON.parse(JSON.stringify(context.window.APLS_TEACHERS)),
    gallery: JSON.parse(JSON.stringify(context.window.APLS_GALLERY)),
    events: JSON.parse(JSON.stringify(context.window.APLS_EVENTS)),
    documents: JSON.parse(JSON.stringify(context.window.APLS_DOCUMENTS))
  };
}

// Editors submit real content through these tests, so assertions must target the case under test
// rather than the whole data set. A draft with blanks is allowed and must not fail an unrelated test.
function issuesFor(list, index) {
  var entry = (list || []).find(function (item) { return item.index === index; });
  return entry ? entry.issues.join("\n") : "";
}

test("current canonical CMS data passes shared validation", function () {
  var result = validation.validateAll(loadData(), { today: "2026-08-21" });
  assert.equal(result.summary.errors, 0);
});

test("incorrect per-class tuition is rejected", function () {
  var data = loadData();
  data.tuition.programs["after-school"].rows[0][1] = "$1,400 (26 classes)";
  var result = validation.validateAll(data, { today: "2026-08-21" });
  assert.match(result.programs["after-school"].errors.join("\n"), /should total \$1,430/);
});

test("reversed calendar ranges are rejected", function () {
  var data = loadData();
  data.calendar.years[0].months[0].events.push([
    "Sep 20 - Sep 19",
    "Broken range",
    { startDate: "2026-09-20", endDate: "2026-09-19", category: "school-event" }
  ]);
  var result = validation.validateAll(data, { today: "2026-08-21" });
  assert.ok(result.calendar.some(function (item) { return item.issues.indexOf("End date is before start date") !== -1; }));
});

test("published event images do not require alt text", function () {
  var data = loadData();
  data.events.items[0].imageAlt = "";
  var result = validation.validateAll(data, { today: "2026-08-21" });
  assert.doesNotMatch(issuesFor(result.events, 0), /alt/i);
});

test("published events still require the title the alt text is derived from", function () {
  var data = loadData();
  data.events.items[0].imageAlt = "";
  data.events.items[0].title = "";
  var result = validation.validateAll(data, { today: "2026-08-21" });
  assert.equal((result.events.find(function (item) { return item.index === 0; }) || {}).blocking, true);
  assert.match(issuesFor(result.events, 0), /Title is required/);
});

test("visible Gallery posts require valid Instagram URLs", function () {
  var data = loadData();
  data.gallery.instagramPosts.push({ url: "https://example.com/not-instagram", caption: "Invalid", visible: true });
  var index = data.gallery.instagramPosts.length - 1;
  var result = validation.validateAll(data, { today: "2026-08-21" });
  assert.equal((result.gallery.find(function (item) { return item.index === index; }) || {}).blocking, true);
});

test("a visible document without a file is rejected", function () {
  var data = loadData();
  data.documents.items.push({ title: "Parent handbook (2026)", file: "", program: "", visible: true });
  var index = data.documents.items.length - 1;
  var result = validation.validateAll(data, { today: "2026-08-21" });
  assert.equal((result.documents.find(function (item) { return item.index === index; }) || {}).blocking, true);
  assert.match(issuesFor(result.documents, index), /PDF file is required/);
});

test("documents may only point at PDFs inside the pdfs folder", function () {
  var data = loadData();
  data.documents.items.push({ title: "Handbook", file: "https://example.com/handbook.pdf", program: "", visible: true });
  var index = data.documents.items.length - 1;
  var result = validation.validateAll(data, { today: "2026-08-21" });
  assert.match(issuesFor(result.documents, index), /must be a PDF in the pdfs folder/);
});

test("a hidden document with problems does not block a submission", function () {
  var data = loadData();
  data.documents.items.push({ title: "", file: "", program: "", visible: false });
  var index = data.documents.items.length - 1;
  var result = validation.validateAll(data, { today: "2026-08-21" });
  assert.equal((result.documents.find(function (item) { return item.index === index; }) || {}).blocking, false);
});

test("an incomplete draft event does not block a submission", function () {
  var data = loadData();
  data.events.items.push({ id: "draft-1", type: "event", status: "draft", title: "New event", startDate: "" });
  var index = data.events.items.length - 1;
  var result = validation.validateAll(data, { today: "2026-08-21" });
  assert.equal((result.events.find(function (item) { return item.index === index; }) || {}).blocking, false);
  assert.equal(result.summary.errors, 0);
});