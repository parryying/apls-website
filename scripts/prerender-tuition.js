"use strict";

var fs = require("node:fs");
var path = require("node:path");
var loadCmsData = require("./load-cms-data.js");

var CONTENT_START = "<!-- APLS:TUITION:START -->";
var CONTENT_END = "<!-- APLS:TUITION:END -->";
var JSONLD_START = "<!-- APLS:TUITION-JSONLD:START -->";
var JSONLD_END = "<!-- APLS:TUITION-JSONLD:END -->";
var SITE_URL = "https://www.apls.org/";
var PROGRAM_PAGES = {
  preschool: "preschool.html",
  kindergarten: "kindergarten.html",
  "after-school": "after-school.html",
  "saturday-school": "saturday-school.html",
  "summer-camp": "summer-camp.html",
  "ap-prep": "ap-prep.html"
};

function escapeHtml(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markerCount(text, marker) {
  return text.split(marker).length - 1;
}

function replaceGeneratedRegion(text, startMarker, endMarker, content, filename) {
  if (markerCount(text, startMarker) !== 1 || markerCount(text, endMarker) !== 1) {
    throw new Error(filename + " must contain exactly one " + startMarker + " and one " + endMarker);
  }

  var startIndex = text.indexOf(startMarker);
  var endIndex = text.indexOf(endMarker);
  if (endIndex < startIndex) throw new Error(filename + " has generated markers in the wrong order");

  var lineStart = text.lastIndexOf("\n", startIndex) + 1;
  var indent = text.slice(lineStart, startIndex).match(/^\s*/)[0];
  var indented = String(content).split("\n").map(function (line) {
    return line ? indent + line : "";
  }).join("\n");

  return text.slice(0, startIndex + startMarker.length) + "\n" + indented + "\n" + indent + text.slice(endIndex);
}

function tuitionHeading(program) {
  var heading = program.heading || "Tuition";
  var term = program.term || "";
  if (term && term !== "Year-round" && heading.toLowerCase().indexOf(term.toLowerCase()) === -1) {
    return term + " " + heading;
  }
  return heading;
}

function renderTable(columns, rows) {
  var lines = [
    '<table class="schedule-table tuition-table">',
    "  <thead>",
    "    <tr>" + columns.map(function (column) {
      return '<th scope="col">' + escapeHtml(column) + "</th>";
    }).join("") + "</tr>",
    "  </thead>",
    "  <tbody>"
  ];
  rows.forEach(function (row) {
    lines.push("    <tr>" + row.map(function (cell) {
      return "<td>" + escapeHtml(cell) + "</td>";
    }).join("") + "</tr>");
  });
  lines.push("  </tbody>", "</table>");
  return lines.join("\n");
}

function renderFees(fees) {
  var lines = ['<ul class="fee-list">'];
  fees.forEach(function (fee) {
    lines.push("  <li><strong>" + escapeHtml(fee.label) + "</strong>" + escapeHtml(fee.text || "") + "</li>");
  });
  lines.push("</ul>");
  return lines.join("\n");
}

function renderProgram(program, feesHeading, fees) {
  var lines = ["<h2>" + escapeHtml(tuitionHeading(program)) + "</h2>"];
  if (program.note) lines.push('<p class="program-tuition-note">' + escapeHtml(program.note) + "</p>");

  var hasTable = (program.columns || []).length && (program.rows || []).length;
  if (hasTable) lines.push(renderTable(program.columns, program.rows));
  if (fees.length) {
    lines.push("<h2>" + escapeHtml(feesHeading || "Registration & other fees") + "</h2>");
    lines.push(renderFees(fees));
  }
  if (!hasTable) {
    lines.push('<div class="program-tuition-actions">');
    lines.push('  <a class="btn btn-primary" href="contact.html">Contact for tuition</a>');
    lines.push("</div>");
  }
  return lines.join("\n");
}

function applicableFees(data, programKey) {
  return (data.fees || []).filter(function (fee) {
    return (fee.appliesTo || []).indexOf(programKey) !== -1;
  });
}

function renderFullTuition(data) {
  var lines = [];
  (data.programOrder || Object.keys(data.programs || {})).forEach(function (programKey) {
    var program = data.programs[programKey];
    if (!program) return;
    lines.push("<h2>" + escapeHtml(tuitionHeading(program)) + "</h2>");
    if (program.note) lines.push("<p>" + escapeHtml(program.note) + "</p>");
    if ((program.columns || []).length && (program.rows || []).length) {
      lines.push(renderTable(program.columns, program.rows));
    }
  });
  if ((data.fees || []).length) {
    lines.push("<h2>" + escapeHtml(data.feesHeading || "Registration & other fees") + "</h2>");
    lines.push(renderFees(data.fees));
  }
  return lines.join("\n");
}

function parsePrice(value) {
  var match = String(value || "").match(/\$([\d,]+(?:\.\d{1,2})?)/);
  return match ? match[1].replace(/,/g, "") : "";
}

function priceColumnIndexes(programKey, program) {
  if (programKey === "preschool") return (program.columns || []).map(function (_, index) { return index; }).slice(1);
  var tuitionIndex = (program.columns || []).findIndex(function (column) { return /tuition/i.test(column); });
  return tuitionIndex === -1 ? [] : [tuitionIndex];
}

function unitText(programKey) {
  if (programKey === "preschool" || programKey === "kindergarten") return "MONTH";
  if (programKey === "summer-camp") return "WEEK";
  return "COURSE";
}

function programOffers(programKey, program, page) {
  var indexes = priceColumnIndexes(programKey, program);
  var offers = [];
  (program.rows || []).forEach(function (row) {
    indexes.forEach(function (index) {
      var price = parsePrice(row[index]);
      if (!price) return;
      offers.push({
        "@type": "Offer",
        name: row[0] + " - " + program.columns[index],
        price: price,
        priceCurrency: "USD",
        url: SITE_URL + page + "#tuition-and-fees",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: price,
          priceCurrency: "USD",
          unitText: unitText(programKey)
        },
        description: String(row[index])
      });
    });
  });
  return offers;
}

