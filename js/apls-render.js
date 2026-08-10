/* ============================================================
   APLS page renderer  (do not edit unless you're the developer)
   ------------------------------------------------------------
   Reads the data files (data/tuition.js, data/calendar.js) and
   builds the tuition table and calendar tables on the page.
   Content is edited in the data files, NOT here.
   ============================================================ */
(function () {
  "use strict";

  // Small helper: create an element with optional class + text.
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // Build a tuition table from { columns, rows }.
  function buildTuitionTable(columns, rows) {
    var table = el("table", "schedule-table tuition-table");
    var thead = el("thead");
    var headRow = el("tr");
    (columns || []).forEach(function (col) {
      headRow.appendChild(el("th", null, col));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = el("tbody");
    (rows || []).forEach(function (row) {
      var tr = el("tr");
      row.forEach(function (cell) { tr.appendChild(el("td", null, cell)); });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  /* ---------- Tuition ---------- */
  function renderTuition() {
    var root = document.getElementById("tuition-root");
    if (!root || typeof window.APLS_TUITION === "undefined") return;
    var data = window.APLS_TUITION;
    root.innerHTML = "";

    if (data.heading) root.appendChild(el("h2", null, data.heading));
    if (data.note) root.appendChild(el("p", null, data.note));

    // Main table
    root.appendChild(buildTuitionTable(data.columns, data.rows));

    // Additional tables (e.g., Kindergarten & 1st Grade)
    (data.moreTables || []).forEach(function (t) {
      if (t.heading) root.appendChild(el("h2", null, t.heading));
      if (t.note) root.appendChild(el("p", null, t.note));
      root.appendChild(buildTuitionTable(t.columns, t.rows));
    });

    // Fees
    if (data.fees && data.fees.length) {
      if (data.feesHeading) root.appendChild(el("h2", null, data.feesHeading));
      var ul = el("ul", "fee-list");
      data.fees.forEach(function (fee) {
        var li = el("li");
        li.appendChild(el("strong", null, fee.label));
        if (fee.text) li.appendChild(document.createTextNode(fee.text));
        ul.appendChild(li);
      });
      root.appendChild(ul);
    }
  }

  function renderProgramTuition() {
    var roots = document.querySelectorAll("[data-tuition-program]");
    if (!roots.length || typeof window.APLS_TUITION === "undefined") return;
    var data = window.APLS_TUITION;
    roots.forEach(function (root) {
      var config = (data.programPages || {})[root.getAttribute("data-tuition-program")];
      if (!config) return;

      root.innerHTML = "";
      root.appendChild(el("h2", null, config.heading || "Tuition"));
      if (config.note) root.appendChild(el("p", "program-tuition-note", config.note));

      var tableData;
      if (config.table === "main") {
        tableData = data;
      } else if (typeof config.table === "number") {
        tableData = (data.moreTables || [])[config.table];
      }
      if (tableData) root.appendChild(buildTuitionTable(tableData.columns, tableData.rows));

      var actions = el("div", "program-tuition-actions");
      if (!tableData) {
        var contactLink = el("a", "btn btn-primary", "Ask about current tuition");
        contactLink.href = "contact.html";
        actions.appendChild(contactLink);
      }
      var detailsLink = el("a", tableData ? "btn btn-ghost" : "text-link", "View full tuition & fees");
      detailsLink.href = "tuition.html";
      actions.appendChild(detailsLink);
      root.appendChild(actions);
    });
  }

  /* ---------- Calendar ---------- */
  function renderCalendar() {
    var root = document.getElementById("calendar-root");
    if (!root || typeof window.APLS_CALENDAR === "undefined") return;
    var data = window.APLS_CALENDAR;
    var years = data.years || [];
    root.innerHTML = "";

    // Downloads (built from each year's PDF, so PDFs live in one place too)
    var withPdf = years.filter(function (y) { return y.pdf; });
    if (withPdf.length) {
      root.appendChild(el("h2", null, "Downloads"));
      var dl = el("p", "prog-downloads prog-downloads-stack");
      withPdf.forEach(function (y) {
        var a = el("a", null, "\uD83D\uDCC4 " + (y.pdfLabel || y.label));
        a.href = y.pdf;
        a.target = "_blank";
        a.rel = "noopener";
        dl.appendChild(a);
      });
      root.appendChild(dl);
    }

    // One table per school year
    years.forEach(function (year) {
      var h = el("h2", null, year.label);
      if (year.id) h.id = year.id;
      root.appendChild(h);

      var table = el("table", "schedule-table cal-table");
      var tbody = el("tbody");
      (year.months || []).forEach(function (month) {
        var monthRow = el("tr");
        var th = el("th", "cal-month", month.name);
        th.setAttribute("colspan", "2");
        monthRow.appendChild(th);
        tbody.appendChild(monthRow);

        (month.events || []).forEach(function (ev) {
          var tr = el("tr");
          tr.appendChild(el("td", null, ev[0]));
          tr.appendChild(el("td", null, ev[1]));
          tbody.appendChild(tr);
        });
      });
      table.appendChild(tbody);
      root.appendChild(table);
    });

    if (data.footnote) root.appendChild(el("p", "muted", data.footnote));
  }

  /* ---------- Teachers ---------- */
  function renderTeachers() {
    var root = document.getElementById("teachers-root");
    if (!root || typeof window.APLS_TEACHERS === "undefined") return;
    var list = window.APLS_TEACHERS;
    if (!list || !list.length) return;
    root.innerHTML = "";

    list.forEach(function (t) {
      var card = el("div", "card teacher-card");

      if (t.photo) {
        var img = document.createElement("img");
        img.className = "avatar-photo";
        img.src = t.photo;
        img.alt = t.name || "APLS teacher";
        img.loading = "lazy";
        card.appendChild(img);
      } else {
        card.appendChild(el("div", "avatar", t.icon || "\uD83D\uDC69\u200D\uD83C\uDFEB"));
      }

      if (t.name) card.appendChild(el("h3", null, t.name));

      var meta = [];
      if (t.role) meta.push(t.role);
      if (t.years !== undefined && t.years !== null && String(t.years).trim() !== "") {
        meta.push("with APLS for " + t.years + " years");
      }
      if (meta.length) card.appendChild(el("p", "teacher-meta", meta.join(" \u00b7 ")));

      if (t.bio) card.appendChild(el("p", "teacher-bio", t.bio));

      root.appendChild(card);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderTuition();
    renderProgramTuition();
    renderCalendar();
    renderTeachers();
  });
})();
