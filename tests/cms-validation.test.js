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
  ["tuition", "calendar", "teachers", "gallery", "events"].forEach(function (name) {
    var file = path.join(__dirname, "..", "data", name + ".js");
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  });
  return {
    tuition: JSON.parse(JSON.stringify(context.window.APLS_TUITION)),
    calendar: JSON.parse(JSON.stringify(context.window.APLS_CALENDAR)),
    teachers: JSON.parse(JSON.stringify(context.window.APLS_TEACHERS)),
    gallery: JSON.parse(JSON.stringify(context.window.APLS_GALLERY)),
    events: JSON.parse(JSON.stringify(context.window.APLS_EVENTS))
  };
}

test("current canonical CMS data passes shared validation", function () {
  var result = validation.validateAll(loadData(), { today: "2026-08-21" });
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.warnings, 0);
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
  assert.equal(result.events.length, 0);
});

test("published events still require the title the alt text is derived from", function () {
  var data = loadData();
  data.events.items[0].imageAlt = "";
  data.events.items[0].title = "";
  var result = validation.validateAll(data, { today: "2026-08-21" });
  assert.equal(result.events[0].blocking, true);
  assert.match(result.events[0].issues.join("\n"), /Title is required/);
});

test("visible Gallery posts require valid Instagram URLs", function () {
  var data = loadData();
  data.gallery.instagramPosts.push({ url: "https://example.com/not-instagram", caption: "Invalid", visible: true });
  var result = validation.validateAll(data, { today: "2026-08-21" });
  assert.equal(result.gallery[0].blocking, true);
});