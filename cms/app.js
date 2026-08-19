(function () {
  "use strict";

  var STORAGE_KEY = "apls-cms-preview-draft-v2";
  var PROGRAMS = [
    ["preschool", "Preschool"],
    ["kindergarten", "Kindergarten & 1st Grade"],
    ["after-school", "After-School"],
    ["saturday-school", "Saturday School"],
    ["summer-camp", "Summer Camp"],
    ["ap-prep", "AP Prep"]
  ];
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var CALENDAR_CATEGORIES = [
    ["school-event", "School event"],
    ["school-closed", "School closed"],
    ["childcare", "Childcare"],
    ["camp", "Camp"],
    ["program-date", "Program date"]
  ];
  var SECTION_COPY = {
    overview: ["Website overview", "Choose a content area, make changes, and review the result before exporting.", "Content summary"],
    tuition: ["Programs and tuition", "Choose one program and update its enrollment details, schedule, and tuition in one place.", "Program preview"],
    calendar: ["School calendar", "Enter one event per row. Weekdays and website groupings are calculated automatically.", "Calendar preview"],
    teachers: ["Teacher profiles", "Add, reorder, or update the profiles shown on the Why APLS page.", "Teacher section"]
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mergeDefaults(defaultValue, savedValue) {
    if (savedValue === undefined) return clone(defaultValue);
    if (Array.isArray(defaultValue) || !defaultValue || typeof defaultValue !== "object") return savedValue;
    var merged = {};
    Object.keys(defaultValue).forEach(function (key) {
      merged[key] = mergeDefaults(defaultValue[key], savedValue && savedValue[key]);
    });
    Object.keys(savedValue || {}).forEach(function (key) {
      if (!(key in merged)) merged[key] = savedValue[key];
    });
    return merged;
  }

  var sourceState = {
    tuition: clone(window.APLS_TUITION || {}),
    calendar: clone(window.APLS_CALENDAR || { years: [] }),
    teachers: clone(window.APLS_TEACHERS || [])
  };
  var savedState = loadDraft();
  var state = savedState ? mergeDefaults(sourceState, savedState) : clone(sourceState);
  sourceState.calendarRows = calendarToRows(sourceState.calendar);
  if (!Array.isArray(state.calendarRows)) state.calendarRows = calendarToRows(state.calendar);
  var activeSection = "overview";
  var selectedTuitionProgram = (state.tuition.programOrder || Object.keys(state.tuition.programs || {}))[0] || "preschool";
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
    if (options.options) {
      control = '<select data-path="' + escapeHtml(path) + '">' + options.options.map(function (option) {
        var optionValue = typeof option === "string" ? option : option.value;
        var optionLabel = typeof option === "string" ? option : option.label;
        return '<option value="' + escapeHtml(optionValue) + '"' + (optionValue === value ? " selected" : "") + '>' + escapeHtml(optionLabel) + "</option>";
      }).join("") + "</select>";
    } else if (options.textarea) {
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

  function calendarBoundaryDefinition(programKey, boundary) {
    var definitions = {
      "after-school": {
        start: "First day of the After-School program",
        end: "Last day of the After-School program"
      },
      "saturday-school": {
        start: "First day of Saturday School",
        end: "Last day of Saturday School"
      }
    };
    return definitions[programKey] && definitions[programKey][boundary];
  }

  function calendarYearIndexForDate(value) {
    var date = dateFromIso(value);
    if (!date) return -1;
    var startYear = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
    var id = startYear + "-" + (startYear + 1);
    return (state.calendar.years || []).findIndex(function (year) { return year.id === id; });
  }

  function ensureCalendarYearForDate(value) {
    var existingIndex = calendarYearIndexForDate(value);
    if (existingIndex !== -1) return existingIndex;
    var date = dateFromIso(value);
    if (!date) return -1;
    var startYear = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
    var rowYearIds = state.calendarRows.map(function (row) {
      var year = state.calendar.years[Number(row.yearIndex)];
      return year && year.id;
    });
    state.calendar.years.push({
      label: startYear + "\u2013" + (startYear + 1) + " school year",
      id: startYear + "-" + (startYear + 1),
      pdf: "",
      pdfLabel: "",
      months: []
    });
    state.calendar.years.sort(function (left, right) { return String(right.id).localeCompare(String(left.id)); });
    state.calendarRows.forEach(function (row, index) {
      row.yearIndex = state.calendar.years.findIndex(function (year) { return year.id === rowYearIds[index]; });
    });
    return calendarYearIndexForDate(value);
  }

  function managedCalendarRow(programKey, boundary, program) {
    var eventName = calendarBoundaryDefinition(programKey, boundary);
    if (!eventName) return null;
    var year = String(program[boundary + "Date"] || program.term || "").match(/\b(20\d{2})\b/);
    return (state.calendarRows || []).find(function (row) {
      if (row.managedProgram === programKey && row.managedBoundary === boundary) return true;
      return String(row.event || "").toLowerCase() === eventName.toLowerCase() && (!year || String(row.startDate).slice(0, 4) === year[1]);
    }) || null;
  }

  function syncProgramCalendar(programKey) {
    var program = (state.tuition.programs || {})[programKey];
    if (!program || !calendarBoundaryDefinition(programKey, "start")) return;
    ["start", "end"].forEach(function (boundary) {
      var value = program[boundary + "Date"] || "";
      var row = managedCalendarRow(programKey, boundary, program);
      if (!dateFromIso(value)) {
        if (row && row.managedProgram === programKey) state.calendarRows.splice(state.calendarRows.indexOf(row), 1);
        return;
      }
      var yearIndex = ensureCalendarYearForDate(value);
      if (yearIndex === -1) return;
      if (!row) {
        row = {};
        state.calendarRows.push(row);
      }
      row.yearIndex = yearIndex;
      row.startDate = value;
      row.endDate = "";
      row.event = calendarBoundaryDefinition(programKey, boundary);
      row.category = "program-date";
      row.notes = "Managed from Programs & Tuition";
      row.monthName = monthHeadingForDate(value);
      row.managedProgram = programKey;
      row.managedBoundary = boundary;
      state.calendarRows = state.calendarRows.filter(function (candidate) {
        return candidate === row || candidate.managedProgram !== programKey || candidate.managedBoundary !== boundary;
      });
    });
    syncCalendarFromRows();
  }

  function syncAllProgramCalendars() {
    ["after-school", "saturday-school"].forEach(syncProgramCalendar);
  }

  function calendarEventForProgram(programKey, program, boundary) {
    var managed = managedCalendarRow(programKey, boundary || "start", program);
    if (managed) return managed;
    var patterns = {
      "summer-camp": /summer language.*culture camp/i
    };
    var pattern = patterns[programKey];
    if (!pattern) return null;
    return (state.calendarRows || []).find(function (row) { return pattern.test(String(row.event || "")); }) || null;
  }

  function calendarBoundaryDate(row, boundary) {
    if (!row) return "";
    return boundary === "end" && row.endDate ? row.endDate : row.startDate;
  }

  function extendedCareFee() {
    return (state.tuition.fees || []).find(function (fee) {
      return /^extended care\b/i.test(String(fee.label || "").trim());
    });
  }

  function fixedTermProgram(program) {
    return Boolean(program.term && String(program.term).toLowerCase() !== "year-round" && program.enrollmentStatus !== "Inquire");
  }

  function currencyValue(value) {
    var match = String(value || "").match(/\$([\d,]+(?:\.\d{1,2})?)/);
    return match ? Number(match[1].replace(/,/g, "")) : null;
  }

  function declaredClassCount(row) {
    var match = (row || []).join(" ").match(/(\d+)\s*classes?/i);
    return match ? Number(match[1]) : null;
  }

  function usesScheduleBuilder(programKey) {
    return programKey === "after-school" || programKey === "saturday-school";
  }

  function localIsoDate(date) {
    return isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  function calendarDayNumber(date) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  }

  function generatedDatesForRule(program, rule) {
    var start = dateFromIso(program.startDate);
    var end = dateFromIso(program.endDate);
    var weekdays = (rule && rule.weekdays || []).map(Number);
    var intervalWeeks = Math.max(1, Number(rule && rule.intervalWeeks) || 1);
    if (!start || !end || end < start || !weekdays.length) return [];

    var dates = [];
    var startWeek = calendarDayNumber(start) - start.getDay();
    for (var date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      var weekIndex = Math.floor((calendarDayNumber(date) - startWeek) / 7);
      if (weekIndex % intervalWeeks === 0 && weekdays.indexOf(date.getDay()) !== -1) dates.push(localIsoDate(date));
    }
    return dates;
  }

  function formattedTuitionTotal(amount) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  function formattedMonthlyPayments(dates, rate) {
    var monthNames = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
    var months = [];
    var counts = {};
    (dates || []).forEach(function (value) {
      var date = dateFromIso(value);
      if (!date) return;
      var key = value.slice(0, 7);
      if (!counts[key]) {
        counts[key] = { date: date, count: 0 };
        months.push(key);
      }
      counts[key].count += 1;
    });
    return months.sort().map(function (key) {
      var month = counts[key];
      return formattedTuitionTotal(rate * month.count) + " (" + monthNames[month.date.getMonth()] + ")";
    }).join(", ");
  }

  function updateGeneratedTuition(program) {
    var rate = Number(program && program.ratePerClass);
    var totalColumn = (program && program.columns || []).findIndex(function (column) {
      return /total tuition|^tuition$/i.test(String(column).trim());
    });
    var monthlyColumn = (program && program.columns || []).findIndex(function (column) {
      return /^monthly payments?$/i.test(String(column).trim());
    });
    if (!program || (totalColumn === -1 && monthlyColumn === -1)) return;
    if (!Number.isFinite(rate) || rate <= 0) {
      (program.rows || []).forEach(function (row) {
        if (totalColumn !== -1) row[totalColumn] = "";
        if (monthlyColumn !== -1) row[monthlyColumn] = "";
      });
      return;
    }
    (program.rows || []).forEach(function (row, rowIndex) {
      var dates = (program.classDates || [])[rowIndex] || [];
      var classCount = dates.length;
      if (totalColumn !== -1) row[totalColumn] = classCount ? formattedTuitionTotal(rate * classCount) + " (" + classCount + " " + (classCount === 1 ? "class" : "classes") + ")" : "";
      if (monthlyColumn !== -1) row[monthlyColumn] = classCount ? formattedMonthlyPayments(dates, rate) : "";
    });
  }

  function updateGeneratedClassDates(program) {
    if (!program) return;
    var start = dateFromIso(program.startDate);
    var end = dateFromIso(program.endDate);
    if (!start || !end || end < start) {
      program.classDates = (program.rows || []).map(function () { return []; });
      updateGeneratedTuition(program);
      return;
    }
    program.classDates = (program.rows || []).map(function (_, rowIndex) {
      var rule = (program.scheduleRules || [])[rowIndex];
      return rule ? generatedDatesForRule(program, rule) : ((program.classDates || [])[rowIndex] || []);
    });
    updateGeneratedTuition(program);
  }

  function scheduleRuleSummary(program, rowIndex) {
    var dates = (program.classDates || [])[rowIndex] || [];
    if (!dateFromIso(program.startDate) || !dateFromIso(program.endDate)) return "Enter a start and end date to generate class dates.";
    if (!dates.length) return "No class dates match this frequency.";
    var formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
    return dates.map(function (value) { return formatter.format(dateFromIso(value)); }).join(", ");
  }

  function renderScheduleBuilder(base, program) {
    var rules = program.scheduleRules || [];
    var html = '<section class="editor-block schedule-builder">' +
      blockHeading("Automatic class dates", "Choose how often each enrollment option meets. Dates are generated inclusively from the start and end dates above.") +
      '<div class="schedule-rule-list">';
    (program.rows || []).forEach(function (row, rowIndex) {
      var rule = rules[rowIndex] || { intervalWeeks: 1, weekdays: [] };
      var dates = (program.classDates || [])[rowIndex] || [];
      html += '<article class="schedule-rule"><div class="schedule-rule-heading"><div><span class="repeater-number">Enrollment option</span><h3>' + escapeHtml(row[0] || "Tuition row " + (rowIndex + 1)) + '</h3></div><strong>' + dates.length + ' class' + (dates.length === 1 ? "" : "es") + '</strong></div>' +
        '<div class="schedule-frequency"><label class="field"><span class="field-label"><span>Frequency</span></span><select data-path="' + escapeHtml(base + ".scheduleRules." + rowIndex + ".intervalWeeks") + '">' +
          [1, 2, 3, 4].map(function (interval) { return '<option value="' + interval + '"' + (Number(rule.intervalWeeks) === interval ? " selected" : "") + '>Every ' + (interval === 1 ? "week" : interval + " weeks") + "</option>"; }).join("") +
        '</select></label><fieldset class="weekday-fieldset"><legend>Class days</legend><div class="weekday-checks">' +
          WEEKDAYS.map(function (day, dayIndex) { return '<label><input type="checkbox" data-schedule-day="' + dayIndex + '" data-rule-index="' + rowIndex + '"' + ((rule.weekdays || []).map(Number).indexOf(dayIndex) !== -1 ? " checked" : "") + " />" + escapeHtml(day.slice(0, 3)) + "</label>"; }).join("") +
        '</div></fieldset></div><details class="generated-dates"' + (dates.length && dates.length <= 14 ? " open" : "") + '><summary>' + dates.length + ' class date' + (dates.length === 1 ? "" : "s") + ' generated</summary><p>' + escapeHtml(scheduleRuleSummary(program, rowIndex)) + "</p></details></article>";
    });
    return html + "</div></section>";
  }

  function programValidation(programKey) {
    var program = (state.tuition.programs || {})[programKey] || {};
    var errors = [];
    var warnings = [];
    var start = dateFromIso(program.startDate);
    var end = dateFromIso(program.endDate);
    var applicationRequired = ["Open", "Waitlist", "Coming soon"].indexOf(program.enrollmentStatus) !== -1;

    if (applicationRequired && !String(program.applicationUrl || "").trim()) errors.push("An application URL is required while enrollment is " + program.enrollmentStatus + ".");
    if (program.startDate && !start) errors.push("Start date is invalid.");
    if (program.endDate && !end) errors.push("End date is invalid.");
    if (start && end && end < start) errors.push("End date is before start date.");
    if (fixedTermProgram(program) && (!start || !end)) warnings.push("This fixed-term program needs both a start date and an end date.");
    if (program.enrollmentStatus === "Open" && end) {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      if (end < today) errors.push("Enrollment is Open even though the program end date has passed.");
    }

    var calendarStart = calendarEventForProgram(programKey, program, "start");
    var calendarEnd = calendarEventForProgram(programKey, program, "end");
    var calendarStartDate = calendarBoundaryDate(calendarStart, "start");
    var calendarEndDate = calendarBoundaryDate(calendarEnd, "end");
    if (calendarStart) {
      if (!start) warnings.push("Calendar lists " + calendarStartDate + " for \u201c" + calendarStart.event + "\u201d, but the program start date is missing.");
      else if (program.startDate !== calendarStartDate) warnings.push("Program starts " + program.startDate + ", but the matching calendar event starts " + calendarStartDate + ".");
    }
    if (calendarEnd) {
      if (!end) warnings.push("Calendar lists " + calendarEndDate + " for \u201c" + calendarEnd.event + "\u201d, but the program end date is missing.");
      else if (program.endDate !== calendarEndDate) warnings.push("Program ends " + program.endDate + ", but the matching calendar event is " + calendarEndDate + ".");
    }

    var careFee = extendedCareFee();
    var careApplies = careFee && (careFee.appliesTo || []).indexOf(programKey) !== -1;
    if (program.careStatus === "available" && !careApplies) errors.push("Extended care is marked available, but the shared extended-care fee does not apply to this program.");
    if (program.careStatus === "unavailable" && careApplies) errors.push("Extended care is marked unavailable, but the shared extended-care fee applies to this program.");
    if (program.careStatus === "available" && /no extended care/i.test(program.format || "")) warnings.push("The format says no extended care, but Extended care is marked available.");
    if (program.careStatus === "unavailable" && /extended care/i.test(program.format || "") && !/no extended care/i.test(program.format || "")) warnings.push("The format advertises extended care, but Extended care is marked unavailable.");

    var rate = Number(program.ratePerClass);
    if (usesScheduleBuilder(programKey) && !String(program.ratePerClass || "").trim()) errors.push("A per-class rate is required to calculate total tuition.");
    if (program.ratePerClass !== "" && (!Number.isFinite(rate) || rate <= 0)) errors.push("Per-class rate must be a positive number.");
    if (Number.isFinite(rate) && rate > 0) {
      var totalColumn = (program.columns || []).findIndex(function (column) { return /total tuition|^tuition$/i.test(String(column).trim()); });
      (program.rows || []).forEach(function (row, rowIndex) {
        var dates = (program.classDates || [])[rowIndex] || [];
        var optionName = row[0] || "Tuition row " + (rowIndex + 1);
        var invalidDates = dates.filter(function (value) { return !dateFromIso(value); });
        var duplicateDates = dates.filter(function (value, index) { return dates.indexOf(value) !== index; });
        var declared = declaredClassCount(row);
        if (!dates.length) warnings.push(optionName + " has a per-class rate but no scheduled class dates.");
        if (invalidDates.length) errors.push(optionName + " has invalid scheduled dates: " + invalidDates.join(", ") + ".");
        if (duplicateDates.length) errors.push(optionName + " repeats scheduled date " + duplicateDates[0] + ".");
        if (declared !== null && declared !== dates.length) errors.push(optionName + " says " + declared + " classes, but " + dates.length + " scheduled dates are entered.");
        if (start && dates.some(function (value) { var date = dateFromIso(value); return date && date < start; })) errors.push(optionName + " includes a class before the program start date.");
        if (end && dates.some(function (value) { var date = dateFromIso(value); return date && date > end; })) errors.push(optionName + " includes a class after the program end date.");
        if (totalColumn !== -1 && dates.length) {
          var total = currencyValue(row[totalColumn]);
          var expected = rate * dates.length;
          if (total !== null && Math.abs(total - expected) > 0.009) errors.push(optionName + " total is $" + total.toLocaleString("en-US") + ", but " + dates.length + " classes at $" + rate.toLocaleString("en-US") + " should total $" + expected.toLocaleString("en-US") + ".");
        }
      });
    }
    if (usesScheduleBuilder(programKey)) {
      if (!(program.columns || []).some(function (column) { return /total tuition|^tuition$/i.test(String(column).trim()); })) errors.push("A Total tuition column is required for automatic tuition.");
      if (!(program.columns || []).some(function (column) { return /^monthly payments?$/i.test(String(column).trim()); })) errors.push("A Monthly payment column is required for automatic monthly billing.");
      (program.rows || []).forEach(function (row, rowIndex) {
        var rule = (program.scheduleRules || [])[rowIndex];
        var optionName = row[0] || "Tuition row " + (rowIndex + 1);
        if (!rule) errors.push(optionName + " needs a frequency rule.");
        else if (!(rule.weekdays || []).length) errors.push(optionName + " needs at least one class day.");
      });
    }
    return { errors: errors, warnings: warnings };
  }

  function programNeedsReview(programKey) {
    var program = state.tuition.programs[programKey];
    var validation = programValidation(programKey);
    return Boolean(program.editorNote || validation.errors.length || validation.warnings.length);
  }

  function allProgramValidation() {
    var summary = { errors: 0, warnings: 0, programs: 0 };
    Object.keys(state.tuition.programs || {}).forEach(function (key) {
      var validation = programValidation(key);
      summary.errors += validation.errors.length;
      summary.warnings += validation.warnings.length;
      if (programNeedsReview(key)) summary.programs += 1;
    });
    return summary;
  }

  function calendarCrossCheckHtml() {
    var items = [];
    Object.keys(state.tuition.programs || {}).forEach(function (key) {
      var program = state.tuition.programs[key];
      programValidation(key).warnings.filter(function (message) {
        return /calendar|fixed-term program needs/i.test(message);
      }).forEach(function (message) {
        items.push((program.name || key) + ": " + message);
      });
    });
    if (!items.length) return '<div class="validation-clear"><strong>Program date checks passed</strong><span>Calendar events agree with program dates.</span></div>';
    return '<section class="validation-group is-warning"><strong>' + items.length + ' program date warning' + (items.length === 1 ? "" : "s") + '</strong><ul>' + items.map(function (message) { return "<li>" + escapeHtml(message) + "</li>"; }).join("") + "</ul></section>";
  }

  function programValidationHtml(programKey) {
    var program = state.tuition.programs[programKey];
    var validation = programValidation(programKey);
    var html = "";
    if (validation.errors.length || validation.warnings.length) {
      html += '<div class="validation-panel">';
      if (validation.errors.length) html += '<section class="validation-group is-error"><strong>' + validation.errors.length + ' error' + (validation.errors.length === 1 ? "" : "s") + ' \u00b7 export blocked</strong><ul>' + validation.errors.map(function (message) { return "<li>" + escapeHtml(message) + "</li>"; }).join("") + "</ul></section>";
      if (validation.warnings.length) html += '<section class="validation-group is-warning"><strong>' + validation.warnings.length + ' warning' + (validation.warnings.length === 1 ? "" : "s") + '</strong><ul>' + validation.warnings.map(function (message) { return "<li>" + escapeHtml(message) + "</li>"; }).join("") + "</ul></section>";
      html += "</div>";
    } else {
      html = '<div class="validation-clear"><strong>Automatic checks passed</strong><span>Dates, calendar, application, care policy, and tuition math are consistent.</span></div>';
    }
    if (program.editorNote) html += '<div class="editor-alert"><strong>Manual review note</strong><p>' + escapeHtml(program.editorNote) + "</p></div>";
    return html;
  }

  function programReviewSummaryHtml(programKeys) {
    var reviewPrograms = programKeys.filter(programNeedsReview);
    if (!reviewPrograms.length) return '<div class="program-review-summary is-clear"><strong>All program checks passed</strong></div>';
    var summary = allProgramValidation();
    var issueText = [];
    if (summary.errors) issueText.push(summary.errors + " error" + (summary.errors === 1 ? "" : "s"));
    if (summary.warnings) issueText.push(summary.warnings + " warning" + (summary.warnings === 1 ? "" : "s"));
    return '<div class="program-review-summary"><strong>' + reviewPrograms.length + ' program' + (reviewPrograms.length === 1 ? "" : "s") + ' need review' + (issueText.length ? " \u00b7 " + issueText.join(" \u00b7 ") : "") + '</strong><div>' + reviewPrograms.map(function (key) {
      return '<button type="button" data-action="select-tuition-program" data-program="' + escapeHtml(key) + '">' + escapeHtml(state.tuition.programs[key].name || key) + "</button>";
    }).join("") + "</div></div>";
  }

  function renderClassDateEditors(programKey, program) {
    if (!program.ratePerClass && !(program.classDates || []).length) return "";
    var html = '<section class="class-date-checks"><div class="block-heading"><div><h3>Scheduled class dates</h3><p>Enter one ISO date per line. Counts and tuition totals are checked automatically.</p></div></div><div class="repeater-list">';
    (program.rows || []).forEach(function (row, rowIndex) {
      var dates = (program.classDates || [])[rowIndex] || [];
      html += '<label class="field"><span class="field-label"><span>' + escapeHtml(row[0] || "Tuition row " + (rowIndex + 1)) + '</span><span class="field-hint">' + dates.length + ' dates</span></span><textarea rows="6" data-class-dates-program="' + escapeHtml(programKey) + '" data-class-dates-index="' + rowIndex + '">' + escapeHtml(dates.join("\n")) + "</textarea></label>";
    });
    return html + "</div></section>";
  }

  function renderOverviewEditor() {
    var yearCount = (state.calendar.years || []).length;
    var teacherCount = state.teachers.length;
    var programCount = Object.keys(state.tuition.programs || {}).length;
    var validationSummary = allProgramValidation();
    var validationDetail = programCount + " program workspaces \u00b7 " + validationSummary.programs + " need review";
    if (validationSummary.errors) validationDetail += " \u00b7 " + validationSummary.errors + " errors";
    editorContent.innerHTML =
      '<div class="summary-grid">' +
        summaryCard("02", "Programs", validationDetail, "tuition") +
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
    var programKeys = tuition.programOrder || Object.keys(tuition.programs || {});
    if (!tuition.programs[selectedTuitionProgram]) selectedTuitionProgram = programKeys[0];
    var program = tuition.programs[selectedTuitionProgram];
    var base = "programs." + selectedTuitionProgram;
    if (usesScheduleBuilder(selectedTuitionProgram)) updateGeneratedTuition(program);
    var html = '<div id="program-review-summary-wrapper">' + programReviewSummaryHtml(programKeys) + "</div>";
    html += '<div class="program-tabs" role="tablist" aria-label="Choose a program">';
    programKeys.forEach(function (key) {
      var item = tuition.programs[key];
      if (!item) return;
      var needsReview = programNeedsReview(key);
      html += '<button type="button" role="tab" class="program-tab' + (key === selectedTuitionProgram ? " is-active" : "") + (needsReview ? " has-review" : "") + '" data-action="select-tuition-program" data-program="' + escapeHtml(key) + '" aria-selected="' + (key === selectedTuitionProgram) + '">' + escapeHtml(item.name || key) + '<span class="tab-alert" aria-label="Needs review"' + (needsReview ? "" : " hidden") + '>!</span></button>';
    });
    html += '</div><section class="editor-block">' +
      blockHeading(program.name || "Program", "Enrollment and schedule details for this program.") +
      '<div id="program-validation" aria-live="polite">' + programValidationHtml(selectedTuitionProgram) + "</div>" +
      '<div class="field-grid">' +
        field("Program name", base + ".name", program.name || "") +
        field("Current term", base + ".term", program.term || "", { hint: "Example: Fall 2026" }) +
        field("Enrollment status", base + ".enrollmentStatus", program.enrollmentStatus || "", { options: [
          { value: "", label: "Not set" },
          { value: "Open", label: "Open" },
          { value: "Waitlist", label: "Waitlist" },
          { value: "Closed", label: "Closed" },
          { value: "Coming soon", label: "Coming soon" },
          { value: "Inquire", label: "Inquire for availability" }
        ] }) +
        field("Application URL", base + ".applicationUrl", program.applicationUrl || "") +
        field("Start date", base + ".startDate", program.startDate || "", { type: "date" }) +
        field("End date", base + ".endDate", program.endDate || "", { type: "date" }) +
        field("Extended care", base + ".careStatus", program.careStatus || "not-applicable", { options: [
          { value: "available", label: "Available" },
          { value: "unavailable", label: "Not available" },
          { value: "not-applicable", label: "Not applicable" }
        ] }) +
        field("Schedule summary", base + ".schedule", program.schedule || "", { textarea: true, full: true }) +
        field("Format or day options", base + ".format", program.format || "", { textarea: true, full: true }) +
        field("Internal review note", base + ".editorNote", program.editorNote || "", { textarea: true, full: true, hint: "Shown only in Content Studio" }) +
      "</div>" +
      "</section>" +
      (usesScheduleBuilder(selectedTuitionProgram) ? renderScheduleBuilder(base, program) : "") +
      '<section class="editor-block">' +
      blockHeading("Tuition", usesScheduleBuilder(selectedTuitionProgram) ? "Total tuition and monthly payments are calculated from the per-class rate and generated class dates." : "This single note and table appear on both the Tuition page and the program page.") +
      '<div class="field-grid">' +
        field("Section heading", base + ".heading", program.heading || "") +
        field("Per-class rate", base + ".ratePerClass", program.ratePerClass || "", { type: "number", hint: usesScheduleBuilder(selectedTuitionProgram) ? "Used to calculate total tuition" : "Optional; numbers only" }) +
        field("Program tuition note", base + ".note", program.note || "", { textarea: true, full: true }) +
      "</div>" +
      renderTableEditor(base, program, false) +
      (usesScheduleBuilder(selectedTuitionProgram) ? "" : renderClassDateEditors(selectedTuitionProgram, program)) +
      "</section>";

    html += '<section class="editor-block">' +
      blockHeading("Shared fees and policies", "Edit common values once, then choose every program where each item applies.", '<button class="small-button" type="button" data-action="add-fee">Add shared item</button>') +
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
    var hasCalculatedTuition = usesScheduleBuilder(selectedTuitionProgram) && base === "programs." + selectedTuitionProgram;
    function isCalculatedTuitionColumn(column) {
      return hasCalculatedTuition && (/total tuition|^tuition$/i.test(String(column).trim()) || /^monthly payments?$/i.test(String(column).trim()));
    }
    var html = '<div class="button-row">' +
      '<button class="small-button" type="button" data-action="add-table-row" data-path="' + escapeHtml(base) + '">Add row</button>' +
      '<button class="small-button" type="button" data-action="add-table-column" data-path="' + escapeHtml(base) + '">Add column</button>' +
      "</div>" + (showLabel ? '<span class="repeater-number">Table cells</span>' : "") + '<table class="table-editor"><thead><tr>';
    columns.forEach(function (column, columnIndex) {
      var calculatedColumn = isCalculatedTuitionColumn(column);
      html += "<th>" + (calculatedColumn ? '<span class="calculated-column-heading">' + escapeHtml(column) + '</span><span class="calculated-cell-note">Calculated</span>' : '<input class="cell-input" aria-label="Column ' + (columnIndex + 1) + ' heading" data-path="' + pathPrefix + "columns." + columnIndex + '" value="' + escapeHtml(column) + '" /><button class="remove-cell" type="button" aria-label="Remove column ' + (columnIndex + 1) + '" data-action="remove-table-column" data-path="' + escapeHtml(base) + '" data-index="' + columnIndex + '">&times;</button>') + "</th>";
    });
    html += '<th class="action-cell"><span class="field-hint">Row</span></th></tr></thead><tbody>';
    rows.forEach(function (row, rowIndex) {
      html += "<tr>";
      columns.forEach(function (column, columnIndex) {
        var calculatedCell = isCalculatedTuitionColumn(column);
        html += '<td data-label="' + escapeHtml(column) + '">' + (calculatedCell ? '<output class="calculated-cell-output" aria-label="Calculated ' + escapeHtml(column.toLowerCase()) + " for row " + (rowIndex + 1) + '">' + escapeHtml(row[columnIndex] || "Enter dates and a per-class rate") + "</output>" : '<input class="cell-input" aria-label="Row ' + (rowIndex + 1) + ", column " + (columnIndex + 1) + '" data-path="' + pathPrefix + "rows." + rowIndex + "." + columnIndex + '" value="' + escapeHtml(row[columnIndex] || "") + '" />') + "</td>";
      });
      html += '<td class="action-cell" data-label="Remove option"><button class="remove-cell" type="button" aria-label="Remove row ' + (rowIndex + 1) + '" data-action="remove-table-row" data-path="' + escapeHtml(base) + '" data-index="' + rowIndex + '">&times;</button></td></tr>';
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
            monthName: month.name || "",
            managedProgram: metadata.managedProgram || "",
            managedBoundary: metadata.managedBoundary || ""
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
    var html = '<div class="calendar-workbook"><div id="calendar-program-checks" aria-live="polite">' + calendarCrossCheckHtml() + "</div>" +
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
      var managed = Boolean(row.managedProgram);
      var locked = managed ? " disabled" : "";
      html += '<tr class="calendar-sheet-row' + (issues.length ? " has-error" : "") + (managed ? " is-managed" : "") + '">' +
        '<th scope="row" class="sheet-row-number">' + (rowIndex + 1) + "</th>" +
        '<td><select aria-label="School year for row ' + (rowIndex + 1) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="yearIndex"' + locked + ">" + calendarYearOptions(row.yearIndex) + "</select></td>" +
        '<td><input type="date" aria-label="Start date for row ' + (rowIndex + 1) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="startDate" value="' + escapeHtml(row.startDate) + '"' + locked + " /></td>" +
        '<td><input type="date" aria-label="End date for row ' + (rowIndex + 1) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="endDate" value="' + escapeHtml(row.endDate) + '"' + locked + " /></td>" +
        '<td><input type="text" aria-label="Event name for row ' + (rowIndex + 1) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="event" value="' + escapeHtml(row.event) + '"' + locked + " /></td>" +
        '<td><select aria-label="Category for row ' + (rowIndex + 1) + '" class="category-select category-' + escapeHtml(row.category) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="category"' + locked + ">" + calendarCategoryOptions(row.category) + "</select></td>" +
        '<td><input type="text" aria-label="Notes for row ' + (rowIndex + 1) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="notes" value="' + escapeHtml(row.notes) + '"' + locked + " /></td>" +
        '<td class="sheet-check"><span class="' + (issues.length ? "check-error" : "check-ready") + '">' + escapeHtml(issues[0] || (managed ? "Managed by " + ((state.tuition.programs[row.managedProgram] || {}).name || row.managedProgram) : shortDateSummary(row))) + "</span></td>" +
        '<td><button class="remove-cell" type="button" aria-label="Remove event row ' + (rowIndex + 1) + '" data-action="remove-calendar-row" data-index="' + rowIndex + '"' + locked + '>&times;</button></td></tr>';
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
      [Object.keys(state.tuition.programs || {}).length, "Program workspaces", (state.tuition.fees || []).length + " shared fees and policies"],
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
    var program = (tuition.programs || {})[selectedTuitionProgram] || {};
    if (program.name) fragment.appendChild(node("h2", "", program.name));
    if (program.term || program.enrollmentStatus) {
      fragment.appendChild(node("p", "preview-program-meta", [program.term, program.enrollmentStatus].filter(Boolean).join(" | ")));
    }
    if (program.startDate || program.endDate) {
      fragment.appendChild(node("p", "", [program.startDate, program.endDate].filter(Boolean).join(" to ")));
    }
    if (program.schedule) fragment.appendChild(node("p", "", program.schedule));
    if (program.applicationUrl) {
      var applicationLink = node("a", "preview-application-link", "Open current application");
      applicationLink.href = "../" + program.applicationUrl;
      applicationLink.target = "_blank";
      applicationLink.rel = "noopener";
      fragment.appendChild(applicationLink);
    }
    if (program.heading) fragment.appendChild(node("h2", "", program.heading));
    if (program.note) fragment.appendChild(node("p", "", program.note));
    if ((program.columns || []).length && (program.rows || []).length) {
      fragment.appendChild(previewTable(program.columns, program.rows));
    }
    if (usesScheduleBuilder(selectedTuitionProgram)) {
      fragment.appendChild(node("h2", "", "Generated class dates"));
      (program.rows || []).forEach(function (row, rowIndex) {
        var dates = (program.classDates || [])[rowIndex] || [];
        fragment.appendChild(node("h3", "preview-schedule-heading", (row[0] || "Enrollment option") + " | " + dates.length + " classes"));
        fragment.appendChild(node("p", "preview-generated-dates", scheduleRuleSummary(program, rowIndex)));
      });
    }
    var applicableFees = (tuition.fees || []).filter(function (fee) {
      return (fee.appliesTo || []).indexOf(selectedTuitionProgram) !== -1;
    });
    if (applicableFees.length) {
      fragment.appendChild(node("h2", "", tuition.feesHeading || "Registration & other fees"));
      var list = node("ul", "preview-fees");
      applicableFees.forEach(function (fee) {
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
            notes: row.notes || "",
            managedProgram: row.managedProgram || "",
            managedBoundary: row.managedBoundary || ""
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
    var programChecks = document.getElementById("calendar-program-checks");
    if (programChecks) programChecks.innerHTML = calendarCrossCheckHtml();
  }

  function calendarHasErrors() {
    return state.calendarRows.some(function (row, index) { return calendarRowIssues(row, index).length; });
  }

  function tuitionHasErrors() {
    return Object.keys(state.tuition.programs || {}).some(function (key) {
      return programValidation(key).errors.length;
    });
  }

  function updateTuitionValidationFeedback() {
    if (activeSection !== "tuition") return;
    var validationRoot = document.getElementById("program-validation");
    if (validationRoot) validationRoot.innerHTML = programValidationHtml(selectedTuitionProgram);
    var summaryRoot = document.getElementById("program-review-summary-wrapper");
    if (summaryRoot) summaryRoot.innerHTML = programReviewSummaryHtml(state.tuition.programOrder || Object.keys(state.tuition.programs || {}));
    document.querySelectorAll(".program-tab[data-program]").forEach(function (tab) {
      var needsReview = programNeedsReview(tab.dataset.program);
      tab.classList.toggle("has-review", needsReview);
      var alert = tab.querySelector(".tab-alert");
      if (alert) alert.hidden = !needsReview;
    });
  }

  function mutateFromAction(button) {
    var action = button.dataset.action;
    if (!action) return false;
    var path = button.dataset.path;
    var index = Number(button.dataset.index);

    if (action === "select-tuition-program") {
      selectedTuitionProgram = button.dataset.program;
      renderEditor();
      renderPreview();
      return true;
    }
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
    if (action === "add-fee") state.tuition.fees.push({ appliesTo: [], label: "New fee", text: "" });
    if (action === "add-table-row") {
      var rowTable = tableAt(path);
      rowTable.rows.push(rowTable.columns.map(function () { return ""; }));
      if (/^programs\./.test(path)) {
        rowTable.classDates = rowTable.classDates || [];
        rowTable.classDates.push([]);
        if (usesScheduleBuilder(selectedTuitionProgram)) {
          rowTable.scheduleRules = rowTable.scheduleRules || [];
          rowTable.scheduleRules.push({ intervalWeeks: 1, weekdays: [] });
        }
      }
    }
    if (action === "remove-table-row") {
      var removeRowTable = tableAt(path);
      removeRowTable.rows.splice(index, 1);
      if (/^programs\./.test(path) && removeRowTable.classDates) removeRowTable.classDates.splice(index, 1);
      if (/^programs\./.test(path) && usesScheduleBuilder(selectedTuitionProgram) && removeRowTable.scheduleRules) removeRowTable.scheduleRules.splice(index, 1);
    }
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
    if (section === "tuition") {
      Object.keys(state.tuition.programs || {}).forEach(function (programKey) {
        if (usesScheduleBuilder(programKey)) updateGeneratedTuition(state.tuition.programs[programKey]);
      });
    }
    if (section === "calendar") syncCalendarFromRows();
    return headers[section] + JSON.stringify(state[section], null, 2) + ";\n";
  }

  function exportFile(section) {
    if (!state[section]) return;
    if (section === "tuition" && tuitionHasErrors()) {
      showToast("Fix the program errors marked in Programs & Tuition before exporting.");
      if (activeSection !== "tuition") selectSection("tuition");
      return;
    }
    if (section === "calendar" && calendarHasErrors()) {
      showToast("Fix the calendar rows marked for attention before exporting.");
      return;
    }
    if ((section === "tuition" || section === "calendar") && allProgramValidation().warnings) {
      var warningCount = allProgramValidation().warnings;
      if (!window.confirm(warningCount + " automatic warning" + (warningCount === 1 ? " remains" : "s remain") + ". Review the marked programs before publishing. Export anyway?")) return;
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
    var classDatesInput = event.target.closest("[data-class-dates-program]");
    if (classDatesInput) {
      var datesProgram = state.tuition.programs[classDatesInput.dataset.classDatesProgram];
      var datesIndex = Number(classDatesInput.dataset.classDatesIndex);
      datesProgram.classDates = datesProgram.classDates || [];
      datesProgram.classDates[datesIndex] = classDatesInput.value.split(/[\s,]+/).map(function (value) { return value.trim(); }).filter(Boolean);
      var dateHint = classDatesInput.closest(".field").querySelector(".field-hint");
      if (dateHint) dateHint.textContent = datesProgram.classDates[datesIndex].length + " dates";
      markDirty();
      updateTuitionValidationFeedback();
      renderPreview();
      return;
    }
    var scheduleDay = event.target.closest("[data-schedule-day]");
    if (scheduleDay) {
      var scheduleProgram = state.tuition.programs[selectedTuitionProgram];
      var rule = scheduleProgram.scheduleRules[Number(scheduleDay.dataset.ruleIndex)];
      var dayIndex = Number(scheduleDay.dataset.scheduleDay);
      rule.weekdays = rule.weekdays || [];
      var dayPosition = rule.weekdays.map(Number).indexOf(dayIndex);
      if (scheduleDay.checked && dayPosition === -1) rule.weekdays.push(dayIndex);
      if (!scheduleDay.checked && dayPosition !== -1) rule.weekdays.splice(dayPosition, 1);
      rule.weekdays.sort(function (left, right) { return Number(left) - Number(right); });
      updateGeneratedClassDates(scheduleProgram);
      markDirty();
      renderEditor();
      renderPreview();
      return;
    }
    var input = event.target.closest("[data-path]");
    if (input) {
      setPath(state[activeSection], input.dataset.path, input.value);
      var schedulePath = "programs." + selectedTuitionProgram + ".";
      var regeneratesSchedule = input.dataset.path === schedulePath + "startDate" || input.dataset.path === schedulePath + "endDate" || input.dataset.path.indexOf(schedulePath + "scheduleRules.") === 0;
      var recalculatesTuition = input.dataset.path === schedulePath + "ratePerClass";
      if (activeSection === "tuition" && usesScheduleBuilder(selectedTuitionProgram) && (regeneratesSchedule || recalculatesTuition)) {
        if (regeneratesSchedule) {
          updateGeneratedClassDates(state.tuition.programs[selectedTuitionProgram]);
          syncProgramCalendar(selectedTuitionProgram);
        }
        else updateGeneratedTuition(state.tuition.programs[selectedTuitionProgram]);
        markDirty();
        renderEditor();
        renderPreview();
        return;
      }
      markDirty();
      updateTuitionValidationFeedback();
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
      updateTuitionValidationFeedback();
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

  syncAllProgramCalendars();
  selectSection("overview");
  if (loadDraft()) {
    draftPill.textContent = "Local draft loaded";
    saveStatus.textContent = "Local draft loaded";
  }
})();