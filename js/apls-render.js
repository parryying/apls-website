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

  // Build the bulleted fee list from an array of { label, text }.
  function buildFeeList(fees) {
    var ul = el("ul", "fee-list");
    fees.forEach(function (fee) {
      var li = el("li");
      li.appendChild(el("strong", null, fee.label));
      if (fee.text) li.appendChild(document.createTextNode(fee.text));
      ul.appendChild(li);
    });
    return ul;
  }

  /* ---------- Tuition ---------- */
  function renderTuition() {
    var root = document.getElementById("tuition-root");
    if (!root || typeof window.APLS_TUITION === "undefined") return;
    var data = window.APLS_TUITION;
    root.innerHTML = "";

    (data.programOrder || Object.keys(data.programs || {})).forEach(function (programKey) {
      var program = (data.programs || {})[programKey];
      if (!program) return;
      if (program.heading) root.appendChild(el("h2", null, program.heading));
      if (program.note) root.appendChild(el("p", null, program.note));
      if ((program.columns || []).length && (program.rows || []).length) {
        root.appendChild(buildTuitionTable(program.columns, program.rows));
      }
    });

    // Fees
    if (data.fees && data.fees.length) {
      if (data.feesHeading) root.appendChild(el("h2", null, data.feesHeading));
      root.appendChild(buildFeeList(data.fees));
    }
  }

  function renderProgramTuition() {
    var roots = document.querySelectorAll("[data-tuition-program]");
    if (!roots.length || typeof window.APLS_TUITION === "undefined") return;
    var data = window.APLS_TUITION;
    roots.forEach(function (root) {
      var programKey = root.getAttribute("data-tuition-program");
      var program = (data.programs || {})[programKey];
      if (!program) return;

      root.innerHTML = "";
      root.appendChild(el("h2", null, program.heading || "Tuition"));
      if (program.note) root.appendChild(el("p", "program-tuition-note", program.note));

      var hasTable = (program.columns || []).length && (program.rows || []).length;
      if (hasTable) root.appendChild(buildTuitionTable(program.columns, program.rows));

      var fees = (data.fees || []).filter(function (fee) {
        return (fee.appliesTo || []).indexOf(programKey) !== -1;
      });
      if (fees.length) {
        root.appendChild(el("h2", null, data.feesHeading || "Registration & other fees"));
        root.appendChild(buildFeeList(fees));
      }

      if (!hasTable) {
        var actions = el("div", "program-tuition-actions");
        var contactLink = el("a", "btn btn-primary", "Contact for tuition");
        contactLink.href = "contact.html";
        actions.appendChild(contactLink);
        root.appendChild(actions);
      }
    });
  }

  function renderApplicationLinks() {
    var links = document.querySelectorAll("[data-application-program]");
    if (!links.length || typeof window.APLS_TUITION === "undefined") return;
    var programs = window.APLS_TUITION.programs || {};
    links.forEach(function (link) {
      var program = programs[link.getAttribute("data-application-program")];
      if (!program || !program.applicationUrl) return;
      link.href = program.applicationUrl;
      var term = program.term && program.term !== "Year-round" ? " — " + program.term : "";
      link.textContent = "\uD83D\uDCC4 " + (program.name || "Program") + " application" + term;
    });
  }

  function programStatus(program) {
    if (program.endDate) {
      var parts = program.endDate.split("-").map(Number);
      var endDate = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);
      if (new Date() > endDate) return "Closed";
    }
    return program.enrollmentStatus || "";
  }

  function statusLabel(status) {
    if (status === "Open") return "Now enrolling";
    if (status === "Closed") return "Enrollment closed";
    if (status === "Inquire") return "Inquire for availability";
    return status;
  }

  function formattedDate(value) {
    if (!value) return "";
    var parts = value.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(new Date(parts[0], parts[1] - 1, parts[2]));
  }

  function renderProgramContent() {
    if (typeof window.APLS_TUITION === "undefined") return;
    var programs = window.APLS_TUITION.programs || {};

    document.querySelectorAll("[data-program-status]").forEach(function (element) {
      var program = programs[element.getAttribute("data-program-status")];
      if (!program) return;
      var status = programStatus(program);
      element.textContent = statusLabel(status);
      element.classList.toggle("badge-open", status === "Open");
      element.classList.toggle("badge-status", status !== "Open");
      element.hidden = !status;
    });

    document.querySelectorAll("[data-program-status-text]").forEach(function (element) {
      var program = programs[element.getAttribute("data-program-status-text")];
      if (program) element.textContent = statusLabel(programStatus(program));
    });

    document.querySelectorAll("[data-program-schedule]").forEach(function (element) {
      var program = programs[element.getAttribute("data-program-schedule")];
      if (program && program.schedule) element.textContent = program.schedule;
    });

    document.querySelectorAll("[data-program-format]").forEach(function (element) {
      var program = programs[element.getAttribute("data-program-format")];
      if (program && program.format) element.textContent = program.format;
    });

    document.querySelectorAll("[data-program-term]").forEach(function (element) {
      var program = programs[element.getAttribute("data-program-term")];
      if (program && program.term) element.textContent = program.term;
    });

    document.querySelectorAll("[data-program-term-heading]").forEach(function (element) {
      var program = programs[element.getAttribute("data-program-term-heading")];
      if (program && program.term) element.textContent = program.name + " " + program.term + " schedule";
    });

    document.querySelectorAll("[data-program-date-range]").forEach(function (element) {
      var program = programs[element.getAttribute("data-program-date-range")];
      if (program && program.startDate && program.endDate) {
        element.textContent = formattedDate(program.startDate) + "\u2013" + formattedDate(program.endDate);
      }
    });

    document.querySelectorAll("[data-program-class-count]").forEach(function (element) {
      var program = programs[element.getAttribute("data-program-class-count")];
      var optionIndex = Number(element.getAttribute("data-option-index") || 0);
      var dates = program && (program.classDates || [])[optionIndex];
      if (dates) element.textContent = dates.length;
    });

    document.querySelectorAll("[data-program-class-dates]").forEach(function (body) {
      var program = programs[body.getAttribute("data-program-class-dates")];
      var optionIndex = Number(body.getAttribute("data-option-index") || 0);
      var dates = program && (program.classDates || [])[optionIndex];
      if (!dates || !dates.length) return;
      var months = [];
      var byMonth = {};
      dates.slice().sort().forEach(function (value) {
        var parts = value.split("-").map(Number);
        var date = new Date(parts[0], parts[1] - 1, parts[2]);
        var key = value.slice(0, 7);
        if (!byMonth[key]) {
          byMonth[key] = { date: date, days: [] };
          months.push(byMonth[key]);
        }
        byMonth[key].days.push(date.getDate());
      });
      body.innerHTML = "";
      months.forEach(function (month) {
        var row = el("tr");
        row.appendChild(el("td", null, new Intl.DateTimeFormat("en-US", { month: "long" }).format(month.date)));
        var shortMonth = new Intl.DateTimeFormat("en-US", { month: "short" }).format(month.date).replace("Sep", "Sept.").replace(/^(?!Sept\.)((?:Jan|Feb|Mar|Apr|Jun|Jul|Aug|Oct|Nov|Dec))$/, "$1.");
        row.appendChild(el("td", null, shortMonth + " " + month.days.join(", ")));
        if (body.closest("table").querySelectorAll("thead th").length > 2) row.appendChild(el("td", null, month.days.length));
        body.appendChild(row);
      });
    });
  }

  /* ---------- Calendar ---------- */
  function calendarYearForDate(years, value) {
    var parts = String(value || "").split("-").map(Number);
    if (parts.length !== 3 || !parts[0]) return null;
    var startYear = parts[1] >= 8 ? parts[0] : parts[0] - 1;
    return years.find(function (year) { return year.id === startYear + "-" + (startYear + 1); }) || null;
  }

  function programCalendarLabel(value) {
    var parts = value.split("-").map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    var month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date).replace("Sep", "Sept.");
    var weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
    return month + " " + date.getDate() + " (" + weekday + ")";
  }

  function calendarWithProgramDates(sourceYears) {
    var years = JSON.parse(JSON.stringify(sourceYears || []));
    var programs = (window.APLS_TUITION || {}).programs || {};
    var definitions = {
      "after-school": ["First day of the After-School program", "Last day of the After-School program"],
      "saturday-school": ["First day of Saturday School", "Last day of Saturday School"]
    };
    Object.keys(definitions).forEach(function (programKey) {
      var program = programs[programKey] || {};
      if (!program.startDate && !program.endDate) return;
      years.forEach(function (year) {
        (year.months || []).forEach(function (month) {
          month.events = (month.events || []).filter(function (event) {
            return event[1] !== definitions[programKey][0] && event[1] !== definitions[programKey][1];
          });
        });
      });
      [program.startDate, program.endDate].forEach(function (value, boundaryIndex) {
        if (!value) return;
        var year = calendarYearForDate(years, value);
        if (!year) return;
        var eventName = definitions[programKey][boundaryIndex];
        var parts = value.split("-").map(Number);
        var monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(parts[0], parts[1] - 1, parts[2]));
        var month = (year.months || []).find(function (item) { return item.name === monthName; });
        if (!month) {
          month = { name: monthName, events: [] };
          year.months = year.months || [];
          year.months.push(month);
        }
        month.events.push([programCalendarLabel(value), eventName, {
          startDate: value,
          endDate: "",
          category: "program-date",
          notes: "Managed from Programs & Tuition",
          managedProgram: programKey,
          managedBoundary: boundaryIndex === 0 ? "start" : "end"
        }]);
        month.events.sort(function (left, right) {
          var leftDate = left[2] && left[2].startDate;
          var rightDate = right[2] && right[2].startDate;
          if (leftDate && rightDate) return leftDate.localeCompare(rightDate);
          var leftDay = Number((left[0].match(/\d+/) || [999])[0]);
          var rightDay = Number((right[0].match(/\d+/) || [999])[0]);
          return leftDay - rightDay;
        });
        year.months.sort(function (left, right) {
          return new Date(left.name + " 1") - new Date(right.name + " 1");
        });
      });
    });
    return years;
  }

  function renderCalendar() {
    var root = document.getElementById("calendar-root");
    if (!root || typeof window.APLS_CALENDAR === "undefined") return;
    var data = window.APLS_CALENDAR;
    var years = calendarWithProgramDates(data.years || []);
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
    renderApplicationLinks();
    renderProgramContent();
    renderCalendar();
    renderTeachers();
  });
})();
