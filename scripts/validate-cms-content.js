"use strict";

var path = require("node:path");
var validation = require("../cms/shared-validation.js");
var loadCmsData = require("./load-cms-data.js");

var repositoryRoot = path.resolve(__dirname, "..");
var result = validation.validateAll(loadCmsData(repositoryRoot));

Object.keys(result.programs).forEach(function (key) {
  result.programs[key].errors.forEach(function (message) { console.error("ERROR program/" + key + ": " + message); });
  result.programs[key].warnings.forEach(function (message) { console.warn("WARNING program/" + key + ": " + message); });
});
result.calendar.forEach(function (item) { console.error("ERROR calendar row " + (item.index + 1) + ": " + item.issues.join(" | ")); });
result.events.forEach(function (item) {
  var output = item.blocking ? console.error : console.warn;
  output((item.blocking ? "ERROR" : "WARNING") + " event " + (item.index + 1) + ": " + item.issues.join(" | "));
});
result.gallery.forEach(function (item) { console.error("ERROR gallery post " + (item.index + 1) + ": " + item.issues.join(" | ")); });
(result.documents || []).forEach(function (item) {
  var output = item.blocking ? console.error : console.warn;
  output((item.blocking ? "ERROR" : "WARNING") + " document " + (item.index + 1) + ": " + item.issues.join(" | "));
});

console.log("CMS validation: " + result.summary.errors + " errors, " + result.summary.warnings + " warnings");
if (result.summary.errors) process.exitCode = 1;