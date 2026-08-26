(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.APLS_CMS_VALIDATION = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function dateFromIso(value) {
    var match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null;
    return date;
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
    if (metadata && metadata.startDate) return { startDate: metadata.startDate, endDate: metadata.endDate || "" };
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
    (calendar && calendar.years || []).forEach(function (year, yearIndex) {
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
            managedBoundary: metadata.managedBoundary || "",
            managedEvent: metadata.managedEvent || ""
          });
        });
      });
    });
    return rows;
  }

  function boundaryDefinition(programKey, boundary) {
    var definitions = {
      "after-school": { start: "First day of the After-School program", end: "Last day of the After-School program" },
      "saturday-school": { start: "First day of Saturday School", end: "Last day of Saturday School" }
    };
    return definitions[programKey] && definitions[programKey][boundary];
  }

  function supportsSeparateCalendarStart(programKey) {
    return programKey === "after-school";
  }

  function boundaryValue(programKey, program, boundary) {
    if (boundary === "start" && supportsSeparateCalendarStart(programKey) && program.calendarStartDate) return program.calendarStartDate;
    return program[boundary + "Date"] || "";
  }

  function managedCalendarRow(rows, programKey, boundary, program) {
    var eventName = boundaryDefinition(programKey, boundary);
    if (!eventName) return null;
    var year = String(boundaryValue(programKey, program, boundary) || program.term || "").match(/\b(20\d{2})\b/);
    return (rows || []).find(function (row) {
      if (row.managedProgram === programKey && row.managedBoundary === boundary) return true;
      return String(row.event || "").toLowerCase() === eventName.toLowerCase() && (!year || String(row.startDate).slice(0, 4) === year[1]);
    }) || null;
  }

  function programCalendarEvent(rows, programKey, program, boundary) {
    var managed = managedCalendarRow(rows, programKey, boundary || "start", program);
    if (managed) return managed;
    var pattern = programKey === "summer-camp" ? /summer language.*culture camp/i : null;
    return pattern ? (rows || []).find(function (row) { return pattern.test(String(row.event || "")); }) || null : null;
  }

  function currencyValue(value) {
    var match = String(value || "").match(/\$([\d,]+(?:\.\d{1,2})?)/);
    return match ? Number(match[1].replace(/,/g, "")) : null;
  }

  function declaredClassCount(row) {
    var match = (row || []).join(" ").match(/(\d+)\s*classes?/i);
    return match ? Number(match[1]) : null;
  }

  function paymentMonths(dates) {
    return (dates || []).reduce(function (months, value) {
      var key = String(value).slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(key) && months.indexOf(key) === -1) months.push(key);
      return months;
    }, []).sort();
  }

  function usesScheduleBuilder(programKey) {
    return programKey === "after-school" || programKey === "saturday-school";
  }

  function formatAmount(amount) {
    return "$" + Number(amount).toLocaleString("en-US", {
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2
    });
  }

  function validateProgram(programKey, input, options) {
    var tuition = input.tuition || { programs: {}, fees: [] };
    var program = (tuition.programs || {})[programKey] || {};
    var rows = input.calendarRows || calendarToRows(input.calendar);
    var errors = [];
    var warnings = [];
    var start = dateFromIso(program.startDate);
    var calendarStartValue = supportsSeparateCalendarStart(programKey) ? program.calendarStartDate || program.startDate : program.startDate;
    var calendarStart = dateFromIso(calendarStartValue);
    var end = dateFromIso(program.endDate);
    var applicationRequired = ["Open", "Waitlist", "Coming soon"].indexOf(program.enrollmentStatus) !== -1;

    if (applicationRequired && !String(program.applicationUrl || "").trim()) errors.push("An application URL is required while enrollment is " + program.enrollmentStatus + ".");
    if (program.startDate && !start) errors.push("Start date is invalid.");
    if (supportsSeparateCalendarStart(programKey) && program.calendarStartDate && !dateFromIso(program.calendarStartDate)) errors.push("Calendar start date is invalid.");
    if (program.endDate && !end) errors.push("End date is invalid.");
    if (start && end && end < start) errors.push("End date is before start date.");
    if (program.term && String(program.term).toLowerCase() !== "year-round" && program.enrollmentStatus !== "Inquire" && (!start || !end)) warnings.push("This fixed-term program needs both a start date and an end date.");
    if (program.enrollmentStatus === "Open" && end) {
      var today = options && options.today ? dateFromIso(options.today) : new Date();
      today.setHours(0, 0, 0, 0);
      if (end < today) errors.push("Enrollment is Open even though the program end date has passed.");
    }

    var calendarStartRow = programCalendarEvent(rows, programKey, program, "start");
    var calendarEndRow = programCalendarEvent(rows, programKey, program, "end");
    if (calendarStartRow) {
      var listedStart = calendarStartRow.startDate;
      if (!calendarStart) warnings.push("Calendar lists " + listedStart + " for \u201c" + calendarStartRow.event + "\u201d, but the calendar start date is missing.");
      else if (calendarStartValue !== listedStart) warnings.push("Program calendar starts " + calendarStartValue + ", but the matching calendar event starts " + listedStart + ".");
    }
    if (calendarEndRow) {
      var listedEnd = calendarEndRow.endDate || calendarEndRow.startDate;
      if (!end) warnings.push("Calendar lists " + listedEnd + " for \u201c" + calendarEndRow.event + "\u201d, but the program end date is missing.");
      else if (program.endDate !== listedEnd) warnings.push("Program ends " + program.endDate + ", but the matching calendar event is " + listedEnd + ".");
    }

    var careFee = (tuition.fees || []).find(function (fee) { return /^extended care\b/i.test(String(fee.label || "").trim()); });
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
          if (total !== null && Math.abs(total - expected) > 0.009) errors.push(optionName + " total is " + formatAmount(total) + ", but " + dates.length + " classes at " + formatAmount(rate) + " should total " + formatAmount(expected) + ".");
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
            if (Math.abs(customTotal - total) > 0.009) errors.push(optionName + " installments total " + formatAmount(customTotal) + ", but tuition is " + formatAmount(total) + ".");
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

  function calendarRowIssues(row, rowIndex, rows, calendar) {
    var issues = [];
    var start = dateFromIso(row.startDate);
    var end = dateFromIso(row.endDate);
    if (!start) issues.push("Start date is required");
    if (!String(row.event || "").trim()) issues.push("Event name is required");
    if (start && row.endDate && !end) issues.push("End date is invalid");
    if (start && end && end < start) issues.push("End date is before start date");
    var year = (calendar && calendar.years || [])[Number(row.yearIndex)];
    var yearMatch = year && String(year.id || "").match(/^(\d{4})-(\d{4})$/);
    if (start && yearMatch) {
      var earliest = new Date(Number(yearMatch[1]), 7, 1);
      var latest = new Date(Number(yearMatch[2]), 7, 31);
      if (start < earliest || start > latest || (end && end > latest)) issues.push("Date is outside this school year");
    }
    if (start && String(row.event || "").trim()) {
      var duplicate = rows.some(function (other, otherIndex) {
        return otherIndex !== rowIndex && Number(other.yearIndex) === Number(row.yearIndex) && other.startDate === row.startDate && other.endDate === row.endDate && String(other.event || "").trim().toLowerCase() === String(row.event || "").trim().toLowerCase();
      });
      if (duplicate) issues.push("Possible duplicate");
    }
    return issues;
  }

  function eventItemIssues(item) {
    var issues = [];
    if (!String(item.title || "").trim()) issues.push("Title is required");
    if (item.type === "event" && !dateFromIso(item.startDate)) issues.push("Event date is required");
    if (item.endDate && !dateFromIso(item.endDate)) issues.push("End date is invalid");
    if (dateFromIso(item.startDate) && dateFromIso(item.endDate) && dateFromIso(item.endDate) < dateFromIso(item.startDate)) issues.push("End date is before start date");
    if (item.showOnCalendar && item.type !== "event") issues.push("Only events can appear on the school calendar");
    return issues;
  }

  function documentItemIssues(item) {
    var issues = [];
    var file = String(item.file || "").trim();
    if (!String(item.title || "").trim()) issues.push("Link text is required");
    if (!file) issues.push("A PDF file is required");
    else if (!/^pdfs\/[^?#]+\.pdf$/i.test(file)) issues.push("The file must be a PDF in the pdfs folder");
    return issues;
  }

  function instagramUrlValid(value) {
    return /^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/[^/?#]+/i.test(String(value || "").trim());
  }

  function validateAll(input, options) {
    input = input || {};
    var rows = input.calendarRows || calendarToRows(input.calendar);
    var result = { programs: {}, calendar: [], events: [], gallery: [], documents: [], summary: { errors: 0, warnings: 0 } };
    Object.keys(input.tuition && input.tuition.programs || {}).forEach(function (key) {
      var validation = validateProgram(key, {
        tuition: input.tuition,
        calendar: input.calendar,
        calendarRows: rows
      }, options);
      result.programs[key] = validation;
      result.summary.errors += validation.errors.length;
      result.summary.warnings += validation.warnings.length;
    });
    rows.forEach(function (row, index) {
      var issues = calendarRowIssues(row, index, rows, input.calendar);
      if (issues.length) result.calendar.push({ index: index, issues: issues });
    });
    (input.events && input.events.items || []).forEach(function (item, index) {
      var issues = eventItemIssues(item);
      if (issues.length) result.events.push({ index: index, blocking: item.status === "published", issues: issues });
    });
    (input.gallery && input.gallery.instagramPosts || []).forEach(function (post, index) {
      if (post.visible !== false && !instagramUrlValid(post.url)) result.gallery.push({ index: index, blocking: true, issues: ["A visible Gallery post needs a valid public Instagram post or Reel URL"] });
    });
    (input.documents && input.documents.items || []).forEach(function (item, index) {
      var issues = documentItemIssues(item);
      if (issues.length) result.documents.push({ index: index, blocking: item.visible !== false, issues: issues });
    });
    result.summary.errors += result.calendar.length;
    result.summary.errors += result.events.filter(function (item) { return item.blocking; }).length;
    result.summary.errors += result.gallery.filter(function (item) { return item.blocking; }).length;
    result.summary.errors += result.documents.filter(function (item) { return item.blocking; }).length;
    return result;
  }

  return {
    calendarRowIssues: calendarRowIssues,
    calendarToRows: calendarToRows,
    dateFromIso: dateFromIso,
    documentItemIssues: documentItemIssues,
    eventItemIssues: eventItemIssues,
    instagramUrlValid: instagramUrlValid,
    validateAll: validateAll,
    validateProgram: validateProgram
  };
});