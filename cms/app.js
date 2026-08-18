(function () {
  "use strict";

  var STORAGE_KEY = "apls-cms-preview-draft-v1";
  var PROGRAMS = [
    ["preschool", "Preschool"],
    ["kindergarten", "Kindergarten & 1st Grade"],
    ["after-school", "After-School"],
    ["saturday-school", "Saturday School"],
    ["summer-camp", "Summer Camp"],
    ["ap-prep", "AP Prep"]
  ];
  var CALENDAR_CATEGORIES = [
    ["school-event", "School event"],
    ["school-closed", "School closed"],
    ["childcare", "Childcare"],
    ["camp", "Camp"],
    ["program-date", "Program date"]
  ];
  var SECTION_COPY = {
    overview: ["Website overview", "Choose a content area, make changes, and review the result before exporting.", "Content summary"],
    tuition: ["Tuition and fees", "Update prices, tables, program notes, and fees from one structured editor.", "Tuition page"],
    calendar: ["School calendar", "Enter one event per row. Weekdays and website groupings are calculated automatically.", "Calendar preview"],
    teachers: ["Teacher profiles", "Add, reorder, or update the profiles shown on the Why APLS page.", "Teacher section"]
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  var sourceState = {
    tuition: clone(window.APLS_TUITION || {}),
    calendar: clone(window.APLS_CALENDAR || { years: [] }),
    teachers: clone(window.APLS_TEACHERS || [])
  };
  var state = loadDraft() || clone(sourceState);
  sourceState.calendarRows = calendarToRows(sourceState.calendar);
  if (!Array.isArray(state.calendarRows)) state.calendarRows = calendarToRows(state.calendar);
  var activeSection = "overview";
  var selectedCalendarYear = 0;
  var selectedCalendarPreviewMonth = "";
  var isDirty = false;
  var toastTimer;

  var editorContent = document.getElementById("editor-content");
  var previewCanvas = document.getElementById("preview-canvas");
  var sectionTitle = document.getElementById("section-title");
  var sectionDescription = document.getElementById("section-description");
  var previewTitle = document.getElementById("preview-title");
  var draftPill = document.getElementById("draft-pill");
  var saveStatus = document.getElementById("save-status");
  var exportDialog = document.getElementById("export-dialog");

  function loadDraft() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;
      var parsed = JSON.parse(saved);
      if (!parsed.tuition || !parsed.calendar || !Array.isArray(parsed.teachers)) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function field(label, path, value, options) {
    options = options || {};
    var classes = "field" + (options.full ? " full" : "");
    var hint = options.hint ? '<span class="field-hint">' + escapeHtml(options.hint) + "</span>" : "";
    var control;
    if (options.textarea) {
      control = '<textarea data-path="' + escapeHtml(path) + '" rows="' + (options.rows || 3) + '">' + escapeHtml(value) + "</textarea>";
    } else {
      control = '<input type="' + (options.type || "text") + '" data-path="' + escapeHtml(path) + '" value="' + escapeHtml(value) + '" />';
    }
    return '<label class="' + classes + '"><span class="field-label"><span>' + escapeHtml(label) + "</span>" + hint + "</span>" + control + "</label>";
  }

  function blockHeading(title, description, actionHtml) {
    return '<div class="block-heading"><div><h2>' + escapeHtml(title) + "</h2><p>" + escapeHtml(description || "") + "</p></div>" + (actionHtml || "") + "</div>";
  }

  function getPath(root, path) {
    if (!path) return root;
    return path.split(".").reduce(function (value, key) {
      return value === undefined || value === null ? undefined : value[key];
    }, root);
  }

  function setPath(root, path, value) {
    var keys = path.split(".");
    var lastKey = keys.pop();
    var parent = keys.reduce(function (current, key) { return current[key]; }, root);
    parent[lastKey] = value;
  }

  function renderOverviewEditor() {
    var yearCount = (state.calendar.years || []).length;
    var teacherCount = state.teachers.length;
    var tableCount = 1 + (state.tuition.moreTables || []).length;
    editorContent.innerHTML =
      '<div class="summary-grid">' +
        summaryCard("02", "Tuition", tableCount + " pricing tables", "tuition") +
        summaryCard("03", "Calendar", yearCount + " school year" + (yearCount === 1 ? "" : "s"), "calendar") +
        summaryCard("04", "Teachers", teacherCount + " profile" + (teacherCount === 1 ? "" : "s"), "teachers") +
      "</div>" +
      '<section class="workflow"><h2>Preview workflow</h2><div class="workflow-steps">' +
        workflowStep("1", "Choose a section", "Open one of the structured content editors.") +
        workflowStep("2", "Review as you type", "The right panel reflects every field change.") +
        workflowStep("3", "Export a data file", "Download and replace the matching file in data/.") +
      "</div></section>";
  }

  function summaryCard(index, title, detail, section) {
    return '<button type="button" class="summary-card" data-open-section="' + section + '"><span class="summary-index">' + index + "</span><h2>" + escapeHtml(title) + "</h2><p>" + escapeHtml(detail) + "</p></button>";
  }

  function workflowStep(number, title, copy) {
    return '<div class="workflow-step"><span>' + number + "</span><div><strong>" + escapeHtml(title) + "</strong><p>" + escapeHtml(copy) + "</p></div></div>";
  }

  function renderTuitionEditor() {
    var tuition = state.tuition;
    var html = '<section class="editor-block">' +
      blockHeading("Preschool tuition", "Main heading, introduction, and pricing table.") +
      '<div class="field-grid">' +
        field("Section heading", "heading", tuition.heading) +
        field("Introduction", "note", tuition.note, { textarea: true, full: true }) +
      "</div>" +
      renderTableEditor("", tuition, false) +
      "</section>";

    html += '<section class="editor-block">' + blockHeading(
      "Additional program tables",
      "Each table appears below preschool tuition on the full Tuition page.",
      '<button class="small-button" type="button" data-action="add-tuition-table">Add table</button>'
    ) + '<div class="repeater-list">';
    (tuition.moreTables || []).forEach(function (table, index) {
      var base = "moreTables." + index;
      html += '<article class="repeater-item"><div class="repeater-heading"><div><span class="repeater-number">Table ' + (index + 1) + "</span><h3>" + escapeHtml(table.heading || "Untitled table") + '</h3></div><button class="danger-button" type="button" data-action="remove-item" data-path="moreTables" data-index="' + index + '">Remove table</button></div>' +
        '<div class="field-grid">' +
          field("Heading", base + ".heading", table.heading) +
          field("Program note", base + ".note", table.note || "", { textarea: true, full: true }) +
        "</div>" + renderTableEditor(base, table, true) + "</article>";
    });
    html += "</div></section>";

    html += '<section class="editor-block">' + blockHeading("Program page notes", "Compact headings and notes shown on individual program pages.") + '<div class="repeater-list">';
    Object.keys(tuition.programPages || {}).forEach(function (key) {
      var program = tuition.programPages[key];
      var base = "programPages." + key;
      html += '<article class="repeater-item"><div class="repeater-heading"><div><span class="repeater-number">' + escapeHtml(key) + "</span><h3>" + escapeHtml(program.heading || key) + "</h3></div></div>" +
        '<div class="field-grid">' +
          field("Heading", base + ".heading", program.heading || "") +
          field("Note", base + ".note", program.note || "", { textarea: true, full: true }) +
        "</div></article>";
    });
    html += "</div></section>";

    html += '<section class="editor-block">' +
      blockHeading("Registration and other fees", "Edit fee wording and choose which program pages display each fee.", '<button class="small-button" type="button" data-action="add-fee">Add fee</button>') +
      '<div class="field-grid">' + field("Section heading", "feesHeading", tuition.feesHeading || "") + "</div>" +
      '<div class="repeater-list">';
    (tuition.fees || []).forEach(function (fee, index) {
      var base = "fees." + index;
      html += '<article class="repeater-item"><div class="repeater-heading"><div><span class="repeater-number">Fee ' + (index + 1) + "</span><h3>" + escapeHtml(fee.label || "Untitled fee") + '</h3></div><button class="danger-button" type="button" data-action="remove-item" data-path="fees" data-index="' + index + '">Remove fee</button></div>' +
        '<div class="field-grid">' +
          field("Bold label", base + ".label", fee.label || "", { textarea: true, full: true, rows: 2 }) +
          field("Details", base + ".text", fee.text || "", { textarea: true, full: true, rows: 3 }) +
        '</div><div class="program-checks">' + renderProgramChecks(base, fee.appliesTo || []) + "</div></article>";
    });
    html += "</div></section>";
    editorContent.innerHTML = html;
  }

  function renderTableEditor(base, table, showLabel) {
    var pathPrefix = base ? base + "." : "";
    var columns = table.columns || [];
    var rows = table.rows || [];
    var html = '<div class="button-row">' +
      '<button class="small-button" type="button" data-action="add-table-row" data-path="' + escapeHtml(base) + '">Add row</button>' +
      '<button class="small-button" type="button" data-action="add-table-column" data-path="' + escapeHtml(base) + '">Add column</button>' +
      "</div>" + (showLabel ? '<span class="repeater-number">Table cells</span>' : "") + '<table class="table-editor"><thead><tr>';
    columns.forEach(function (column, columnIndex) {
      html += '<th><input class="cell-input" aria-label="Column ' + (columnIndex + 1) + ' heading" data-path="' + pathPrefix + "columns." + columnIndex + '" value="' + escapeHtml(column) + '" /><button class="remove-cell" type="button" aria-label="Remove column ' + (columnIndex + 1) + '" data-action="remove-table-column" data-path="' + escapeHtml(base) + '" data-index="' + columnIndex + '">&times;</button></th>';
    });
    html += '<th class="action-cell"><span class="field-hint">Row</span></th></tr></thead><tbody>';
    rows.forEach(function (row, rowIndex) {
      html += "<tr>";
      columns.forEach(function (_, columnIndex) {
        html += '<td><input class="cell-input" aria-label="Row ' + (rowIndex + 1) + ", column " + (columnIndex + 1) + '" data-path="' + pathPrefix + "rows." + rowIndex + "." + columnIndex + '" value="' + escapeHtml(row[columnIndex] || "") + '" /></td>';
      });
      html += '<td class="action-cell"><button class="remove-cell" type="button" aria-label="Remove row ' + (rowIndex + 1) + '" data-action="remove-table-row" data-path="' + escapeHtml(base) + '" data-index="' + rowIndex + '">&times;</button></td></tr>';
    });
    return html + "</tbody></table>";
  }

  function renderProgramChecks(base, selected) {
    return PROGRAMS.map(function (program) {
      var checked = selected.indexOf(program[0]) !== -1 ? " checked" : "";
      return '<label class="program-check"><input type="checkbox" data-program-path="' + escapeHtml(base) + '" data-program="' + escapeHtml(program[0]) + '"' + checked + " />" + escapeHtml(program[1]) + "</label>";
    }).join("");
  }

  function isoDate(year, month, day) {
    return [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
  }

  function parseCalendarDatePart(value, fallbackMonth, fallbackYear) {
    var monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    var match = String(value || "").trim().match(/^([A-Za-z]{3,9})?\s*(\d{1,2})/);
    if (!match) return null;
    var month = fallbackMonth;
    if (match[1]) month = monthNames.indexOf(match[1].slice(0, 3).toLowerCase()) + 1;
    if (!month) return null;
    return { year: fallbackYear, month: month, day: Number(match[2]) };
  }

  function parseCalendarDateLabel(label, monthName, metadata) {
    if (metadata && metadata.startDate) {
      return { startDate: metadata.startDate, endDate: metadata.endDate || "" };
    }
    var monthMatch = String(monthName || "").match(/([A-Za-z]+)\s+(\d{4})/);
    var monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    var fallbackMonth = monthMatch ? monthNames.indexOf(monthMatch[1].slice(0, 3).toLowerCase()) + 1 : 0;
    var fallbackYear = monthMatch ? Number(monthMatch[2]) : 0;
    var clean = String(label || "").replace(/\s*\([^)]*\)/g, "").trim();
    var parts = clean.split(/\s+[–—-]\s+/);
    var start = parseCalendarDatePart(parts[0], fallbackMonth, fallbackYear);
    if (!start) return { startDate: "", endDate: "" };
    var end = parts[1] ? parseCalendarDatePart(parts[1], start.month, start.year) : null;
    if (end && end.month < start.month) end.year += 1;
    return {
      startDate: isoDate(start.year, start.month, start.day),
      endDate: end ? isoDate(end.year, end.month, end.day) : ""
    };
  }

  function inferCalendarCategory(eventName) {
    var value = String(eventName || "").toLowerCase();
    if (/childcare/.test(value)) return "childcare";
    if (/camp/.test(value)) return "camp";
    if (/closed|closure|holiday/.test(value)) return "school-closed";
    if (/first day|last day|program/.test(value)) return "program-date";
    return "school-event";
  }

  function calendarToRows(calendar) {
    var rows = [];
    (calendar.years || []).forEach(function (year, yearIndex) {
      (year.months || []).forEach(function (month) {
        (month.events || []).forEach(function (event) {
          var metadata = event[2] || {};
          var dates = parseCalendarDateLabel(event[0], month.name, metadata);
          rows.push({
            yearIndex: yearIndex,
            startDate: dates.startDate,
            endDate: dates.endDate,
            event: event[1] || "",
            category: metadata.category || inferCalendarCategory(event[1]),
            notes: metadata.notes || "",
            monthName: month.name || ""
          });
        });
      });
    });
    return rows;
  }

  function dateFromIso(value) {
    var match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null;
    return date;
  }

  function categoryLabel(value) {
    var category = CALENDAR_CATEGORIES.find(function (item) { return item[0] === value; });
    return category ? category[1] : "School event";
  }

  function shortDateSummary(row) {
    var start = dateFromIso(row.startDate);
    var end = dateFromIso(row.endDate);
    if (!start) return "Choose a start date";
    var formatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
    if (!end) return formatter.format(start);
    return formatter.format(start) + " – " + formatter.format(end);
  }

  function calendarRowIssues(row, rowIndex) {
    var issues = [];
    var start = dateFromIso(row.startDate);
    var end = dateFromIso(row.endDate);
    if (!start) issues.push("Start date is required");
    if (!String(row.event || "").trim()) issues.push("Event name is required");
    if (start && row.endDate && !end) issues.push("End date is invalid");
    if (start && end && end < start) issues.push("End date is before start date");
    var year = (state.calendar.years || [])[Number(row.yearIndex)];
    var yearMatch = year && String(year.id || "").match(/^(\d{4})-(\d{4})$/);
    if (start && yearMatch) {
      var earliest = new Date(Number(yearMatch[1]), 7, 1);
      var latest = new Date(Number(yearMatch[2]), 7, 31);
      if (start < earliest || start > latest || (end && end > latest)) issues.push("Date is outside this school year");
    }
    if (start && String(row.event || "").trim()) {
      var duplicate = state.calendarRows.some(function (other, otherIndex) {
        return otherIndex !== rowIndex && Number(other.yearIndex) === Number(row.yearIndex) &&
          other.startDate === row.startDate && other.endDate === row.endDate &&
          String(other.event || "").trim().toLowerCase() === String(row.event || "").trim().toLowerCase();
      });
      if (duplicate) issues.push("Possible duplicate");
    }
    return issues;
  }

  function calendarValidationSummary(rows) {
    var issueRows = 0;
    rows.forEach(function (row) {
      var index = state.calendarRows.indexOf(row);
      if (calendarRowIssues(row, index).length) issueRows += 1;
    });
    return { ready: rows.length - issueRows, issues: issueRows };
  }

  function calendarCategoryOptions(selected) {
    return CALENDAR_CATEGORIES.map(function (category) {
      return '<option value="' + category[0] + '"' + (category[0] === selected ? " selected" : "") + ">" + category[1] + "</option>";
    }).join("");
  }

  function calendarYearOptions(selected) {
    return (state.calendar.years || []).map(function (year, index) {
      return '<option value="' + index + '"' + (index === Number(selected) ? " selected" : "") + ">" + escapeHtml(year.label || year.id || "School year") + "</option>";
    }).join("");
  }

  function renderCalendarEditor() {
    var calendar = state.calendar;
    if (selectedCalendarYear >= calendar.years.length) selectedCalendarYear = 0;
    var year = calendar.years[selectedCalendarYear] || {};
    var rows = state.calendarRows.filter(function (row) { return Number(row.yearIndex) === selectedCalendarYear; });
    var summary = calendarValidationSummary(rows);
    var html = '<div class="calendar-workbook">' +
      '<div class="sheet-tabs" role="tablist" aria-label="School years">' +
      (calendar.years || []).map(function (item, index) {
        return '<button type="button" role="tab" class="sheet-tab' + (index === selectedCalendarYear ? " is-active" : "") + '" aria-selected="' + (index === selectedCalendarYear) + '" data-action="select-calendar-year" data-index="' + index + '">' + escapeHtml(item.id || item.label) + "</button>";
      }).join("") +
      '<button type="button" class="sheet-tab sheet-tab-add" data-action="add-year">+ New year</button></div>' +
      '<section class="sheet-setup"><div class="field-grid three">' +
        field("School-year label", "years." + selectedCalendarYear + ".label", year.label || "") +
        field("School-year ID", "years." + selectedCalendarYear + ".id", year.id || "", { hint: "YYYY-YYYY" }) +
        field("PDF filename", "years." + selectedCalendarYear + ".pdf", year.pdf || "", { hint: "Generated later" }) +
      "</div></section>" +
      '<section class="sheet-status" aria-live="polite"><div><strong data-calendar-count="events">' + rows.length + '</strong><span>events</span></div><div class="is-ready"><strong data-calendar-count="ready">' + summary.ready + '</strong><span>ready</span></div><div class="' + (summary.issues ? "has-issues" : "is-ready") + '"><strong data-calendar-count="issues">' + summary.issues + "</strong><span>need attention</span></div>" +
      '<button class="small-button" type="button" data-action="add-calendar-row">Add event row</button></section>' +
      '<section class="calendar-sheet-wrap"><table class="calendar-sheet"><thead><tr><th class="sheet-row-number">#</th><th>School year</th><th>Start date</th><th>End date</th><th class="sheet-event-column">Event</th><th>Category</th><th>Notes</th><th>Check</th><th class="sheet-action-column"></th></tr></thead><tbody>';
    rows.forEach(function (row) {
      var rowIndex = state.calendarRows.indexOf(row);
      var issues = calendarRowIssues(row, rowIndex);
      html += '<tr class="calendar-sheet-row' + (issues.length ? " has-error" : "") + '">' +
        '<th scope="row" class="sheet-row-number">' + (rowIndex + 1) + "</th>" +
        '<td><select aria-label="School year for row ' + (rowIndex + 1) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="yearIndex">' + calendarYearOptions(row.yearIndex) + "</select></td>" +
        '<td><input type="date" aria-label="Start date for row ' + (rowIndex + 1) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="startDate" value="' + escapeHtml(row.startDate) + '" /></td>' +
        '<td><input type="date" aria-label="End date for row ' + (rowIndex + 1) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="endDate" value="' + escapeHtml(row.endDate) + '" /></td>' +
        '<td><input type="text" aria-label="Event name for row ' + (rowIndex + 1) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="event" value="' + escapeHtml(row.event) + '" /></td>' +
        '<td><select aria-label="Category for row ' + (rowIndex + 1) + '" class="category-select category-' + escapeHtml(row.category) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="category">' + calendarCategoryOptions(row.category) + "</select></td>" +
        '<td><input type="text" aria-label="Notes for row ' + (rowIndex + 1) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="notes" value="' + escapeHtml(row.notes) + '" /></td>' +
        '<td class="sheet-check"><span class="' + (issues.length ? "check-error" : "check-ready") + '">' + escapeHtml(issues[0] || shortDateSummary(row)) + "</span></td>" +
        '<td><button class="remove-cell" type="button" aria-label="Remove event row ' + (rowIndex + 1) + '" data-action="remove-calendar-row" data-index="' + rowIndex + '">&times;</button></td></tr>';
    });
    html += '</tbody></table></section><div class="sheet-footer"><button class="small-button" type="button" data-action="add-calendar-row">Add event row</button><span>Weekdays are calculated from the dates. Leave End date blank for a one-day event.</span></div>' +
      '<details class="calendar-settings"><summary>Calendar notes and download settings</summary><div class="field-grid">' +
        field("PDF link label", "years." + selectedCalendarYear + ".pdfLabel", year.pdfLabel || "") +
        field("Calendar footnote", "footnote", calendar.footnote || "", { textarea: true, full: true }) +
      "</div></details></div>";
    editorContent.innerHTML = html;
  }

  function renderTeachersEditor() {
    var html = '<section class="editor-block">' + blockHeading("Teacher profiles", "Profiles appear in this order on the Why APLS page.", '<button class="small-button" type="button" data-action="add-teacher">Add teacher</button>') + '<div class="repeater-list">';
    state.teachers.forEach(function (teacher, index) {
      var base = String(index);
      html += '<article class="repeater-item"><div class="repeater-heading"><div><span class="repeater-number">Profile ' + (index + 1) + "</span><h3>" + escapeHtml(teacher.name || "Unnamed teacher") + '</h3></div><button class="danger-button" type="button" data-action="remove-teacher" data-index="' + index + '">Remove profile</button></div>' +
        '<div class="field-grid">' +
          field("Name", base + ".name", teacher.name || "") +
          field("Role or program", base + ".role", teacher.role || "") +
          field("Years at APLS", base + ".years", teacher.years || "", { hint: "Leave blank to hide" }) +
          field("Photo path", base + ".photo", teacher.photo || "", { hint: "Example: images/teacher.jpg" }) +
          field("Fallback icon", base + ".icon", teacher.icon || "", { hint: "Shown when no photo is set" }) +
          field("Biography", base + ".bio", teacher.bio || "", { textarea: true, full: true }) +
        "</div></article>";
    });
    html += "</div></section>";
    editorContent.innerHTML = html;
  }

  function renderEditor() {
    if (activeSection === "overview") renderOverviewEditor();
    if (activeSection === "tuition") renderTuitionEditor();
    if (activeSection === "calendar") renderCalendarEditor();
    if (activeSection === "teachers") renderTeachersEditor();
  }

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function previewTable(columns, rows) {
    var table = node("table", "preview-table");
    var head = node("thead");
    var headRow = node("tr");
    (columns || []).forEach(function (column) { headRow.appendChild(node("th", "", column)); });
    head.appendChild(headRow);
    table.appendChild(head);
    var body = node("tbody");
    (rows || []).forEach(function (row) {
      var tr = node("tr");
      row.forEach(function (cell) { tr.appendChild(node("td", "", cell)); });
      body.appendChild(tr);
    });
    table.appendChild(body);
    return table;
  }

  function renderOverviewPreview() {
    var wrapper = node("div", "preview-summary");
    var summaries = [
      [(state.tuition.moreTables || []).length + 1, "Pricing tables", (state.tuition.fees || []).length + " registration and other fees"],
      [(state.calendar.years || []).length, "School years", countCalendarEvents() + " calendar events"],
      [state.teachers.length, "Teacher profiles", "Shown on the Why APLS page"]
    ];
    summaries.forEach(function (summary) {
      var row = node("div", "preview-summary-row");
      row.appendChild(node("span", "", summary[0]));
      var copy = node("div");
      copy.appendChild(node("strong", "", summary[1]));
      copy.appendChild(node("small", "", summary[2]));
      row.appendChild(copy);
      wrapper.appendChild(row);
    });
    previewCanvas.replaceChildren(wrapper);
  }

  function countCalendarEvents() {
    return (state.calendar.years || []).reduce(function (yearTotal, year) {
      return yearTotal + (year.months || []).reduce(function (monthTotal, month) {
        return monthTotal + (month.events || []).length;
      }, 0);
    }, 0);
  }

  function renderTuitionPreview() {
    var fragment = document.createDocumentFragment();
    var tuition = state.tuition;
    if (tuition.heading) fragment.appendChild(node("h2", "", tuition.heading));
    if (tuition.note) fragment.appendChild(node("p", "", tuition.note));
    fragment.appendChild(previewTable(tuition.columns, tuition.rows));
    (tuition.moreTables || []).forEach(function (table) {
      if (table.heading) fragment.appendChild(node("h2", "", table.heading));
      if (table.note) fragment.appendChild(node("p", "", table.note));
      fragment.appendChild(previewTable(table.columns, table.rows));
    });
    if ((tuition.fees || []).length) {
      fragment.appendChild(node("h2", "", tuition.feesHeading || "Registration & other fees"));
      var list = node("ul", "preview-fees");
      tuition.fees.forEach(function (fee) {
        var item = node("li");
        item.appendChild(node("strong", "", fee.label || ""));
        if (fee.text) item.appendChild(document.createTextNode(fee.text));
        list.appendChild(item);
      });
      fragment.appendChild(list);
    }
    previewCanvas.replaceChildren(fragment);
  }

  function calendarMonthKey(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
  }

  function calendarPreviewMonths() {
    var year = (state.calendar.years || [])[selectedCalendarYear] || {};
    var match = String(year.id || "").match(/^(\d{4})-(\d{4})$/);
    var months = [];
    if (match) {
      var startYear = Number(match[1]);
      for (var offset = 0; offset < 12; offset += 1) {
        months.push(new Date(startYear, 7 + offset, 1));
      }
      return months;
    }
    state.calendarRows.filter(function (row) {
      return Number(row.yearIndex) === selectedCalendarYear && dateFromIso(row.startDate);
    }).forEach(function (row) {
      var date = dateFromIso(row.startDate);
      if (!months.some(function (month) { return calendarMonthKey(month) === calendarMonthKey(date); })) {
        months.push(new Date(date.getFullYear(), date.getMonth(), 1));
      }
    });
    return months.sort(function (left, right) { return left - right; });
  }

  function selectedPreviewDate(months, rows) {
    var selected = months.find(function (month) { return calendarMonthKey(month) === selectedCalendarPreviewMonth; });
    if (selected) return selected;
    var firstEvent = rows.map(function (row) { return dateFromIso(row.startDate); }).filter(Boolean).sort(function (left, right) { return left - right; })[0];
    selected = firstEvent && months.find(function (month) { return calendarMonthKey(month) === calendarMonthKey(firstEvent); });
    selected = selected || months[0] || new Date();
    selectedCalendarPreviewMonth = calendarMonthKey(selected);
    return selected;
  }

  function calendarEventsForDate(rows, date) {
    var target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return rows.filter(function (row) {
      var start = dateFromIso(row.startDate);
      var end = dateFromIso(row.endDate) || start;
      return start && target >= start && target <= end;
    });
  }

  function calendarRowsForMonth(rows, monthDate) {
    var monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    var monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    return rows.filter(function (row) {
      var start = dateFromIso(row.startDate);
      var end = dateFromIso(row.endDate) || start;
      return start && start <= monthEnd && end >= monthStart;
    }).sort(function (left, right) {
      return left.startDate.localeCompare(right.startDate) || left.event.localeCompare(right.event);
    });
  }

  function renderCalendarPreview() {
    var rows = state.calendarRows.filter(function (row, index) {
      return Number(row.yearIndex) === selectedCalendarYear && !calendarRowIssues(row, index).length;
    });
    var allYearRows = state.calendarRows.filter(function (row) { return Number(row.yearIndex) === selectedCalendarYear; });
    var months = calendarPreviewMonths();
    var monthDate = selectedPreviewDate(months, rows);
    var monthIndex = months.findIndex(function (month) { return calendarMonthKey(month) === calendarMonthKey(monthDate); });
    var monthRows = calendarRowsForMonth(rows, monthDate);
    var wrapper = node("div", "calendar-month-preview");

    var toolbar = node("div", "calendar-preview-toolbar");
    var previous = node("button", "calendar-preview-nav", "<");
    previous.type = "button";
    previous.setAttribute("aria-label", "Previous month");
    previous.dataset.action = "previous-preview-month";
    previous.disabled = monthIndex <= 0;
    toolbar.appendChild(previous);
    var title = node("div", "calendar-preview-title");
    title.appendChild(node("strong", "", new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(monthDate)));
    title.appendChild(node("small", "", "Month " + (monthIndex + 1) + " of " + months.length));
    toolbar.appendChild(title);
    var next = node("button", "calendar-preview-nav", ">");
    next.type = "button";
    next.setAttribute("aria-label", "Next month");
    next.dataset.action = "next-preview-month";
    next.disabled = monthIndex >= months.length - 1;
    toolbar.appendChild(next);
    wrapper.appendChild(toolbar);

    var weekdays = node("div", "calendar-preview-weekdays");
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(function (weekday) {
      weekdays.appendChild(node("span", "", weekday));
    });
    wrapper.appendChild(weekdays);

    var grid = node("div", "calendar-preview-grid");
    var firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    var daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    for (var leading = 0; leading < firstDay.getDay(); leading += 1) {
      grid.appendChild(node("div", "calendar-preview-day is-outside"));
    }
    for (var day = 1; day <= daysInMonth; day += 1) {
      var date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      var dayCell = node("div", "calendar-preview-day" + (date.getDay() === 0 || date.getDay() === 6 ? " is-weekend" : ""));
      dayCell.appendChild(node("span", "calendar-preview-day-number", day));
      calendarEventsForDate(rows, date).forEach(function (row) {
        var eventIndex = state.calendarRows.indexOf(row);
        var agendaNumber = monthRows.indexOf(row) + 1;
        var eventButton = node("button", "calendar-preview-event preview-category-" + (row.category || "school-event"), agendaNumber);
        eventButton.type = "button";
        eventButton.dataset.action = "focus-calendar-row";
        eventButton.dataset.index = eventIndex;
        eventButton.setAttribute("aria-label", "Event " + agendaNumber + ": " + row.event + ", " + shortDateSummary(row));
        eventButton.title = "Event " + agendaNumber + ": " + shortDateSummary(row) + ": " + row.event + (row.notes ? " — " + row.notes : "");
        dayCell.appendChild(eventButton);
      });
      grid.appendChild(dayCell);
    }
    while (grid.children.length % 7) grid.appendChild(node("div", "calendar-preview-day is-outside"));
    wrapper.appendChild(grid);

    var usedCategories = CALENDAR_CATEGORIES.filter(function (category) {
      return rows.some(function (row) { return row.category === category[0]; });
    });
    var legend = node("div", "calendar-preview-legend");
    usedCategories.forEach(function (category) {
      var item = node("span", "");
      item.appendChild(node("i", "preview-category-" + category[0]));
      item.appendChild(document.createTextNode(category[1]));
      legend.appendChild(item);
    });
    wrapper.appendChild(legend);

    var agenda = node("section", "calendar-preview-agenda");
    var agendaHeading = node("div", "calendar-preview-agenda-heading");
    agendaHeading.appendChild(node("h3", "", "Full monthly details"));
    agendaHeading.appendChild(node("span", "", monthRows.length + " event" + (monthRows.length === 1 ? "" : "s")));
    agenda.appendChild(agendaHeading);
    if (!monthRows.length) {
      agenda.appendChild(node("p", "calendar-preview-empty", "No events are scheduled for this month."));
    }
    monthRows.forEach(function (row, agendaIndex) {
      var eventIndex = state.calendarRows.indexOf(row);
      var agendaItem = node("button", "calendar-preview-agenda-item");
      agendaItem.type = "button";
      agendaItem.dataset.action = "focus-calendar-row";
      agendaItem.dataset.index = eventIndex;
      agendaItem.appendChild(node("span", "calendar-preview-agenda-number preview-category-" + (row.category || "school-event"), agendaIndex + 1));
      var agendaCopy = node("span", "calendar-preview-agenda-copy");
      agendaCopy.appendChild(node("strong", "", row.event));
      agendaCopy.appendChild(node("span", "", shortDateSummary(row) + " · " + categoryLabel(row.category)));
      if (row.notes) agendaCopy.appendChild(node("small", "", row.notes));
      agendaItem.appendChild(agendaCopy);
      agendaItem.appendChild(node("span", "calendar-preview-agenda-edit", "Edit"));
      agenda.appendChild(agendaItem);
    });
    wrapper.appendChild(agenda);

    var issueCount = allYearRows.length - rows.length;
    if (issueCount) wrapper.appendChild(node("p", "calendar-preview-warning", issueCount + " row" + (issueCount === 1 ? " needing attention is" : "s needing attention are") + " not shown."));
    previewCanvas.replaceChildren(wrapper);
  }

  function renderTeachersPreview() {
    var grid = node("div", "teacher-preview-grid");
    state.teachers.forEach(function (teacher) {
      var card = node("article", "teacher-preview");
      if (teacher.photo) {
        var image = node("img");
        image.src = "../" + teacher.photo.replace(/^\.\.\//, "");
        image.alt = teacher.name || "APLS teacher";
        card.appendChild(image);
      } else {
        card.appendChild(node("div", "teacher-avatar", teacher.icon || "T"));
      }
      card.appendChild(node("h3", "", teacher.name || "Teacher name"));
      var meta = [teacher.role];
      if (String(teacher.years || "").trim()) meta.push("with APLS for " + teacher.years + " years");
      card.appendChild(node("p", "", meta.filter(Boolean).join(" | ")));
      if (teacher.bio) card.appendChild(node("p", "", teacher.bio));
      grid.appendChild(card);
    });
    previewCanvas.replaceChildren(grid);
  }

  function renderPreview() {
    previewCanvas.classList.toggle("is-calendar-preview", activeSection === "calendar");
    if (activeSection === "overview") renderOverviewPreview();
    if (activeSection === "tuition") renderTuitionPreview();
    if (activeSection === "calendar") renderCalendarPreview();
    if (activeSection === "teachers") renderTeachersPreview();
  }

  function selectSection(section) {
    if (!SECTION_COPY[section]) return;
    activeSection = section;
    document.querySelectorAll("[data-section]").forEach(function (button) {
      var isActive = button.dataset.section === section;
      button.classList.toggle("is-active", isActive);
      if (isActive) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    sectionTitle.textContent = SECTION_COPY[section][0];
    sectionDescription.textContent = SECTION_COPY[section][1];
    previewTitle.textContent = SECTION_COPY[section][2];
    renderEditor();
    renderPreview();
    document.getElementById("editor").focus({ preventScroll: true });
  }

  function markDirty() {
    isDirty = true;
    draftPill.textContent = "Unsaved changes";
    draftPill.classList.add("is-dirty");
    saveStatus.textContent = "Changes not saved";
  }

  function markSaved() {
    isDirty = false;
    draftPill.textContent = "Draft saved locally";
    draftPill.classList.remove("is-dirty");
    saveStatus.textContent = "Draft saved in this browser";
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      markSaved();
      showToast("Draft saved in this browser.");
    } catch (error) {
      showToast("This browser blocked local draft storage.");
    }
  }

  function resetDraft() {
    if (!window.confirm("Discard this browser draft and reload the website source data?")) return;
    state = clone(sourceState);
    localStorage.removeItem(STORAGE_KEY);
    isDirty = false;
    draftPill.textContent = "No unsaved changes";
    draftPill.classList.remove("is-dirty");
    saveStatus.textContent = "Source data loaded";
    renderEditor();
    renderPreview();
    showToast("Draft reset to the website source data.");
  }

  function showToast(message) {
    var toast = document.getElementById("toast");
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(function () { toast.classList.remove("is-visible"); }, 2600);
  }

  function tableAt(path) {
    return path ? getPath(state.tuition, path) : state.tuition;
  }

  function monthHeadingForDate(value) {
    var date = dateFromIso(value);
    if (!date) return "Unscheduled";
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
  }

  function websiteDatePart(date, includeMonth) {
    var month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
    var weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
    return (includeMonth ? month + " " : "") + date.getDate() + " (" + weekday + ")";
  }

  function websiteDateLabel(row) {
    var start = dateFromIso(row.startDate);
    var end = dateFromIso(row.endDate);
    if (!start) return "Date needed";
    var label = websiteDatePart(start, true);
    if (!end) return label;
    var sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
    return label + " – " + websiteDatePart(end, !sameMonth);
  }

  function syncCalendarFromRows() {
    (state.calendar.years || []).forEach(function (year, yearIndex) {
      var groups = [];
      var byName = {};
      state.calendarRows.filter(function (row) {
        return Number(row.yearIndex) === yearIndex && dateFromIso(row.startDate) && String(row.event || "").trim();
      }).sort(function (left, right) {
        return left.startDate.localeCompare(right.startDate) || left.event.localeCompare(right.event);
      }).forEach(function (row) {
        var monthName = row.monthName || monthHeadingForDate(row.startDate);
        if (!byName[monthName]) {
          byName[monthName] = { name: monthName, events: [], firstDate: row.startDate };
          groups.push(byName[monthName]);
        }
        byName[monthName].events.push([
          websiteDateLabel(row),
          row.event,
          {
            startDate: row.startDate,
            endDate: row.endDate || "",
            category: row.category || "school-event",
            notes: row.notes || ""
          }
        ]);
      });
      groups.sort(function (left, right) { return left.firstDate.localeCompare(right.firstDate); });
      year.months = groups.map(function (group) { return { name: group.name, events: group.events }; });
    });
  }

  function updateCalendarFeedback(rowIndex, tableRow) {
    var row = state.calendarRows[rowIndex];
    var issues = calendarRowIssues(row, rowIndex);
    if (tableRow) {
      tableRow.classList.toggle("has-error", Boolean(issues.length));
      var check = tableRow.querySelector(".sheet-check span");
      if (check) {
        check.className = issues.length ? "check-error" : "check-ready";
        check.textContent = issues[0] || shortDateSummary(row);
      }
    }
    var visibleRows = state.calendarRows.filter(function (item) { return Number(item.yearIndex) === selectedCalendarYear; });
    var summary = calendarValidationSummary(visibleRows);
    var eventCount = editorContent.querySelector('[data-calendar-count="events"]');
    var readyCount = editorContent.querySelector('[data-calendar-count="ready"]');
    var issueCount = editorContent.querySelector('[data-calendar-count="issues"]');
    if (eventCount) eventCount.textContent = visibleRows.length;
    if (readyCount) readyCount.textContent = summary.ready;
    if (issueCount) {
      issueCount.textContent = summary.issues;
      issueCount.parentElement.className = summary.issues ? "has-issues" : "is-ready";
    }
  }

  function calendarHasErrors() {
    return state.calendarRows.some(function (row, index) { return calendarRowIssues(row, index).length; });
  }

  function mutateFromAction(button) {
    var action = button.dataset.action;
    if (!action) return false;
    var path = button.dataset.path;
    var index = Number(button.dataset.index);

    if (action === "select-calendar-year") {
      selectedCalendarYear = index;
      selectedCalendarPreviewMonth = "";
      renderEditor();
      renderPreview();
      return true;
    }
    if (action === "previous-preview-month" || action === "next-preview-month") {
      var previewMonths = calendarPreviewMonths();
      var currentPreviewIndex = previewMonths.findIndex(function (month) { return calendarMonthKey(month) === selectedCalendarPreviewMonth; });
      var direction = action === "previous-preview-month" ? -1 : 1;
      var targetMonth = previewMonths[currentPreviewIndex + direction];
      if (targetMonth) selectedCalendarPreviewMonth = calendarMonthKey(targetMonth);
      renderPreview();
      return true;
    }
    if (action === "focus-calendar-row") {
      var rowInput = editorContent.querySelector('[data-calendar-index="' + index + '"][data-calendar-field="event"]');
      if (rowInput) {
        rowInput.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        rowInput.focus({ preventScroll: true });
      }
      return true;
    }

    if (action === "remove-item") getPath(activeSection === "calendar" ? state.calendar : state.tuition, path).splice(index, 1);
    if (action === "add-tuition-table") state.tuition.moreTables.push({ heading: "New program", note: "", columns: ["Program", "Tuition"], rows: [["Option", "$0"]] });
    if (action === "add-fee") state.tuition.fees.push({ appliesTo: [], label: "New fee", text: "" });
    if (action === "add-table-row") {
      var rowTable = tableAt(path);
      rowTable.rows.push(rowTable.columns.map(function () { return ""; }));
    }
    if (action === "remove-table-row") tableAt(path).rows.splice(index, 1);
    if (action === "add-table-column") {
      var addColumnTable = tableAt(path);
      addColumnTable.columns.push("New column");
      addColumnTable.rows.forEach(function (row) { row.push(""); });
    }
    if (action === "remove-table-column") {
      var removeColumnTable = tableAt(path);
      if (removeColumnTable.columns.length <= 1) {
        showToast("A table needs at least one column.");
        return false;
      }
      removeColumnTable.columns.splice(index, 1);
      removeColumnTable.rows.forEach(function (row) { row.splice(index, 1); });
    }
    if (action === "add-year") {
      state.calendarRows.forEach(function (row) { row.yearIndex = Number(row.yearIndex) + 1; });
      var currentId = state.calendar.years[0] && state.calendar.years[0].id;
      var match = String(currentId || "").match(/^(\d{4})-(\d{4})$/);
      var startYear = match ? Number(match[1]) + 1 : new Date().getFullYear();
      state.calendar.years.unshift({
        label: startYear + "–" + (startYear + 1) + " school year",
        id: startYear + "-" + (startYear + 1),
        pdf: "pdfs/" + startYear + "-" + (startYear + 1) + "-Calendar.pdf",
        pdfLabel: startYear + "–" + (startYear + 1) + " school calendar (PDF)",
        months: []
      });
      selectedCalendarYear = 0;
      selectedCalendarPreviewMonth = "";
    }
    if (action === "add-calendar-row") {
      state.calendarRows.push({ yearIndex: selectedCalendarYear, startDate: "", endDate: "", event: "", category: "school-event", notes: "", monthName: "" });
    }
    if (action === "remove-calendar-row") state.calendarRows.splice(index, 1);
    if (action === "add-teacher") state.teachers.push({ name: "Teacher name", role: "", years: "", bio: "", photo: "", icon: "T" });
    if (action === "remove-teacher") state.teachers.splice(index, 1);
    markDirty();
    syncCalendarFromRows();
    renderEditor();
    renderPreview();
    return true;
  }

  function fileContent(section) {
    var headers = {
      tuition: "/* APLS tuition data - exported from Content Studio */\nwindow.APLS_TUITION = ",
      calendar: "/* APLS calendar data - exported from Content Studio */\nwindow.APLS_CALENDAR = ",
      teachers: "/* APLS teacher data - exported from Content Studio */\nwindow.APLS_TEACHERS = "
    };
    if (section === "calendar") syncCalendarFromRows();
    return headers[section] + JSON.stringify(state[section], null, 2) + ";\n";
  }

  function exportFile(section) {
    if (!state[section]) return;
    if (section === "calendar" && calendarHasErrors()) {
      showToast("Fix the calendar rows marked for attention before exporting.");
      return;
    }
    var blob = new Blob([fileContent(section)], { type: "text/javascript;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = section + ".js";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    exportDialog.close();
    showToast(section + ".js downloaded. Exporting did not publish it.");
  }

  document.addEventListener("click", function (event) {
    var sectionButton = event.target.closest("[data-section], [data-open-section]");
    if (sectionButton) {
      selectSection(sectionButton.dataset.section || sectionButton.dataset.openSection);
      return;
    }
    var actionButton = event.target.closest("[data-action]");
    if (actionButton) mutateFromAction(actionButton);
    var exportOption = event.target.closest("[data-export]");
    if (exportOption) exportFile(exportOption.dataset.export);
  });

  editorContent.addEventListener("input", function (event) {
    var calendarInput = event.target.closest("[data-calendar-field]");
    if (calendarInput) {
      var rowIndex = Number(calendarInput.dataset.calendarIndex);
      var row = state.calendarRows[rowIndex];
      var fieldName = calendarInput.dataset.calendarField;
      row[fieldName] = fieldName === "yearIndex" ? Number(calendarInput.value) : calendarInput.value;
      if (fieldName === "startDate") row.monthName = monthHeadingForDate(row.startDate);
      if (fieldName === "category") calendarInput.className = "category-select category-" + row.category;
      markDirty();
      syncCalendarFromRows();
      updateCalendarFeedback(rowIndex, calendarInput.closest("tr"));
      renderPreview();
      return;
    }
    var input = event.target.closest("[data-path]");
    if (input) {
      setPath(state[activeSection], input.dataset.path, input.value);
      markDirty();
      renderPreview();
      return;
    }
    var checkbox = event.target.closest("[data-program-path]");
    if (checkbox) {
      var fee = getPath(state.tuition, checkbox.dataset.programPath);
      fee.appliesTo = fee.appliesTo || [];
      var existing = fee.appliesTo.indexOf(checkbox.dataset.program);
      if (checkbox.checked && existing === -1) fee.appliesTo.push(checkbox.dataset.program);
      if (!checkbox.checked && existing !== -1) fee.appliesTo.splice(existing, 1);
      markDirty();
      renderPreview();
    }
  });

  editorContent.addEventListener("change", function (event) {
    var calendarInput = event.target.closest('[data-calendar-field="yearIndex"]');
    if (!calendarInput) return;
    renderEditor();
    renderPreview();
  });

  document.getElementById("save-button").addEventListener("click", saveDraft);
  document.getElementById("reset-button").addEventListener("click", resetDraft);
  document.getElementById("export-button").addEventListener("click", function () {
    if (activeSection === "overview") exportDialog.showModal();
    else exportFile(activeSection);
  });
  document.getElementById("close-export").addEventListener("click", function () { exportDialog.close(); });
  exportDialog.addEventListener("click", function (event) {
    if (event.target === exportDialog) exportDialog.close();
  });
  document.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveDraft();
    }
  });
  window.addEventListener("beforeunload", function (event) {
    if (!isDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  selectSection("overview");
  if (loadDraft()) {
    draftPill.textContent = "Local draft loaded";
    saveStatus.textContent = "Local draft loaded";
  }
})();