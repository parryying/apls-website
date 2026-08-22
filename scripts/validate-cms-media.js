"use strict";

var fs = require("node:fs");
var path = require("node:path");
var loadCmsData = require("./load-cms-data.js");

var repositoryRoot = path.resolve(__dirname, "..");
var uploadRoot = path.join(repositoryRoot, "images", "uploads");
var allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
var normalLimit = 1024 * 1024;
var exceptionLimit = 2 * 1024 * 1024;
var failures = [];
var warnings = [];

function imageKind(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return "unknown";
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(function (entry) {
    var target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

walk(uploadRoot).forEach(function (file) {
  var relative = path.relative(repositoryRoot, file).replace(/\\/g, "/");
  var extension = path.extname(file).toLowerCase();
  var buffer = fs.readFileSync(file);
  var kind = imageKind(buffer);
  if (!allowedExtensions.has(extension)) failures.push(relative + " uses an unsupported extension");
  if (kind === "unknown") failures.push(relative + " does not have a supported image signature");
  if ((extension === ".jpg" || extension === ".jpeg") && kind !== "jpeg") failures.push(relative + " extension does not match its image signature");
  if (extension === ".png" && kind !== "png") failures.push(relative + " extension does not match its image signature");
  if (extension === ".webp" && kind !== "webp") failures.push(relative + " extension does not match its image signature");
  if (buffer.length > exceptionLimit) failures.push(relative + " exceeds the 2 MB absolute media limit");
  else if (buffer.length > normalLimit) warnings.push(relative + " exceeds the normal 1 MB media limit and requires reviewer approval");
});

function verifyReference(value, label) {
  if (!value || /^https?:\/\//i.test(value)) return;
  var normalized = String(value).replace(/^\.\//, "").replace(/\\/g, "/");
  if (!fs.existsSync(path.join(repositoryRoot, normalized))) failures.push(label + " references missing file " + normalized);
}

var data = loadCmsData(repositoryRoot);
(data.teachers || []).forEach(function (teacher, index) { verifyReference(teacher.photo, "Teacher " + (index + 1)); });
(data.events.items || []).forEach(function (item, index) { verifyReference(item.image, "Event " + (index + 1)); });

warnings.forEach(function (message) { console.warn("WARNING: " + message); });
failures.forEach(function (message) { console.error("ERROR: " + message); });
console.log("CMS media validation: " + failures.length + " errors, " + warnings.length + " warnings");
if (failures.length) process.exitCode = 1;