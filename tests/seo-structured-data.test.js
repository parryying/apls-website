"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var test = require("node:test");
var loadCmsData = require("../scripts/load-cms-data.js");
var generator = require("../scripts/prerender-tuition.js");

var repositoryRoot = path.resolve(__dirname, "..");

function jsonLdScripts(html) {
  return Array.from(html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g), function (match) {
    return JSON.parse(match[1]);
  });
}

test("preschool page exposes one coherent local entity", function () {
  var html = fs.readFileSync(path.join(repositoryRoot, "preschool.html"), "utf8");
  var homeHtml = fs.readFileSync(path.join(repositoryRoot, "index.html"), "utf8");
  var entity = jsonLdScripts(html).find(function (schema) {
    return schema["@id"] === "https://www.apls.org/#organization";
  });
  var homeEntity = jsonLdScripts(homeHtml).find(function (schema) {
    return schema["@id"] === "https://www.apls.org/#organization";
  });

  assert.ok(entity, "canonical APLS entity is present");
  assert.deepEqual(entity["@type"], ["Preschool", "ChildCare"]);
  assert.equal(entity.name, "Asia Pacific Language School");
  assert.equal(entity.telephone, "+1-425-747-4172");
  assert.equal(entity.address.streetAddress, "14042 NE 8th Street, 1st Floor");
  assert.equal(entity.address.postalCode, "98007");
  assert.equal(entity.mainEntityOfPage, "https://www.apls.org/preschool.html");
  assert.equal(entity.geo.latitude, 47.6175908);
  assert.equal(entity.geo.longitude, -122.1518198);
  assert.deepEqual(entity.geo, homeEntity.geo);
  assert.equal(Object.prototype.hasOwnProperty.call(entity, "audience"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(entity, "ageRange"), false);
  assert.ok(entity.additionalProperty.some(function (property) {
    return property.name === "Ages served" && property.value === "2½–6 years";
  }));
  assert.ok(entity.additionalProperty.some(function (property) {
    return property.name === "Approximate student-teacher ratio" && property.value === "6:1";
  }));
  assert.match(html, /<dd>2½–6 years<\/dd>/);
  assert.match(html, /<dd>Approximately 6:1<\/dd>/);
  assert.doesNotMatch(html, /Japanese bilingual/i);
});

test("generated preschool tuition offers resolve to the canonical entity", function () {
  var tuition = loadCmsData(repositoryRoot).tuition;
  var schema = jsonLdScripts(generator.renderJsonLd(tuition, "preschool"))[0];
  var service = schema["@graph"][0];

  assert.equal(service.provider["@id"], "https://www.apls.org/#organization");
  assert.equal(service.offers.length, 8);
  assert.ok(service.offers.some(function (offer) { return offer.price === "650"; }));
  assert.ok(service.offers.some(function (offer) { return offer.price === "2050"; }));
});