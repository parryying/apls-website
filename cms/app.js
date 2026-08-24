(function () {
  "use strict";

  var STORAGE_KEY = "apls-cms-preview-draft-v2";
  var CALENDAR_PRINT_PREVIEW_KEY = "apls-calendar-print-preview-v1";
  var STAGING_URL = "https://www.apls.org/_newsite/";
  var SUBMISSION_POLL_MS = 8000;
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
  var CALENDAR_PREVIEW_COLORS = {
    "school-closed": "School closed",
    "school-event": "School events",
    "childcare-program": "Childcare & programs",
    "school-boundary": "First / last day of school"
  };
  var SECTION_COPY = {
    overview: ["Website overview", "Choose a content area, make changes, and review the result before sending an update.", "Content summary"],
    tuition: ["Programs and tuition", "Choose one program and update its enrollment details, schedule, and tuition in one place.", "Program preview"],
    calendar: ["School calendar", "Enter one event per row. Weekdays and website groupings are calculated automatically.", "Calendar preview"],
    teachers: ["Teacher profiles", "Add, reorder, or update the profiles shown on the homepage and the Why APLS page.", "Teacher section"],
    gallery: ["Gallery", "Curate public Instagram posts for the Latest from APLS section.", "Instagram preview"],
    events: ["Events and announcements", "Publish event details and announcements, with optional school-calendar visibility.", "Events page preview"]
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
    teachers: clone(window.APLS_TEACHERS || []),
    gallery: clone(window.APLS_GALLERY || { instagramPosts: [] }),
    events: clone(window.APLS_EVENTS || { items: [] })
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
  var changedSections = {};
  var cloudBaseSha = "";
  var cloudReady = false;
  var pendingMedia = {};
  var submissionPollTimer;

  var editorContent = document.getElementById("editor-content");
  var previewCanvas = document.getElementById("preview-canvas");
  var sectionTitle = document.getElementById("section-title");
  var sectionDescription = document.getElementById("section-description");
  var previewTitle = document.getElementById("preview-title");
  var draftPill = document.getElementById("draft-pill");
  var saveStatus = document.getElementById("save-status");
  var exportDialog = document.getElementById("export-dialog");
  var reviewDialog = document.getElementById("review-dialog");
  var submissionStatusPanel = document.getElementById("submission-status");
  var submissionStatusTitle = document.getElementById("submission-status-title");
  var submissionStatusMessage = document.getElementById("submission-status-message");
  var stagingProgress = document.getElementById("staging-progress");
  var stagingProgressText = document.getElementById("staging-progress-text");
  var stagingLink = document.getElementById("staging-link");

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
    var badge = options.required
      ? '<span class="field-required">Required</span>'
      : options.options ? "" : '<span class="field-optional">Optional</span>';
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
      control = '<input type="' + (options.type || "text") + '" data-path="' + escapeHtml(path) + '" value="' + escapeHtml(value) + '"' + (options.paymentAmount ? ' data-payment-amount min="0" step="0.01"' : "") + ' />';
    }
    return '<label class="' + classes + '"><span class="field-label"><span class="field-label-text">' + escapeHtml(label) + badge + "</span>" + hint + "</span>" + control + "</label>";
  }

  function booleanField(label, path, checked, hint) {
    return '<label class="toggle-field"><input type="checkbox" data-boolean-path="' + escapeHtml(path) + '"' + (checked ? " checked" : "") + ' /><span><strong>' + escapeHtml(label) + '</strong>' + (hint ? '<small>' + escapeHtml(hint) + "</small>" : "") + "</span></label>";
  }

  function mediaPreviewSource(path) {
    return pendingMedia[path] && pendingMedia[path].previewUrl ? pendingMedia[path].previewUrl : "../" + String(path || "").replace(/^\.\.\//, "");
  }

  function imageUploadField(label, section, path, currentValue, hint) {
    if (!window.APLS_CMS_CLOUD || !window.APLS_CMS_CLOUD.enabled) {
      return field(label + " path", path, currentValue || "", { hint: hint || "Cloud image upload will replace this path field" });
    }
    var record = pendingMedia[currentValue];
    return '<label class="image-upload-field"><span class="field-label"><span class="field-label-text">' + escapeHtml(label) + '<span class="field-optional">Optional</span></span><span class="field-hint">' + escapeHtml(hint || "JPEG, PNG, or WebP \u00b7 10 MB max") + '</span></span>' +
      (currentValue ? '<img class="image-upload-preview" src="' + escapeHtml(mediaPreviewSource(currentValue)) + '" alt="" />' : "") +
      '<input type="file" accept="image/jpeg,image/png,image/webp" data-image-upload data-image-section="' + escapeHtml(section) + '" data-image-path="' + escapeHtml(path) + '" />' +
      (currentValue ? '<span class="image-upload-current">' + escapeHtml(currentValue) + "</span>" : "") +
      (record ? '<span class="image-upload-meta">Optimized: ' + record.width + " × " + record.height + " · " + Math.ceil(record.size / 1024) + " KB</span>" : "") +
      "</label>";
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

  function supportsSeparateCalendarStart(programKey) {
    return programKey === "after-school";
  }

  // Mirrors the shared validator's fixed-term rule, which wants both dates.
  function fixedTermProgram(program) {
    return Boolean(program.term) && String(program.term).toLowerCase() !== "year-round" && program.enrollmentStatus !== "Inquire";
  }

  function setRequiredBadge(path, required) {
    var control = editorContent.querySelector('[data-path="' + path + '"]');
    var wrapper = control && control.closest(".field");
    var badge = wrapper && wrapper.querySelector(".field-required, .field-optional");
    if (!badge) return;
    badge.className = required ? "field-required" : "field-optional";
    badge.textContent = required ? "Required" : "Optional";
  }

  // Some fields only become required based on other answers, and typing does not re-render the editor.
  function refreshRequiredBadges() {
    if (activeSection === "tuition") {
      var program = (state.tuition.programs || {})[selectedTuitionProgram] || {};
      var base = "programs." + selectedTuitionProgram;
      setRequiredBadge(base + ".applicationUrl", ["Open", "Waitlist", "Coming soon"].indexOf(program.enrollmentStatus) !== -1);
      setRequiredBadge(base + ".startDate", fixedTermProgram(program));
      setRequiredBadge(base + ".endDate", fixedTermProgram(program));
    }
    if (activeSection === "events") {
      ((state.events || {}).items || []).forEach(function (item, index) {
        setRequiredBadge("items." + index + ".startDate", item.type !== "announcement");
      });
    }
  }

  function programCalendarBoundaryValue(programKey, program, boundary) {
    if (boundary === "start" && supportsSeparateCalendarStart(programKey) && program.calendarStartDate) return program.calendarStartDate;
    return program[boundary + "Date"] || "";
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
    var year = String(programCalendarBoundaryValue(programKey, program, boundary) || program.term || "").match(/\b(20\d{2})\b/);
    return (state.calendarRows || []).find(function (row) {
      if (row.managedProgram === programKey && row.managedBoundary === boundary) return true;
      return String(row.event || "").toLowerCase() === eventName.toLowerCase() && (!year || String(row.startDate).slice(0, 4) === year[1]);
    }) || null;
  }

  function syncProgramCalendar(programKey) {
    var program = (state.tuition.programs || {})[programKey];
    if (!program || !calendarBoundaryDefinition(programKey, "start")) return;
    ["start", "end"].forEach(function (boundary) {
      var value = programCalendarBoundaryValue(programKey, program, boundary);
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

  function syncAllEventCalendars() {
    state.calendarRows = (state.calendarRows || []).filter(function (row) { return !row.managedEvent; });
    (state.events.items || []).forEach(function (item, index) {
      if (item.type !== "event" || item.status !== "published" || !item.showOnCalendar || !dateFromIso(item.startDate)) return;
      var yearIndex = ensureCalendarYearForDate(item.startDate);
      if (yearIndex === -1) return;
      state.calendarRows.push({
        yearIndex: yearIndex,
        startDate: item.startDate,
        endDate: item.endDate || "",
        event: item.title || "Untitled event",
        category: "school-event",
        notes: "Managed from Events & Announcements",
        monthName: monthHeadingForDate(item.startDate),
        managedEvent: item.id || "event-" + index
      });
    });
    syncCalendarFromRows();
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

  function paymentMonths(dates) {
    return (dates || []).reduce(function (months, value) {
      var key = String(value).slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(key) && months.indexOf(key) === -1) months.push(key);
      return months;
    }, []).sort();
  }

  function paymentMonthLabel(value) {
    var monthNames = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
    var parts = String(value).split("-").map(Number);
    return monthNames[parts[1] - 1] || value;
  }

  function paymentPlanAmounts(program, rowIndex, total) {
    var months = paymentMonths((program.classDates || [])[rowIndex] || []);
    var plan = (program.paymentPlans || [])[rowIndex] || {};
    if (!months.length) return [];
    if (plan.mode === "custom") {
      return months.map(function (_, monthIndex) { return Number((plan.customAmounts || [])[monthIndex]); });
    }
    var regularAmount = Number(plan.regularAmount);
    if (!Number.isFinite(regularAmount) || regularAmount < 0) return [];
    return months.map(function (_, monthIndex) {
      return monthIndex === months.length - 1 ? total - (regularAmount * (months.length - 1)) : regularAmount;
    });
  }

  function formattedPaymentPlan(program, rowIndex, total) {
    var months = paymentMonths((program.classDates || [])[rowIndex] || []);
    var amounts = paymentPlanAmounts(program, rowIndex, total);
    if (!months.length || amounts.length !== months.length || amounts.some(function (amount) { return !Number.isFinite(amount); })) return "";
    return months.map(function (month, monthIndex) {
      return formattedTuitionTotal(amounts[monthIndex]) + " (" + paymentMonthLabel(month) + ")";
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
      var total = rate * classCount;
      if (totalColumn !== -1) row[totalColumn] = classCount ? formattedTuitionTotal(rate * classCount) + " (" + classCount + " " + (classCount === 1 ? "class" : "classes") + ")" : "";
      if (monthlyColumn !== -1) row[monthlyColumn] = classCount ? formattedPaymentPlan(program, rowIndex, total) : "";
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

  function renderGeneratedDatesTable(program) {
    var monthKeys = (program.classDates || []).reduce(function (months, dates) {
      paymentMonths(dates).forEach(function (month) {
        if (months.indexOf(month) === -1) months.push(month);
      });
      return months;
    }, []).sort();
    if (!monthKeys.length) return '<p class="schedule-empty">Enter a start date, end date, and class day to generate the schedule.</p>';
    var monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long" });
    var dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
    var html = '<div class="class-schedule-table-wrap"><table class="class-schedule-table"><thead><tr><th>Classes / days</th>' + monthKeys.map(function (month) {
      return "<th>" + escapeHtml(monthFormatter.format(dateFromIso(month + "-01"))) + "</th>";
    }).join("") + "</tr></thead><tbody>";
    (program.rows || []).forEach(function (row, rowIndex) {
      var dates = (program.classDates || [])[rowIndex] || [];
      html += '<tr><th scope="row"><strong>' + escapeHtml(row[0] || "Tuition row " + (rowIndex + 1)) + "</strong><span>" + dates.length + " " + (dates.length === 1 ? "class" : "classes") + "</span></th>";
      monthKeys.forEach(function (month) {
        html += "<td>";
        dates.forEach(function (value, dateIndex) {
          if (String(value).slice(0, 7) !== month) return;
          var date = dateFromIso(value);
          var label = date ? dayFormatter.format(date) + " " + (date.getMonth() + 1) + "/" + date.getDate() : value;
          html += '<div class="class-date-row"><time datetime="' + escapeHtml(value) + '">' + escapeHtml(label) + '</time><button class="remove-class-date" type="button" title="Remove class date" aria-label="Remove ' + escapeHtml(label) + " from " + escapeHtml(row[0] || "this option") + '" data-action="remove-class-date" data-index="' + rowIndex + '" data-date-index="' + dateIndex + '">&times;</button></div>';
        });
        html += "</td>";
      });
      html += "</tr>";
    });
    return html + "</tbody></table></div>";
  }

  function renderScheduleBuilder(base, program) {
    var rules = program.scheduleRules || [];
    var html = '<section class="editor-block schedule-builder">' +
      blockHeading("Class schedule", "Choose the weekly pattern, then remove any holidays or planned closures from the generated table.") +
      '<div class="schedule-rule-list">';
    (program.rows || []).forEach(function (row, rowIndex) {
      var rule = rules[rowIndex] || { intervalWeeks: 1, weekdays: [] };
      var dates = (program.classDates || [])[rowIndex] || [];
      html += '<article class="schedule-rule"><div class="schedule-rule-heading"><div><span class="repeater-number">Enrollment option</span><h3>' + escapeHtml(row[0] || "Tuition row " + (rowIndex + 1)) + '</h3></div><strong>' + dates.length + ' class' + (dates.length === 1 ? "" : "es") + '</strong></div>' +
        '<div class="schedule-frequency"><label class="field"><span class="field-label"><span>Frequency</span></span><select data-path="' + escapeHtml(base + ".scheduleRules." + rowIndex + ".intervalWeeks") + '">' +
          [1, 2, 3, 4].map(function (interval) { return '<option value="' + interval + '"' + (Number(rule.intervalWeeks) === interval ? " selected" : "") + '>Every ' + (interval === 1 ? "week" : interval + " weeks") + "</option>"; }).join("") +
        '</select></label><fieldset class="weekday-fieldset"><legend>Class days</legend><div class="weekday-checks">' +
          WEEKDAYS.map(function (day, dayIndex) { return '<label><input type="checkbox" data-schedule-day="' + dayIndex + '" data-rule-index="' + rowIndex + '"' + ((rule.weekdays || []).map(Number).indexOf(dayIndex) !== -1 ? " checked" : "") + " />" + escapeHtml(day.slice(0, 3)) + "</label>"; }).join("") +
        "</div></fieldset></div></article>";
    });
    return html + '</div><div class="generated-schedule-heading"><div><h3>Scheduled class dates</h3><p>Dates are grouped by month like the registration flyer. Remove a date to exclude that class.</p></div></div>' + renderGeneratedDatesTable(program) + "</section>";
  }

  function renderPaymentPlanBuilder(base, program) {
    var plans = program.paymentPlans || [];
    var rate = Number(program.ratePerClass);
    var html = '<section class="editor-block payment-plan-builder">' +
      blockHeading("Installment plans", "Payment months come from each option's class dates. Flyer amounts stay unchanged until you edit them or request a suggestion.") +
      '<div class="payment-plan-list">';
    (program.rows || []).forEach(function (row, rowIndex) {
      var dates = (program.classDates || [])[rowIndex] || [];
      var months = paymentMonths(dates);
      var total = Number.isFinite(rate) ? rate * dates.length : 0;
      var plan = plans[rowIndex] || { mode: "regular-final", regularAmount: "", customAmounts: [] };
      var mode = plan.mode === "custom" ? "custom" : "regular-final";
      var amounts = paymentPlanAmounts(program, rowIndex, total);
      var path = base + ".paymentPlans." + rowIndex;
      html += '<article class="payment-plan"><div class="schedule-rule-heading"><div><span class="repeater-number">Enrollment option</span><h3>' + escapeHtml(row[0] || "Tuition row " + (rowIndex + 1)) + '</h3></div><strong>' + months.length + " payment month" + (months.length === 1 ? "" : "s") + "</strong></div>" +
        '<div class="payment-plan-settings">' +
          field("Payment method", path + ".mode", mode, { options: [
            { value: "regular-final", label: "Regular + final balance" },
            { value: "custom", label: "Custom installments" }
          ] }) +
          (mode === "regular-final" ? field("Regular installment", path + ".regularAmount", plan.regularAmount || "", { type: "number", paymentAmount: true, hint: "Enter the full amount, then click Apply" }) : '<div class="field"><span class="field-label"><span>Custom amounts</span><span class="field-hint">One per payment month</span></span><span class="payment-plan-copy">Enter all amounts, then click Apply.</span></div>') +
        '</div><div class="payment-month-grid">';
      months.forEach(function (month, monthIndex) {
        var amount = amounts[monthIndex];
        html += '<label class="payment-month"><span>' + escapeHtml(paymentMonthLabel(month)) + (monthIndex === months.length - 1 && mode === "regular-final" ? " (final)" : "") + "</span>" +
            (mode === "custom" ? '<input type="number" min="0" step="0.01" data-payment-amount data-path="' + escapeHtml(path + ".customAmounts." + monthIndex) + '" value="' + escapeHtml((plan.customAmounts || [])[monthIndex] || "") + '" />' : '<output>' + escapeHtml(Number.isFinite(amount) ? formattedTuitionTotal(amount) : "Enter an amount") + "</output>") + "</label>";
      });
          html += '</div><div class="payment-plan-footer"><span>Total tuition: <strong>' + escapeHtml(formattedTuitionTotal(total)) + '</strong></span><div class="payment-plan-actions"><button class="small-button payment-apply-button" type="button" data-action="apply-payment-plan" data-index="' + rowIndex + '">Apply payment plan</button><button class="small-button" type="button" data-action="suggest-payment-plan" data-index="' + rowIndex + '">Suggest a plan</button></div></div></article>';
    });
    return html + "</div></section>";
  }

  function refreshScheduleDependentEditors(programKey) {
    var program = state.tuition.programs[programKey];
    var base = "programs." + programKey;
    var scheduleBuilder = editorContent.querySelector(".schedule-builder");
    var paymentPlanBuilder = editorContent.querySelector(".payment-plan-builder");
    if (scheduleBuilder) scheduleBuilder.outerHTML = renderScheduleBuilder(base, program);
    if (paymentPlanBuilder) paymentPlanBuilder.outerHTML = renderPaymentPlanBuilder(base, program);

    var calculatedValues = [];
    (program.rows || []).forEach(function (row) {
      (program.columns || []).forEach(function (column, columnIndex) {
        if (/total tuition|^tuition$|^monthly payments?$/i.test(String(column).trim())) calculatedValues.push(row[columnIndex] || "Enter dates and a per-class rate");
      });
    });
    editorContent.querySelectorAll(".calculated-cell-output").forEach(function (output, index) {
      if (calculatedValues[index] !== undefined) output.textContent = calculatedValues[index];
    });
  }

  function programValidation(programKey) {
    if (window.APLS_CMS_VALIDATION) {
      return window.APLS_CMS_VALIDATION.validateProgram(programKey, {
        tuition: state.tuition,
        calendar: state.calendar,
        calendarRows: state.calendarRows
      });
    }
    var program = (state.tuition.programs || {})[programKey] || {};
    var errors = [];
    var warnings = [];
    var start = dateFromIso(program.startDate);
    var calendarProgramStartValue = supportsSeparateCalendarStart(programKey) ? program.calendarStartDate || program.startDate : program.startDate;
    var calendarProgramStart = dateFromIso(calendarProgramStartValue);
    var end = dateFromIso(program.endDate);
    var applicationRequired = ["Open", "Waitlist", "Coming soon"].indexOf(program.enrollmentStatus) !== -1;

    if (applicationRequired && !String(program.applicationUrl || "").trim()) errors.push("An application URL is required while enrollment is " + program.enrollmentStatus + ".");
    if (program.startDate && !start) errors.push("Start date is invalid.");
    if (supportsSeparateCalendarStart(programKey) && program.calendarStartDate && !dateFromIso(program.calendarStartDate)) errors.push("Calendar start date is invalid.");
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
      if (!calendarProgramStart) warnings.push("Calendar lists " + calendarStartDate + " for \u201c" + calendarStart.event + "\u201d, but the calendar start date is missing.");
      else if (calendarProgramStartValue !== calendarStartDate) warnings.push("Program calendar starts " + calendarProgramStartValue + ", but the matching calendar event starts " + calendarStartDate + ".");
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
        var dates = (program.classDates || [])[rowIndex] || [];
        var months = paymentMonths(dates);
        var plan = (program.paymentPlans || [])[rowIndex];
        var total = rate * dates.length;
        if (!plan) errors.push(optionName + " needs an installment plan.");
        else if (plan.mode === "custom") {
          var customAmounts = months.map(function (_, monthIndex) { return Number((plan.customAmounts || [])[monthIndex]); });
          if (customAmounts.some(function (amount) { return !Number.isFinite(amount) || amount < 0; })) errors.push(optionName + " needs a non-negative custom payment for every class month.");
          else {
            var customTotal = customAmounts.reduce(function (sum, amount) { return sum + amount; }, 0);
            if (Math.abs(customTotal - total) > 0.009) errors.push(optionName + " installments total " + formattedTuitionTotal(customTotal) + ", but tuition is " + formattedTuitionTotal(total) + ".");
          }
        } else {
          var regularAmount = Number(plan.regularAmount);
          var finalAmount = total - (regularAmount * Math.max(0, months.length - 1));
          if (!Number.isFinite(regularAmount) || regularAmount < 0) errors.push(optionName + " needs a non-negative regular installment amount.");
          else if (finalAmount < 0) errors.push(optionName + " regular installments exceed total tuition before the final month.");
        }
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
      if (validation.errors.length) html += '<section class="validation-group is-error"><strong>' + validation.errors.length + ' error' + (validation.errors.length === 1 ? "" : "s") + ' \u00b7 download blocked</strong><ul>' + validation.errors.map(function (message) { return "<li>" + escapeHtml(message) + "</li>"; }).join("") + "</ul></section>";
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
    var instagramCount = (state.gallery.instagramPosts || []).filter(function (post) { return post.visible !== false; }).length;
    var publishedEventCount = (state.events.items || []).filter(function (item) { return item.status === "published"; }).length;
    var validationSummary = allProgramValidation();
    var validationDetail = programCount + " program workspaces \u00b7 " + validationSummary.programs + " need review";
    var finalWorkflowStep = cloudReady
      ? workflowStep("3", "Submit for review", "Send your saved changes through checks and staging before they are published.")
      : workflowStep("3", "Continue in cloud studio", "Open the secure cloud studio to save and submit changes for review.");
    if (validationSummary.errors) validationDetail += " \u00b7 " + validationSummary.errors + " errors";
    editorContent.innerHTML =
      '<div class="summary-grid">' +
        summaryCard("02", "Programs", validationDetail, "tuition") +
        summaryCard("03", "Calendar", yearCount + " school year" + (yearCount === 1 ? "" : "s"), "calendar") +
        summaryCard("04", "Teachers", teacherCount + " profile" + (teacherCount === 1 ? "" : "s"), "teachers") +
        summaryCard("05", "Gallery", instagramCount + " curated Instagram post" + (instagramCount === 1 ? "" : "s"), "gallery") +
        summaryCard("06", "Events & announcements", publishedEventCount + " published item" + (publishedEventCount === 1 ? "" : "s"), "events") +
      "</div>" +
      '<section class="workflow"><h2>Preview workflow</h2><div class="workflow-steps">' +
        workflowStep("1", "Choose a section", "Open one of the structured content editors.") +
        workflowStep("2", "Review as you type", "The right panel reflects every field change.") +
        finalWorkflowStep +
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
        field("Program name", base + ".name", program.name || "", { required: true }) +
        field("Current term", base + ".term", program.term || "", { hint: "Example: Fall 2026" }) +
        field("Enrollment status", base + ".enrollmentStatus", program.enrollmentStatus || "", { options: [
          { value: "", label: "Not set" },
          { value: "Open", label: "Open" },
          { value: "Waitlist", label: "Waitlist" },
          { value: "Closed", label: "Closed" },
          { value: "Coming soon", label: "Coming soon" },
          { value: "Inquire", label: "Inquire for availability" }
        ] }) +
        field("Application URL", base + ".applicationUrl", program.applicationUrl || "", { required: ["Open", "Waitlist", "Coming soon"].indexOf(program.enrollmentStatus) !== -1 }) +
        (supportsSeparateCalendarStart(selectedTuitionProgram) ? field("Calendar start date", base + ".calendarStartDate", program.calendarStartDate || "", { type: "date", hint: "Use when care or program operations begin before classes." }) : "") +
        field("Start date", base + ".startDate", program.startDate || "", { type: "date", required: fixedTermProgram(program) }) +
        field("End date", base + ".endDate", program.endDate || "", { type: "date", required: fixedTermProgram(program) }) +
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
      (usesScheduleBuilder(selectedTuitionProgram) ? renderPaymentPlanBuilder(base, program) : "") +
      '<section class="editor-block">' +
      blockHeading("Tuition", usesScheduleBuilder(selectedTuitionProgram) ? "Total tuition is calculated from class dates. Monthly payments use the installment plan above." : "This single note and table appear on both the Tuition page and the program page.") +
      '<div class="field-grid">' +
        field("Section heading", base + ".heading", program.heading || "") +
        field("Per-class rate", base + ".ratePerClass", program.ratePerClass || "", { type: "number", required: usesScheduleBuilder(selectedTuitionProgram), hint: usesScheduleBuilder(selectedTuitionProgram) ? "Used to calculate total tuition" : "Numbers only" }) +
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
    if (window.APLS_CMS_VALIDATION) {
      return window.APLS_CMS_VALIDATION.calendarRowIssues(row, rowIndex, state.calendarRows, state.calendar);
    }
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
      '<section class="sheet-setup"><div class="field-grid">' +
        field("School-year label", "years." + selectedCalendarYear + ".label", year.label || "", { required: true }) +
        field("School-year ID", "years." + selectedCalendarYear + ".id", year.id || "", { required: true, hint: "YYYY-YYYY" }) +
      "</div></section>" +
      '<section class="sheet-status" aria-live="polite"><div><strong data-calendar-count="events">' + rows.length + '</strong><span>events</span></div><div class="is-ready"><strong data-calendar-count="ready">' + summary.ready + '</strong><span>ready</span></div><div class="' + (summary.issues ? "has-issues" : "is-ready") + '"><strong data-calendar-count="issues">' + summary.issues + "</strong><span>need attention</span></div>" +
      '<button class="small-button" type="button" data-action="preview-print-calendar">Printable year</button>' +
      '<button class="small-button" type="button" data-action="add-calendar-row">Add event row</button></section>' +
      '<section class="calendar-sheet-wrap"><table class="calendar-sheet"><thead><tr><th class="sheet-row-number">#</th><th>School year</th><th>Start date <span class="col-required">Required</span></th><th>End date</th><th class="sheet-event-column">Event <span class="col-required">Required</span></th><th>Category</th><th>Notes</th><th>Check</th><th class="sheet-action-column"></th></tr></thead><tbody>';
    rows.forEach(function (row) {
      var rowIndex = state.calendarRows.indexOf(row);
      var issues = calendarRowIssues(row, rowIndex);
      var managed = Boolean(row.managedProgram || row.managedEvent);
      var locked = managed ? " disabled" : "";
      html += '<tr class="calendar-sheet-row' + (issues.length ? " has-error" : "") + (managed ? " is-managed" : "") + '">' +
        '<th scope="row" class="sheet-row-number">' + (rowIndex + 1) + "</th>" +
        '<td><select aria-label="School year for row ' + (rowIndex + 1) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="yearIndex"' + locked + ">" + calendarYearOptions(row.yearIndex) + "</select></td>" +
        '<td><input type="date" aria-label="Start date for row ' + (rowIndex + 1) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="startDate" value="' + escapeHtml(row.startDate) + '"' + locked + " /></td>" +
        '<td><input type="date" aria-label="End date for row ' + (rowIndex + 1) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="endDate" value="' + escapeHtml(row.endDate) + '"' + locked + " /></td>" +
        '<td><input type="text" aria-label="Event name for row ' + (rowIndex + 1) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="event" value="' + escapeHtml(row.event) + '"' + locked + " /></td>" +
        '<td><select aria-label="Category for row ' + (rowIndex + 1) + '" class="category-select category-' + escapeHtml(row.category) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="category"' + locked + ">" + calendarCategoryOptions(row.category) + "</select></td>" +
        '<td><input type="text" aria-label="Notes for row ' + (rowIndex + 1) + '" data-calendar-index="' + rowIndex + '" data-calendar-field="notes" value="' + escapeHtml(row.notes) + '"' + locked + " /></td>" +
        '<td class="sheet-check"><span class="' + (issues.length ? "check-error" : "check-ready") + '">' + escapeHtml(issues[0] || (row.managedEvent ? "Managed by Events & Announcements" : (managed ? "Managed by " + ((state.tuition.programs[row.managedProgram] || {}).name || row.managedProgram) : shortDateSummary(row)))) + "</span></td>" +
        '<td><button class="remove-cell" type="button" aria-label="Remove event row ' + (rowIndex + 1) + '" data-action="remove-calendar-row" data-index="' + rowIndex + '"' + locked + '>&times;</button></td></tr>';
    });
    html += '</tbody></table></section><div class="sheet-footer"><button class="small-button" type="button" data-action="add-calendar-row">Add event row</button><span>Weekdays are calculated from the dates. Leave End date blank for a one-day event.</span></div>' +
      '<details class="calendar-settings"><summary>Calendar notes</summary><div class="field-grid">' +
        field("Calendar footnote", "footnote", calendar.footnote || "", { textarea: true, full: true }) +
      "</div></details></div>";
    editorContent.innerHTML = html;
  }

  function renderTeachersEditor() {
    var html = '<section class="editor-block">' + blockHeading("Teacher profiles", "Profiles appear in this order on the homepage and the Why APLS page.", '<button class="small-button" type="button" data-action="add-teacher">Add teacher</button>') + '<div class="repeater-list">';
    state.teachers.forEach(function (teacher, index) {
      var base = String(index);
      html += '<article class="repeater-item"><div class="repeater-heading"><div><span class="repeater-number">Profile ' + (index + 1) + "</span><h3>" + escapeHtml(teacher.name || "Unnamed teacher") + '</h3></div><button class="danger-button" type="button" data-action="remove-teacher" data-index="' + index + '">Remove profile</button></div>' +
        '<div class="field-grid">' +
          field("Name", base + ".name", teacher.name || "", { required: true, hint: "Profiles without a real name stay hidden" }) +
          field("Role or program", base + ".role", teacher.role || "") +
          field("Years at APLS", base + ".years", teacher.years || "", { hint: "Leave blank to hide" }) +
          imageUploadField("Teacher photo", "teachers", base + ".photo", teacher.photo || "") +
          field("Fallback icon", base + ".icon", teacher.icon || "", { hint: "Shown when no photo is set" }) +
          field("Biography", base + ".bio", teacher.bio || "", { textarea: true, full: true }) +
        "</div></article>";
    });
    html += "</div></section>";
    editorContent.innerHTML = html;
  }

  function instagramUrlValid(value) {
    if (window.APLS_CMS_VALIDATION) return window.APLS_CMS_VALIDATION.instagramUrlValid(value);
    return /^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/[^/?#]+/i.test(String(value || "").trim());
  }

  function renderGalleryEditor() {
    var gallery = state.gallery;
    var posts = gallery.instagramPosts || [];
    var html = '<section class="editor-block">' +
      blockHeading("Latest from APLS", "These are public Instagram posts selected for the Gallery page.", '<a class="small-button editor-page-link" href="../gallery.html" target="_blank" rel="noopener">Open Gallery page</a>') +
      '<div class="editor-alert"><strong>Free Instagram workflow</strong><p>Post from the public @aplsfamilies account, copy the post link, and paste it here. The photo remains stored on Instagram.</p></div>' +
      '<div class="field-grid">' +
        field("Section heading", "instagramHeading", gallery.instagramHeading || "") +
        field("Instagram profile URL", "instagramProfileUrl", gallery.instagramProfileUrl || "") +
        field("Section introduction", "instagramIntro", gallery.instagramIntro || "", { textarea: true, full: true }) +
      '</div></section><section class="editor-block">' +
      blockHeading("Curated posts", "Posts appear in this order. Hidden posts stay in the data file but do not appear publicly.", '<button class="small-button" type="button" data-action="add-instagram-post">Add Instagram post</button>') +
      '<div class="repeater-list">';
    if (!posts.length) html += '<div class="editor-empty"><strong>No Instagram posts selected</strong><p>Add a post and paste its public Instagram URL.</p></div>';
    posts.forEach(function (post, index) {
      var valid = instagramUrlValid(post.url);
      html += '<article class="repeater-item media-editor-item' + (valid ? "" : " has-warning") + '"><div class="repeater-heading"><div><span class="repeater-number">Post ' + (index + 1) + '</span><h3>' + escapeHtml(post.caption || "Instagram post") + '</h3></div><div class="item-actions">' +
        '<button class="icon-move-button" type="button" aria-label="Move post ' + (index + 1) + ' up" title="Move up" data-action="move-gallery-post" data-index="' + index + '" data-direction="-1"' + (index === 0 ? " disabled" : "") + '>&uarr;</button>' +
        '<button class="icon-move-button" type="button" aria-label="Move post ' + (index + 1) + ' down" title="Move down" data-action="move-gallery-post" data-index="' + index + '" data-direction="1"' + (index === posts.length - 1 ? " disabled" : "") + '>&darr;</button>' +
        '<button class="danger-button" type="button" data-action="remove-gallery-post" data-index="' + index + '">Remove</button></div></div>' +
        (valid ? "" : '<p class="inline-warning">Paste a public Instagram post or Reel URL.</p>') +
        '<div class="field-grid">' +
          field("Instagram post URL", "instagramPosts." + index + ".url", post.url || "", { full: true, required: post.visible !== false, hint: "instagram.com/p/... or /reel/..." }) +
          field("Internal caption", "instagramPosts." + index + ".caption", post.caption || "", { full: true, hint: "Used in the CMS and as fallback link text" }) +
        '</div><div class="toggle-row">' + booleanField("Show on Gallery page", "instagramPosts." + index + ".visible", post.visible !== false, "Turn off to keep the link without displaying it.") + "</div></article>";
    });
    html += "</div></section>";
    editorContent.innerHTML = html;
  }

  function eventItemIssues(item) {
    if (window.APLS_CMS_VALIDATION) return window.APLS_CMS_VALIDATION.eventItemIssues(item);
    var issues = [];
    if (!String(item.title || "").trim()) issues.push("Title is required");
    if (item.type === "event" && !dateFromIso(item.startDate)) issues.push("Event date is required");
    if (item.endDate && !dateFromIso(item.endDate)) issues.push("End date is invalid");
    if (dateFromIso(item.startDate) && dateFromIso(item.endDate) && dateFromIso(item.endDate) < dateFromIso(item.startDate)) issues.push("End date is before start date");
    if (item.showOnCalendar && item.type !== "event") issues.push("Only events can appear on the school calendar");
    return issues;
  }

  function renderEventsEditor() {
    var items = state.events.items || [];
    var html = '<section class="editor-block">' +
      blockHeading("Events and announcements", "Published items appear on the Events page. Event dates can also appear on the school calendar.", '<a class="small-button editor-page-link" href="../events.html" target="_blank" rel="noopener">Open Events page</a>') +
      '<div class="button-row editor-primary-actions"><button class="small-button" type="button" data-action="add-event">Add event</button><button class="small-button" type="button" data-action="add-announcement">Add announcement</button></div></section>' +
      '<div class="repeater-list event-editor-list">';
    if (!items.length) html += '<div class="editor-empty"><strong>No events or announcements</strong><p>Add an item to begin building the public page.</p></div>';
    items.forEach(function (item, index) {
      var base = "items." + index;
      var issues = eventItemIssues(item);
      html += '<article class="repeater-item event-editor-item' + (issues.length ? " has-warning" : "") + '"><div class="repeater-heading"><div><span class="repeater-number">' + escapeHtml(item.type === "announcement" ? "Announcement" : "Event") + ' ' + (index + 1) + '</span><h3>' + escapeHtml(item.title || "Untitled") + '</h3><span class="content-status status-' + escapeHtml(item.status || "draft") + '">' + escapeHtml(item.status || "draft") + '</span></div><div class="item-actions">' +
        '<button class="icon-move-button" type="button" aria-label="Move item ' + (index + 1) + ' up" title="Move up" data-action="move-event" data-index="' + index + '" data-direction="-1"' + (index === 0 ? " disabled" : "") + '>&uarr;</button>' +
        '<button class="icon-move-button" type="button" aria-label="Move item ' + (index + 1) + ' down" title="Move down" data-action="move-event" data-index="' + index + '" data-direction="1"' + (index === items.length - 1 ? " disabled" : "") + '>&darr;</button>' +
        '<button class="danger-button" type="button" data-action="remove-event" data-index="' + index + '">Remove</button></div></div>' +
        (issues.length ? '<p class="inline-warning">' + escapeHtml(issues.join(" | ")) + "</p>" : "") +
        '<div class="field-grid">' +
          field("Content type", base + ".type", item.type || "event", { options: [{ value: "event", label: "Event" }, { value: "announcement", label: "Announcement" }] }) +
          field("Publishing status", base + ".status", item.status || "draft", { options: [{ value: "draft", label: "Draft \u2014 hidden from the website" }, { value: "published", label: "Published \u2014 visible on the website" }, { value: "archived", label: "Archived \u2014 removed from the website" }], hint: item.status === "published" ? "This item appears on the Events page once your update is published." : "Only Published items appear on the website. Draft items stay private, even after the website is updated." }) +
          field("Title", base + ".title", item.title || "", { full: true, required: true }) +
          field("Description", base + ".summary", item.summary || "", { textarea: true, full: true, rows: 4 }) +
        '</div><div class="event-only-fields' + (item.type === "announcement" ? " is-hidden" : "") + '"><h4>Event details</h4><div class="field-grid">' +
          field("Start date", base + ".startDate", item.startDate || "", { type: "date", required: item.type !== "announcement" }) +
          field("End date", base + ".endDate", item.endDate || "", { type: "date", hint: "Leave blank for one-day events" }) +
          field("Start time", base + ".startTime", item.startTime || "", { type: "time" }) +
          field("End time", base + ".endTime", item.endTime || "", { type: "time" }) +
          field("Location name", base + ".locationName", item.locationName || "") +
          field("Map URL", base + ".mapUrl", item.mapUrl || "") +
          field("Address", base + ".address", item.address || "", { full: true }) +
        "</div></div>" +
        '<h4>Image and actions</h4><div class="field-grid">' +
          imageUploadField("Flyer or image", "events", base + ".image", item.image || "", item.featured ? "Shown full size because this item is featured. JPEG, PNG, or WebP \u00b7 10 MB max" : "Shown as a thumbnail on the Events page. Turn on Feature this item to show it full size. JPEG, PNG, or WebP \u00b7 10 MB max") +
          field("Image alt text", base + ".imageAlt", item.imageAlt || "", { hint: "Left blank, the website describes the image using the title and date. Fill this in only when the picture needs a different description." }) +
          field("Primary button label", base + ".primaryLabel", item.primaryLabel || "") +
          field("Primary button URL", base + ".primaryUrl", item.primaryUrl || "") +
          field("Secondary button label", base + ".secondaryLabel", item.secondaryLabel || "") +
          field("Secondary button URL", base + ".secondaryUrl", item.secondaryUrl || "") +
        '</div><div class="toggle-row">' +
          booleanField("Feature this item", base + ".featured", Boolean(item.featured), "Featured content appears first on the Events page.") +
          booleanField("Show on school calendar", base + ".showOnCalendar", Boolean(item.showOnCalendar), "The calendar entry is managed from this event.") +
        "</div></article>";
    });
    html += "</div>";
    editorContent.innerHTML = html;
  }

  function renderEditor() {
    if (activeSection === "overview") renderOverviewEditor();
    if (activeSection === "tuition") renderTuitionEditor();
    if (activeSection === "calendar") renderCalendarEditor();
    if (activeSection === "teachers") renderTeachersEditor();
    if (activeSection === "gallery") renderGalleryEditor();
    if (activeSection === "events") renderEventsEditor();
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
      [state.teachers.length, "Teacher profiles", "Shown on the homepage and Why APLS"],
      [(state.gallery.instagramPosts || []).filter(function (post) { return post.visible !== false; }).length, "Instagram posts", "Curated for the Gallery page"],
      [(state.events.items || []).filter(function (item) { return item.status === "published"; }).length, "Published updates", "Events and announcements"]
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

  function calendarPreviewColor(row) {
    var name = String(row.event || "");
    if (/^(first|last) day of (?:the )?(?:\d{4}[\u2013-]\d{4} )?school (?:year|in \d{4})/i.test(name)) return "school-boundary";
    if (/^(?:first|last) day of (?:the )?(?:After-School program|Saturday School)$/i.test(name)) return "none";
    if (row.category === "school-closed") return "school-closed";
    if (row.category === "childcare" || row.category === "camp" || row.category === "program-date") return "childcare-program";
    return "school-event";
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
        var eventButton = node("button", "calendar-preview-event calendar-color-" + calendarPreviewColor(row), agendaNumber);
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

    var legend = node("div", "calendar-preview-legend");
    Object.keys(CALENDAR_PREVIEW_COLORS).forEach(function (color) {
      if (!rows.some(function (row) { return calendarPreviewColor(row) === color; })) return;
      var item = node("span", "");
      item.appendChild(node("i", "calendar-color-" + color));
      item.appendChild(document.createTextNode(CALENDAR_PREVIEW_COLORS[color]));
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
      agendaItem.appendChild(node("span", "calendar-preview-agenda-number calendar-color-" + calendarPreviewColor(row), agendaIndex + 1));
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
        image.src = mediaPreviewSource(teacher.photo);
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

  function renderGalleryPreview() {
    var wrapper = node("div", "gallery-preview");
    wrapper.appendChild(node("h2", "", state.gallery.instagramHeading || "Latest from APLS"));
    if (state.gallery.instagramIntro) wrapper.appendChild(node("p", "", state.gallery.instagramIntro));
    var posts = (state.gallery.instagramPosts || []).filter(function (post) { return post.visible !== false; });
    if (!posts.length) {
      var empty = node("div", "preview-empty");
      empty.appendChild(node("strong", "", "No curated posts yet"));
      empty.appendChild(node("p", "", "Add a public Instagram post URL to activate this section on the Gallery page."));
      wrapper.appendChild(empty);
    } else {
      var grid = node("div", "gallery-preview-grid");
      posts.forEach(function (post, index) {
        var card = node("article", "gallery-preview-card" + (instagramUrlValid(post.url) ? "" : " has-warning"));
        card.appendChild(node("span", "gallery-preview-icon", "IG"));
        card.appendChild(node("strong", "", post.caption || "Instagram post " + (index + 1)));
        card.appendChild(node("small", "", instagramUrlValid(post.url) ? "Ready to embed" : "Instagram URL needed"));
        if (instagramUrlValid(post.url)) {
          var link = node("a", "", "Open post");
          link.href = post.url;
          link.target = "_blank";
          link.rel = "noopener";
          card.appendChild(link);
        }
        grid.appendChild(card);
      });
      wrapper.appendChild(grid);
    }
    previewCanvas.replaceChildren(wrapper);
  }

  function eventPreviewWhen(item) {
    var start = dateFromIso(item.startDate);
    if (!start) return item.type === "event" ? "Date needed" : "Announcement";
    var label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(start);
    if (item.startTime) label += " | " + item.startTime;
    return label;
  }

  function renderEventsPreview() {
    var wrapper = node("div", "events-preview");
    var published = (state.events.items || []).filter(function (item) { return item.status === "published"; });
    var items = published.length ? published : (state.events.items || []);
    if (!items.length) {
      var empty = node("div", "preview-empty");
      empty.appendChild(node("strong", "", "No content yet"));
      empty.appendChild(node("p", "", "Add an event or announcement to begin."));
      wrapper.appendChild(empty);
      previewCanvas.replaceChildren(wrapper);
      return;
    }
    var featured = items.find(function (item) { return item.featured; }) || items[0];
    var feature = node("article", "event-preview-feature");
    feature.appendChild(node("span", "preview-content-type", featured.status === "published" ? (featured.type || "event") : "draft preview"));
    if (featured.image) {
      var image = node("img");
      image.src = mediaPreviewSource(featured.image);
      image.alt = featured.imageAlt || featured.title || "APLS event";
      feature.appendChild(image);
    }
    feature.appendChild(node("h2", "", featured.title || "Untitled"));
    feature.appendChild(node("strong", "event-preview-date", eventPreviewWhen(featured)));
    if (featured.summary) feature.appendChild(node("p", "", featured.summary));
    wrapper.appendChild(feature);
    var remaining = items.filter(function (item) { return item !== featured; });
    if (remaining.length) {
      var list = node("div", "event-preview-list");
      remaining.forEach(function (item) {
        var row = node("article", "event-preview-row");
        row.appendChild(node("span", "preview-content-type", item.status === "published" ? (item.type || "event") : "draft"));
        row.appendChild(node("strong", "", item.title || "Untitled"));
        row.appendChild(node("small", "", eventPreviewWhen(item)));
        list.appendChild(row);
      });
      wrapper.appendChild(list);
    }
    if (!published.length) wrapper.appendChild(node("p", "preview-note", "Draft preview: no items are currently published."));
    previewCanvas.replaceChildren(wrapper);
  }

  function renderPreview() {
    previewCanvas.classList.toggle("is-calendar-preview", activeSection === "calendar");
    if (activeSection === "overview") renderOverviewPreview();
    if (activeSection === "tuition") renderTuitionPreview();
    if (activeSection === "calendar") renderCalendarPreview();
    if (activeSection === "teachers") renderTeachersPreview();
    if (activeSection === "gallery") renderGalleryPreview();
    if (activeSection === "events") renderEventsPreview();
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
    if (activeSection !== "overview") changedSections[activeSection] = true;
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
      if (window.APLS_CMS_CLOUD && window.APLS_CMS_CLOUD.enabled && cloudReady) {
        saveStatus.textContent = "Saving to cloud";
        window.APLS_CMS_CLOUD.saveDraft({
          baseSha: cloudBaseSha,
          state: state,
          changedSections: Object.keys(changedSections)
        }).then(function (result) {
          markSaved();
          draftPill.textContent = "Cloud draft saved";
          saveStatus.textContent = "Saved " + new Date(result.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          showToast("Draft saved securely.");
        }).catch(function (error) {
          saveStatus.textContent = "Cloud save failed";
          showToast(error.message);
        });
      } else {
        markSaved();
        showToast("Draft saved in this browser.");
      }
    } catch (error) {
      showToast("This browser blocked local draft storage.");
    }
  }

  function resetDraft() {
    if (!window.confirm("Discard this browser draft and reload the website source data?")) return;
    state = clone(sourceState);
    localStorage.removeItem(STORAGE_KEY);
    changedSections = {};
    isDirty = false;
    draftPill.textContent = "No unsaved changes";
    draftPill.classList.remove("is-dirty");
    saveStatus.textContent = "Source data loaded";
    syncAllProgramCalendars();
    syncAllEventCalendars();
    renderEditor();
    renderPreview();
    showToast("Draft reset to the website source data.");
    Object.keys(pendingMedia).forEach(function (path) { if (pendingMedia[path].previewUrl) URL.revokeObjectURL(pendingMedia[path].previewUrl); });
    pendingMedia = {};
    if (window.APLS_CMS_MEDIA && window.APLS_CMS_MEDIA.enabled) window.APLS_CMS_MEDIA.clear().catch(function () {});
    if (window.APLS_CMS_CLOUD && window.APLS_CMS_CLOUD.enabled && cloudReady) {
      window.APLS_CMS_CLOUD.discardDraft().catch(function (error) { showToast(error.message); });
    }
  }

  function changedSectionLabels() {
    return Object.keys(changedSections).map(function (section) {
      return SECTION_COPY[section] ? SECTION_COPY[section][0] : section;
    });
  }

  function renderSubmissionStatus(submission) {
    if (!submission) {
      submissionStatusPanel.hidden = true;
      stagingProgress.hidden = true;
      stagingLink.hidden = true;
      return;
    }
    var statuses = {
      submitted: ["Preparing staging", "Your update was received. The staging button appears at the top of this page in about a minute."],
      "checks-running": ["Preparing staging", "Your update is being checked. The staging button appears at the top of this page in about a minute."],
      "checks-failed": ["Update needs attention", "This update was not published to staging. Contact your website manager."],
      "staging-ready": ["Staging is ready", "Select View staging site at the top of this page to review your changes before they are published."],
      merged: ["Update approved", "This submission was approved. Its staging preview remains available."],
      closed: ["Review closed", "This submission was closed without being published."]
    };
    var status = statuses[submission.status] ? submission.status : "submitted";
    submissionStatusTitle.textContent = statuses[status][0];
    submissionStatusMessage.textContent = statuses[status][1];
    submissionStatusPanel.className = "submission-status is-" + status;
    var waiting = status === "submitted" || status === "checks-running";
    var ready = status === "staging-ready" || status === "merged";
    stagingProgressText.textContent = status === "checks-failed" ? "Update needs attention" : "Preparing staging";
    stagingProgress.classList.toggle("is-failed", status === "checks-failed");
    stagingProgress.hidden = !waiting && status !== "checks-failed";
    stagingLink.hidden = !ready;
    submissionStatusPanel.hidden = false;
    window.clearTimeout(submissionPollTimer);
    if (waiting) {
      submissionPollTimer = window.setTimeout(refreshSubmissionStatus, SUBMISSION_POLL_MS);
    }
  }

  function refreshSubmissionStatus() {
    if (!window.APLS_CMS_CLOUD || !window.APLS_CMS_CLOUD.enabled || !cloudReady) return;
    window.APLS_CMS_CLOUD.status().then(function (result) {
      renderSubmissionStatus(result.submission);
    }).catch(function () {
      submissionStatusMessage.textContent = "Status could not be refreshed. Reload this page to try again.";
    });
  }

  function blockingSubmissionIssues() {
    if (!window.APLS_CMS_VALIDATION) return [];
    var result = window.APLS_CMS_VALIDATION.validateAll({
      tuition: state.tuition,
      calendar: state.calendar,
      calendarRows: state.calendarRows,
      events: state.events,
      gallery: state.gallery
    });
    var blocking = [];
    Object.keys(result.programs).forEach(function (key) {
      (result.programs[key].errors || []).forEach(function (issue) {
        blocking.push(["Programs and tuition", issue]);
      });
    });
    result.calendar.forEach(function (row) {
      blocking.push(["Calendar row " + (row.index + 1), row.issues.join(" | ")]);
    });
    result.events.forEach(function (item) {
      if (item.blocking) blocking.push(["Events item " + (item.index + 1), item.issues.join(" | ")]);
    });
    result.gallery.forEach(function (item) {
      if (item.blocking) blocking.push(["Gallery post " + (item.index + 1), item.issues.join(" | ")]);
    });
    return blocking;
  }

  function openReviewDialog() {
    var labels = changedSectionLabels();
    if (!labels.length) {
      showToast("Make and save a change before submitting for review.");
      return;
    }
    var blocking = blockingSubmissionIssues();
    var problems = document.getElementById("review-problems");
    var submitButton = document.getElementById("submit-review");
    if (blocking.length) {
      problems.innerHTML = "<p><strong>Fix these before submitting</strong></p><ul>" + blocking.map(function (entry) {
        return "<li><strong>" + escapeHtml(entry[0]) + ":</strong> " + escapeHtml(entry[1]) + "</li>";
      }).join("") + "</ul>";
      problems.hidden = false;
      submitButton.disabled = true;
    } else {
      problems.hidden = true;
      problems.innerHTML = "";
      submitButton.disabled = false;
    }
    document.getElementById("review-sections").innerHTML = labels.map(function (label) { return "<li>" + escapeHtml(label) + "</li>"; }).join("");
    reviewDialog.showModal();
  }

  function submitForReview() {
    var sectionFiles = {
      tuition: "data/tuition.js",
      calendar: "data/calendar.js",
      teachers: "data/teachers.js",
      gallery: "data/gallery.js",
      events: "data/events.js"
    };
    var files = {};
    Object.keys(changedSections).forEach(function (section) {
      if (sectionFiles[section]) files[sectionFiles[section]] = { encoding: "utf-8", content: fileContent(section) };
    });
    var button = document.getElementById("submit-review");
    button.disabled = true;
    button.textContent = "Submitting...";
    Promise.all(Object.keys(pendingMedia).map(function (path) {
      return pendingMedia[path].blob.arrayBuffer().then(function (buffer) {
        var bytes = new Uint8Array(buffer);
        var binary = "";
        bytes.forEach(function (byte) { binary += String.fromCharCode(byte); });
        files[path] = { encoding: "base64", content: btoa(binary) };
      });
    })).then(function () { return window.APLS_CMS_CLOUD.submit({
      baseSha: cloudBaseSha,
      files: files,
      note: document.getElementById("review-note").value
    }); }).then(function (result) {
      reviewDialog.close();
      isDirty = false;
      // Keep the draft, changed sections, and uploaded images so a refresh restores the
      // submitted work and a follow-up submission still carries its image bytes.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (window.APLS_CMS_CLOUD && window.APLS_CMS_CLOUD.enabled && cloudReady) {
        window.APLS_CMS_CLOUD.saveDraft({
          baseSha: cloudBaseSha,
          state: state,
          changedSections: Object.keys(changedSections)
        }).catch(function () {});
      }
      draftPill.textContent = "Submitted for review";
      draftPill.classList.remove("is-dirty");
      saveStatus.textContent = "Checks running";
      showToast("Review request #" + result.submission.prNumber + " submitted.");
      renderSubmissionStatus(result.submission);
    }).catch(function (error) {
      if (error.payload && error.payload.code === "STALE_BASE") {
        cloudReady = false;
        saveStatus.textContent = "Website changed - reload required";
      }
      showToast(error.message);
    }).finally(function () {
      button.disabled = false;
      button.textContent = "Submit for review";
    });
  }

  function initializeCloud() {
    if (!window.APLS_CMS_CLOUD || !window.APLS_CMS_CLOUD.enabled) return;
    saveStatus.textContent = "Connecting securely";
    var mediaPromise = window.APLS_CMS_MEDIA && window.APLS_CMS_MEDIA.enabled ? window.APLS_CMS_MEDIA.list() : Promise.resolve([]);
    Promise.all([window.APLS_CMS_CLOUD.load(), mediaPromise]).then(function (results) {
      var context = results[0];
      results[1].forEach(function (record) {
        record.previewUrl = URL.createObjectURL(record.blob);
        pendingMedia[record.path] = record;
      });
      var buildSha = window.APLS_CMS_BUILD && window.APLS_CMS_BUILD.sourceSha;
      cloudBaseSha = context.baseSha;
      if (buildSha && buildSha !== cloudBaseSha) {
        saveStatus.textContent = "Editor update required";
        draftPill.textContent = "Reload after the editor updates";
        document.getElementById("save-button").disabled = true;
        document.getElementById("export-button").disabled = true;
        return;
      }
      cloudReady = true;
      document.getElementById("save-button").textContent = "Save now";
      document.getElementById("export-button").textContent = "Submit for review";
      document.getElementById("export-button").classList.remove("button-secondary");
      document.getElementById("export-button").classList.add("button-primary");
      document.getElementById("publishing-guidance").textContent = "Save your draft, then submit it for review. Your update will be checked and staged before your website manager publishes approved changes.";
      document.getElementById("cloud-studio-link").hidden = true;
      if (activeSection === "overview") renderOverviewEditor();
      if (context.draft && context.draft.state) {
        state = mergeDefaults(sourceState, context.draft.state);
        if (!Array.isArray(state.calendarRows)) state.calendarRows = calendarToRows(state.calendar);
        changedSections = {};
        (context.draft.changedSections || []).forEach(function (section) { changedSections[section] = true; });
        syncAllProgramCalendars();
        syncAllEventCalendars();
        renderEditor();
        renderPreview();
        draftPill.textContent = "Cloud draft loaded";
        saveStatus.textContent = "Saved " + new Date(context.draft.updatedAt).toLocaleString();
      } else {
        // The cloud cleared the draft (submission merged or closed), so drop any stale local copy.
        localStorage.removeItem(STORAGE_KEY);
        state = clone(sourceState);
        if (!Array.isArray(state.calendarRows)) state.calendarRows = calendarToRows(state.calendar);
        changedSections = {};
        isDirty = false;
        Object.keys(pendingMedia).forEach(function (path) { if (pendingMedia[path].previewUrl) URL.revokeObjectURL(pendingMedia[path].previewUrl); });
        pendingMedia = {};
        if (window.APLS_CMS_MEDIA && window.APLS_CMS_MEDIA.enabled) window.APLS_CMS_MEDIA.clear().catch(function () {});
        syncAllProgramCalendars();
        syncAllEventCalendars();
        renderEditor();
        renderPreview();
        draftPill.textContent = "No unsaved changes";
        draftPill.classList.remove("is-dirty");
        saveStatus.textContent = "Secure cloud editor ready";
      }
      refreshSubmissionStatus();
    }).catch(function (error) {
      saveStatus.textContent = "Cloud connection failed";
      showToast(error.message);
    });
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

  function moveArrayItem(items, index, direction) {
    var target = index + direction;
    if (target < 0 || target >= items.length) return false;
    var item = items.splice(index, 1)[0];
    items.splice(target, 0, item);
    return true;
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
        return !row.managedEvent && Number(row.yearIndex) === yearIndex && dateFromIso(row.startDate) && String(row.event || "").trim();
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

  function galleryHasErrors() {
    return (state.gallery.instagramPosts || []).some(function (post) {
      return post.visible !== false && !instagramUrlValid(post.url);
    });
  }

  function eventsHaveErrors() {
    return (state.events.items || []).some(function (item) {
      return item.status === "published" && eventItemIssues(item).length;
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
    if (action === "suggest-payment-plan") {
      var suggestionScrollPosition = window.scrollY;
      var paymentProgram = state.tuition.programs[selectedTuitionProgram];
      var paymentDates = (paymentProgram.classDates || [])[index] || [];
      var paymentMonthCount = paymentMonths(paymentDates).length;
      var paymentTotal = Number(paymentProgram.ratePerClass) * paymentDates.length;
      if (!paymentMonthCount || !Number.isFinite(paymentTotal)) return true;
      var suggestedAmount = Math.round((paymentTotal / paymentMonthCount) / 5) * 5;
      paymentProgram.paymentPlans = paymentProgram.paymentPlans || [];
      paymentProgram.paymentPlans[index] = {
        mode: "regular-final",
        regularAmount: String(suggestedAmount),
        customAmounts: []
      };
      updateGeneratedTuition(paymentProgram);
      markDirty();
      renderEditor();
      renderPreview();
      window.scrollTo(0, suggestionScrollPosition);
      showToast("Suggested installments added. Compare them with Sharon's flyer before downloading the update.");
      return true;
    }
    if (action === "apply-payment-plan") {
      var paymentCard = button.closest(".payment-plan");
      var applyScrollPosition = window.scrollY;
      paymentCard.querySelectorAll("[data-payment-amount][data-path]").forEach(function (paymentInput) {
        setPath(state.tuition, paymentInput.dataset.path, paymentInput.value);
      });
      updateGeneratedTuition(state.tuition.programs[selectedTuitionProgram]);
      markDirty();
      renderEditor();
      renderPreview();
      window.scrollTo(0, applyScrollPosition);
      showToast("Payment plan applied.");
      return true;
    }
    if (action === "remove-class-date") {
      var scheduleProgram = state.tuition.programs[selectedTuitionProgram];
      var scheduleDates = (scheduleProgram.classDates || [])[index] || [];
      scheduleDates.splice(Number(button.dataset.dateIndex), 1);
      updateGeneratedTuition(scheduleProgram);
      markDirty();
      renderEditor();
      renderPreview();
      showToast("Class date removed. Tuition and payments were recalculated.");
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
    if (action === "preview-print-calendar") {
      var selectedRows = state.calendarRows.filter(function (row) { return Number(row.yearIndex) === selectedCalendarYear; });
      if (selectedRows.some(function (row) { return calendarRowIssues(row, state.calendarRows.indexOf(row)).length; })) {
        showToast("Fix the calendar rows marked for attention before opening the printable year.");
        return true;
      }
      syncCalendarFromRows();
      var printPayload = JSON.stringify({
        calendar: state.calendar,
        tuition: state.tuition,
        events: state.events
      });
      try {
        localStorage.setItem(CALENDAR_PRINT_PREVIEW_KEY, printPayload);
      } catch (error) {
        // The new window also receives the payload for local file previews.
      }
      var printYear = (state.calendar.years[selectedCalendarYear] || {}).id || "";
      var printWindow = window.open("about:blank", "_blank");
      if (!printWindow) {
        showToast("Allow pop-ups to open the printable calendar preview.");
        return true;
      }
      printWindow.name = "APLS_CALENDAR_DRAFT:" + printPayload;
      printWindow.location.href = "../calendar-print.html?year=" + encodeURIComponent(printYear) + "&draft=1";
      return true;
    }

    if (action === "add-instagram-post") {
      state.gallery.instagramPosts.push({ url: "", caption: "", visible: true });
    }
    if (action === "remove-gallery-post") state.gallery.instagramPosts.splice(index, 1);
    if (action === "move-gallery-post" && !moveArrayItem(state.gallery.instagramPosts, index, Number(button.dataset.direction))) return true;
    if (action === "add-event" || action === "add-announcement") {
      state.events.items.push({
        id: (action === "add-event" ? "event-" : "announcement-") + Date.now(),
        type: action === "add-event" ? "event" : "announcement",
        status: "draft",
        featured: false,
        title: action === "add-event" ? "New event" : "New announcement",
        summary: "",
        startDate: "",
        endDate: "",
        startTime: "",
        endTime: "",
        locationName: "",
        address: "",
        mapUrl: "",
        image: "",
        imageAlt: "",
        primaryLabel: "",
        primaryUrl: "",
        secondaryLabel: "",
        secondaryUrl: "",
        showOnCalendar: false
      });
    }
    if (action === "remove-event") state.events.items.splice(index, 1);
    if (action === "move-event" && !moveArrayItem(state.events.items, index, Number(button.dataset.direction))) return true;

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
          rowTable.paymentPlans = rowTable.paymentPlans || [];
          rowTable.paymentPlans.push({ mode: "regular-final", regularAmount: "", customAmounts: [] });
        }
      }
    }
    if (action === "remove-table-row") {
      var removeRowTable = tableAt(path);
      removeRowTable.rows.splice(index, 1);
      if (/^programs\./.test(path) && removeRowTable.classDates) removeRowTable.classDates.splice(index, 1);
      if (/^programs\./.test(path) && usesScheduleBuilder(selectedTuitionProgram) && removeRowTable.scheduleRules) removeRowTable.scheduleRules.splice(index, 1);
      if (/^programs\./.test(path) && usesScheduleBuilder(selectedTuitionProgram) && removeRowTable.paymentPlans) removeRowTable.paymentPlans.splice(index, 1);
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
    if (/instagram-post|gallery-post/.test(action)) {
      markDirty();
      renderEditor();
      renderPreview();
      return true;
    }
    if (/event|announcement/.test(action)) {
      syncAllEventCalendars();
      markDirty();
      renderEditor();
      renderPreview();
      return true;
    }
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
      teachers: "/* APLS teacher data - exported from Content Studio */\nwindow.APLS_TEACHERS = ",
      gallery: "/* APLS gallery data - exported from Content Studio */\nwindow.APLS_GALLERY = ",
      events: "/* APLS events and announcements data - exported from Content Studio */\nwindow.APLS_EVENTS = "
    };
    if (section === "tuition") {
      Object.keys(state.tuition.programs || {}).forEach(function (programKey) {
        if (usesScheduleBuilder(programKey)) updateGeneratedTuition(state.tuition.programs[programKey]);
      });
    }
    if (section === "calendar") {
      syncCalendarFromRows();
      (state.calendar.years || []).forEach(function (year) {
        delete year.pdf;
        delete year.pdfLabel;
      });
    }
    return headers[section] + JSON.stringify(state[section], null, 2) + ";\n";
  }

  function exportFile(section) {
    if (!state[section]) return;
    if (section === "tuition" && tuitionHasErrors()) {
      showToast("Fix the program errors marked in Programs & Tuition before downloading the update.");
      if (activeSection !== "tuition") selectSection("tuition");
      return;
    }
    if (section === "calendar" && calendarHasErrors()) {
      showToast("Fix the calendar rows marked for attention before downloading the update.");
      return;
    }
    if (section === "gallery" && galleryHasErrors()) {
      showToast("Add a valid public Instagram URL or hide the incomplete Gallery post before downloading the update.");
      return;
    }
    if (section === "events" && eventsHaveErrors()) {
      showToast("Fix the published Events items marked for attention before downloading the update.");
      return;
    }
    if ((section === "tuition" || section === "calendar") && allProgramValidation().warnings) {
      var warningCount = allProgramValidation().warnings;
      if (!window.confirm(warningCount + " automatic warning" + (warningCount === 1 ? " remains" : "s remain") + ". Review the marked programs before sending the update. Download anyway?")) return;
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
    showToast(section + ".js exported as a local backup.");
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
    var paymentAmountInput = event.target.closest("[data-payment-amount]");
    if (paymentAmountInput) {
      var paymentCard = paymentAmountInput.closest(".payment-plan");
      if (paymentCard) paymentCard.classList.add("has-pending-payment");
      markDirty();
      return;
    }
    var booleanInput = event.target.closest("[data-boolean-path]");
    if (booleanInput) {
      setPath(state[activeSection], booleanInput.dataset.booleanPath, booleanInput.checked);
      if (activeSection === "events" && /\.featured$/.test(booleanInput.dataset.booleanPath) && booleanInput.checked) {
        var featuredIndex = Number(booleanInput.dataset.booleanPath.split(".")[1]);
        state.events.items.forEach(function (item, index) { item.featured = index === featuredIndex; });
      }
      if (activeSection === "events") syncAllEventCalendars();
      markDirty();
      renderEditor();
      renderPreview();
      return;
    }
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
      var customPaymentSeed = null;
      var paymentModeMatch = input.dataset.path.match(/^programs\.([^.]+)\.paymentPlans\.(\d+)\.mode$/);
      if (activeSection === "tuition" && paymentModeMatch && input.value === "custom") {
        var seedProgram = state.tuition.programs[paymentModeMatch[1]];
        var seedRowIndex = Number(paymentModeMatch[2]);
        var seedDates = (seedProgram.classDates || [])[seedRowIndex] || [];
        customPaymentSeed = paymentPlanAmounts(seedProgram, seedRowIndex, Number(seedProgram.ratePerClass) * seedDates.length);
      }
      setPath(state[activeSection], input.dataset.path, input.value);
      if (activeSection === "events") {
        syncAllEventCalendars();
        markDirty();
        if (/\.(type|status)$/.test(input.dataset.path)) renderEditor();
        renderPreview();
        return;
      }
      if (activeSection === "gallery") {
        markDirty();
        renderPreview();
        return;
      }
      if (customPaymentSeed) {
        state.tuition.programs[paymentModeMatch[1]].paymentPlans[Number(paymentModeMatch[2])].customAmounts = customPaymentSeed.map(String);
      }
      if (activeSection === "tuition" && input.type === "date") {
        markDirty();
        refreshRequiredBadges();
        updateTuitionValidationFeedback();
        renderPreview();
        return;
      }
      var schedulePath = "programs." + selectedTuitionProgram + ".";
      var regeneratesSchedule = input.dataset.path === schedulePath + "startDate" || input.dataset.path === schedulePath + "endDate" || input.dataset.path.indexOf(schedulePath + "scheduleRules.") === 0;
      var updatesCalendarStart = input.dataset.path === schedulePath + "calendarStartDate";
      var updatesPaymentPlan = input.dataset.path.indexOf(schedulePath + "paymentPlans.") === 0;
      var recalculatesTuition = input.dataset.path === schedulePath + "ratePerClass";
      if (activeSection === "tuition" && usesScheduleBuilder(selectedTuitionProgram) && (regeneratesSchedule || updatesCalendarStart || updatesPaymentPlan || recalculatesTuition)) {
        var tuitionScrollPosition = updatesPaymentPlan ? window.scrollY : null;
        if (regeneratesSchedule) updateGeneratedClassDates(state.tuition.programs[selectedTuitionProgram]);
        if (regeneratesSchedule || updatesCalendarStart) syncProgramCalendar(selectedTuitionProgram);
        else updateGeneratedTuition(state.tuition.programs[selectedTuitionProgram]);
        markDirty();
        renderEditor();
        renderPreview();
        if (tuitionScrollPosition !== null) window.scrollTo(0, tuitionScrollPosition);
        return;
      }
      markDirty();
      refreshRequiredBadges();
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
    var imageInput = event.target.closest("[data-image-upload]");
    if (imageInput) {
      var file = imageInput.files && imageInput.files[0];
      if (!file || !window.APLS_CMS_MEDIA || !window.APLS_CMS_MEDIA.enabled) return;
      imageInput.disabled = true;
      saveStatus.textContent = "Optimizing image";
      window.APLS_CMS_MEDIA.process(file).then(function (record) {
        record.previewUrl = URL.createObjectURL(record.blob);
        pendingMedia[record.path] = record;
        return window.APLS_CMS_MEDIA.save({
          path: record.path,
          blob: record.blob,
          width: record.width,
          height: record.height,
          size: record.size,
          type: record.type,
          originalName: record.originalName,
          updatedAt: record.updatedAt
        }).then(function () {
          setPath(state[imageInput.dataset.imageSection], imageInput.dataset.imagePath, record.path);
          markDirty();
          renderEditor();
          renderPreview();
          showToast("Image optimized to " + Math.ceil(record.size / 1024) + " KB.");
        });
      }).catch(function (error) {
        imageInput.disabled = false;
        showToast(error.message);
      });
      return;
    }
    var tuitionDateInput = event.target.closest('[data-path][type="date"]');
    if (tuitionDateInput && activeSection === "tuition") {
      setPath(state.tuition, tuitionDateInput.dataset.path, tuitionDateInput.value);
      var schedulePath = "programs." + selectedTuitionProgram + ".";
      var regeneratesSchedule = tuitionDateInput.dataset.path === schedulePath + "startDate" || tuitionDateInput.dataset.path === schedulePath + "endDate";
      var updatesCalendarStart = tuitionDateInput.dataset.path === schedulePath + "calendarStartDate";
      if (usesScheduleBuilder(selectedTuitionProgram) && (regeneratesSchedule || updatesCalendarStart)) {
        if (regeneratesSchedule) updateGeneratedClassDates(state.tuition.programs[selectedTuitionProgram]);
        syncProgramCalendar(selectedTuitionProgram);
        refreshScheduleDependentEditors(selectedTuitionProgram);
      } else {
        updateTuitionValidationFeedback();
      }
      markDirty();
      renderPreview();
      return;
    }
    var calendarInput = event.target.closest('[data-calendar-field="yearIndex"]');
    if (!calendarInput) return;
    renderEditor();
    renderPreview();
  });

  document.getElementById("save-button").addEventListener("click", saveDraft);
  document.getElementById("reset-button").addEventListener("click", resetDraft);
  document.getElementById("export-button").addEventListener("click", function () {
    if (window.APLS_CMS_CLOUD && window.APLS_CMS_CLOUD.enabled && cloudReady) openReviewDialog();
    else if (activeSection === "overview") exportDialog.showModal();
    else exportFile(activeSection);
  });
  document.getElementById("close-export").addEventListener("click", function () { exportDialog.close(); });
  exportDialog.addEventListener("click", function (event) {
    if (event.target === exportDialog) exportDialog.close();
  });
  document.getElementById("close-review").addEventListener("click", function () { reviewDialog.close(); });
  document.getElementById("cancel-review").addEventListener("click", function () { reviewDialog.close(); });
  document.getElementById("submit-review").addEventListener("click", submitForReview);
  reviewDialog.addEventListener("click", function (event) { if (event.target === reviewDialog) reviewDialog.close(); });
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
  syncAllEventCalendars();
  selectSection("overview");
  if (loadDraft()) {
    draftPill.textContent = "Local draft loaded";
    saveStatus.textContent = "Local draft loaded";
  }
  initializeCloud();
})();