function serviceSchema(programKey, program, page) {
  var schema = {
    "@type": "Service",
    "@id": SITE_URL + page + "#tuition-service",
    name: program.name + " tuition",
    provider: { "@id": SITE_URL + "#organization" },
    url: SITE_URL + page + "#tuition-and-fees"
  };
  var offers = programOffers(programKey, program, page);
  if (offers.length) schema.offers = offers;
  if (program.note) schema.description = program.note;
  return schema;
}

function renderJsonLd(data, programKey) {
  var schema;
  if (programKey) {
    schema = {
      "@context": "https://schema.org",
      "@graph": [serviceSchema(programKey, data.programs[programKey], PROGRAM_PAGES[programKey])]
    };
  } else {
    schema = {
      "@context": "https://schema.org",
      "@graph": (data.programOrder || []).filter(function (key) {
        return data.programs[key] && PROGRAM_PAGES[key];
      }).map(function (key) {
        return serviceSchema(key, data.programs[key], PROGRAM_PAGES[key]);
      })
    };
  }
  var json = JSON.stringify(schema, null, 2)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
  return '<script type="application/ld+json">\n' + json + "\n</script>";
}

function renderLlmsTuition(data) {
  var lines = ["## Current Tuition and Fees", "", "The amounts below are generated from the same published tuition data used by the website.", ""];
  (data.programOrder || []).forEach(function (programKey) {
    var program = data.programs[programKey];
    if (!program) return;
    lines.push("### " + tuitionHeading(program));
    if (program.note) lines.push("", program.note);
    (program.rows || []).forEach(function (row) {
      lines.push("- " + row.map(function (cell, index) {
        return (program.columns[index] || (index === 0 ? "Option" : "Price")) + ": " + cell;
      }).join("; "));
    });
    lines.push("");
  });
  lines.push("### " + (data.feesHeading || "Registration & other fees"));
  (data.fees || []).forEach(function (fee) {
    lines.push("- " + fee.label + (fee.text || ""));
  });
  return lines.join("\n");
}

