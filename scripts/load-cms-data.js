"use strict";

var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

function loadCmsData(repositoryRoot) {
  var context = { window: {} };
  vm.createContext(context);
  ["tuition", "calendar", "teachers", "gallery", "events", "documents"].forEach(function (name) {
    var file = path.join(repositoryRoot, "data", name + ".js");
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

module.exports = loadCmsData;