function replaceFileRegion(file, startMarker, endMarker, content) {
  var text = fs.readFileSync(file, "utf8");
  var replaced = replaceGeneratedRegion(text, startMarker, endMarker, content, path.basename(file));
  fs.writeFileSync(file, replaced, "utf8");
}

function generatedRegion(text, startMarker, endMarker) {
  return text.slice(text.indexOf(startMarker) + startMarker.length, text.indexOf(endMarker));
}

function verifyPage(file, program) {
  var text = fs.readFileSync(file, "utf8");
  var content = generatedRegion(text, CONTENT_START, CONTENT_END);
  (program.rows || []).forEach(function (row) {
    row.forEach(function (cell) {
      if (content.indexOf(escapeHtml(cell)) === -1) {
        throw new Error(path.basename(file) + " is missing generated tuition value: " + cell);
      }
    });
  });

  var jsonLd = generatedRegion(text, JSONLD_START, JSONLD_END);
  var match = jsonLd.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  if (!match) throw new Error(path.basename(file) + " is missing generated tuition JSON-LD");
  JSON.parse(match[1]);
}

function verifyArtifact(root, data) {
  var centralFile = path.join(root, "tuition.html");
  (data.programOrder || []).forEach(function (programKey) {
    var program = data.programs[programKey];
    if (!program) return;
    verifyPage(centralFile, program);
    if (PROGRAM_PAGES[programKey]) verifyPage(path.join(root, PROGRAM_PAGES[programKey]), program);
  });

  var llms = generatedRegion(fs.readFileSync(path.join(root, "llms.txt"), "utf8"), CONTENT_START, CONTENT_END);
  (data.programOrder || []).forEach(function (programKey) {
    (data.programs[programKey].rows || []).forEach(function (row) {
      row.forEach(function (cell) {
        if (llms.indexOf(String(cell)) === -1) throw new Error("llms.txt is missing generated tuition value: " + cell);
      });
    });
  });
}

function prerender(destination) {
  var root = path.resolve(destination);
  var data = loadCmsData(root).tuition;

  replaceFileRegion(path.join(root, "tuition.html"), CONTENT_START, CONTENT_END, renderFullTuition(data));
  replaceFileRegion(path.join(root, "tuition.html"), JSONLD_START, JSONLD_END, renderJsonLd(data));

  Object.keys(PROGRAM_PAGES).forEach(function (programKey) {
    var file = path.join(root, PROGRAM_PAGES[programKey]);
    replaceFileRegion(file, CONTENT_START, CONTENT_END, renderProgram(
      data.programs[programKey],
      data.feesHeading,
      applicableFees(data, programKey)
    ));
    replaceFileRegion(file, JSONLD_START, JSONLD_END, renderJsonLd(data, programKey));
  });

  replaceFileRegion(path.join(root, "llms.txt"), CONTENT_START, CONTENT_END, renderLlmsTuition(data));
  verifyArtifact(root, data);
  return root;
}

if (require.main === module) {
  var destination = process.argv[2];
  if (!destination) {
    console.error("Usage: node scripts/prerender-tuition.js DEPLOYMENT_DIRECTORY");
    process.exit(1);
  }
  console.log("Prerendered tuition content in " + prerender(destination));
}

module.exports = {
  CONTENT_END: CONTENT_END,
  CONTENT_START: CONTENT_START,
  JSONLD_END: JSONLD_END,
  JSONLD_START: JSONLD_START,
  escapeHtml: escapeHtml,
  prerender: prerender,
  renderFullTuition: renderFullTuition,
  renderJsonLd: renderJsonLd,
  renderLlmsTuition: renderLlmsTuition,
  renderProgram: renderProgram,
  replaceGeneratedRegion: replaceGeneratedRegion,
  tuitionHeading: tuitionHeading,
  verifyArtifact: verifyArtifact
};