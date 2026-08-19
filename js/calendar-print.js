(function () {
  "use strict";

  var SOURCE_CATEGORIES = {
    "school-event": "School event",
    "school-closed": "School closed",
    childcare: "Childcare",
    camp: "Camp",
    "program-date": "Program date"
  };
  var COLOR_LABELS = {
    "school-closed": "School closed",
    "school-event": "School events",
    "childcare-program": "Childcare & programs",
    "school-boundary": "First / last day of school"
  };
  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function parseIsoDate(value) {
    var parts = String(value || "").split("-").map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2] ? date : null;
  }

  function monthIndexForName(value) {
    var normalized = String(value || "").replace(/\./g, "").slice(0, 3).toLowerCase();
    return ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(normalized);
  }

  function dateForSchoolYear(monthIndex, day, startYear, endYear) {
    if (monthIndex < 0 || !day) return null;
    return new Date(monthIndex >= 7 ? startYear : endYear, monthIndex, day);
  }

  function parseLegacyDatePart(value, fallbackMonth, startYear, endYear) {
    var match = String(value || "").trim().match(/^([A-Za-z.]+)?\s*(\d{1,2})/);
    if (!match) return null;
    var monthIndex = match[1] ? monthIndexForName(match[1]) : fallbackMonth;
    return dateForSchoolYear(monthIndex, Number(match[2]), startYear, endYear);
  }

  function legacyEventDates(label, yearId) {
    var yearMatch = String(yearId || "").match(/^(\d{4})-(\d{4})$/);
    if (!yearMatch) return { start: null, end: null };
    var parts = String(label || "").split(/\s+[\u2013-]\s+/);
    var start = parseLegacyDatePart(parts[0], -1, Number(yearMatch[1]), Number(yearMatch[2]));
    var end = parts[1] && start ? parseLegacyDatePart(parts[1], start.getMonth(), Number(yearMatch[1]), Number(yearMatch[2])) : null;
    return { start: start, end: end };
  }

  function categoryForRow(row) {
    return Object.keys(SOURCE_CATEGORIES).find(function (category) {
      return row.classList.contains("calendar-category-" + category);
    }) || "school-event";
  }

  function colorForEvent(name, category) {
    if (/^(first|last) day of (?:the )?(?:\d{4}[\u2013-]\d{4} )?school (?:year|in \d{4})/i.test(name)) return "school-boundary";
    if (/^first day of (?:the )?(?:After-School program|Saturday School)$/i.test(name)) return "none";
    if (category === "school-closed") return "school-closed";
    if (category === "childcare" || category === "camp" || category === "program-date") return "childcare-program";
    return "school-event";
  }

  function collectEvents(yearSection, yearId) {
    var events = [];
    yearSection.querySelectorAll("tbody tr").forEach(function (row) {
      if (row.querySelector(".cal-month")) return;
      var cells = row.querySelectorAll("td");
      if (cells.length < 2) return;
      var fallback = legacyEventDates(cells[0].textContent, yearId);
      var start = parseIsoDate(row.dataset.startDate) || fallback.start;
      if (!start) return;
      var name = cells[1].textContent;
      var category = categoryForRow(row);
      events.push({
        start: start,
        end: parseIsoDate(row.dataset.endDate) || fallback.end || start,
        dateLabel: cells[0].textContent,
        name: name,
        category: category,
        color: colorForEvent(name, category)
      });
    });
    return events.sort(function (left, right) {
      return left.start - right.start || left.name.localeCompare(right.name);
    });
  }

  function eventOccursOn(eventItem, date) {
    var target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    return target >= eventItem.start.getTime() && target <= eventItem.end.getTime();
  }

  function legendFor(events) {
    var used = {};
    events.forEach(function (eventItem) {
      if (eventItem.color !== "none") used[eventItem.color] = true;
    });
    var legend = element("div", "print-legend");
    Object.keys(COLOR_LABELS).forEach(function (color) {
      if (!used[color]) return;
      legend.appendChild(element("span", "legend-item calendar-color-" + color, COLOR_LABELS[color]));
    });
    return legend;
  }

  function pageHeader(yearId, periodLabel) {
    var header = element("header", "print-page-header");
    var logo = element("img");
    logo.className = "print-logo";
    logo.src = "images/apls-logo.png";
    logo.alt = "";
    header.appendChild(logo);
    var heading = element("div", "print-heading");
    heading.appendChild(element("h1", "", "Asia Pacific Language School " + yearId.replace("-", "\u2013") + " calendar"));
    heading.appendChild(element("p", "", periodLabel));
    header.appendChild(heading);
    return header;
  }

  function mondaysInMonth(year, monthIndex) {
    var mondays = [];
    var date = new Date(year, monthIndex, 1);
    while (date.getDay() !== 1) date.setDate(date.getDate() + 1);
    while (date.getMonth() === monthIndex) {
      mondays.push(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
      date.setDate(date.getDate() + 7);
    }
    return mondays;
  }

  function buildWeekdayGrid(period, events) {
    var table = element("table", "calendar-grid");
    var head = element("thead");
    var headRow = element("tr");
    headRow.appendChild(element("th", "calendar-month-heading", ""));
    WEEKDAYS.forEach(function (weekday) { headRow.appendChild(element("th", "", weekday)); });
    head.appendChild(headRow);
    table.appendChild(head);
    var body = element("tbody");

    period.months.forEach(function (monthDefinition) {
      var mondays = mondaysInMonth(monthDefinition.year, monthDefinition.month);
      mondays.forEach(function (monday, weekIndex) {
        var row = element("tr");
        if (weekIndex === 0) row.className = "month-start";
        if (weekIndex === 0) {
          var monthCell = element("th", "calendar-month-label");
          monthCell.rowSpan = mondays.length;
          monthCell.appendChild(element("span", "", MONTH_NAMES[monthDefinition.month].slice(0, 3)));
          monthCell.appendChild(element("strong", "", monthDefinition.year));
          row.appendChild(monthCell);
        }
        WEEKDAYS.forEach(function (weekday, dayOffset) {
          var date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + dayOffset);
          var dayEvents = events.filter(function (eventItem) { return eventOccursOn(eventItem, date); });
          var cell = element("td", dayEvents.length ? "has-calendar-event" : "", date.getDate());
          dayEvents.forEach(function (eventItem) { cell.classList.add("calendar-color-" + eventItem.color); });
          if (dayEvents.length) cell.title = dayEvents.map(function (eventItem) { return eventItem.name; }).join("; ");
          row.appendChild(cell);
        });
        body.appendChild(row);
      });
    });
    table.appendChild(body);
    return table;
  }

  function eventIsInPeriod(eventItem, period) {
    return eventItem.start <= period.end && eventItem.end >= period.start;
  }

  function buildNotes(period, events) {
    var panel = element("section", "calendar-notes");
    panel.appendChild(element("h2", "notes-heading", "School Holidays & Notes"));
    var periodEvents = events.filter(function (eventItem) { return eventIsInPeriod(eventItem, period); });
    var holidays = periodEvents.filter(function (eventItem) { return eventItem.category === "school-closed"; });
    var holidayList = element("div", "holiday-list");
    holidays.forEach(function (eventItem) {
      var row = element("div", "holiday-row");
      row.appendChild(element("span", "", eventItem.name.replace(/\s+[\u2013-]\s+school closed$/i, "")));
      row.appendChild(element("strong", "", eventItem.dateLabel));
      holidayList.appendChild(row);
    });
    if (!holidays.length) holidayList.appendChild(element("p", "notes-empty", "No school closures listed."));
    panel.appendChild(holidayList);

    var monthlyGroups = {};
    periodEvents.forEach(function (eventItem) {
      var key = eventItem.start.getFullYear() + "-" + String(eventItem.start.getMonth() + 1).padStart(2, "0");
      monthlyGroups[key] = monthlyGroups[key] || [];
      monthlyGroups[key].push(eventItem);
    });
    Object.keys(monthlyGroups).sort().forEach(function (key) {
      var groupEvents = monthlyGroups[key];
      var monthSection = element("section", "notes-month");
      monthSection.appendChild(element("h3", "", MONTH_NAMES[groupEvents[0].start.getMonth()] + " " + groupEvents[0].start.getFullYear()));
      groupEvents.forEach(function (eventItem) {
        var note = element("div", "note-row calendar-color-" + eventItem.color);
        note.appendChild(element("strong", "note-date", eventItem.dateLabel));
        note.appendChild(element("span", "note-name", eventItem.name));
        monthSection.appendChild(note);
      });
      panel.appendChild(monthSection);
    });
    return panel;
  }

  function renderPrintableCalendar() {
    var params = new URLSearchParams(window.location.search);
    var requestedYear = params.get("year") || "";
    var sections = Array.from(document.querySelectorAll("#calendar-root .calendar-year"));
    var yearSection = sections.find(function (section) {
      return section.dataset.calendarYear === requestedYear;
    }) || sections[0];
    var documentRoot = document.getElementById("print-document");

    if (!yearSection) {
      documentRoot.replaceChildren(element("p", "print-error", "No calendar year is available to print."));
      return;
    }

    var yearLabel = (yearSection.querySelector("h2") || {}).textContent || "School calendar";
    var yearId = yearSection.dataset.calendarYear || requestedYear;
    var yearMatch = yearId.match(/^(\d{4})-(\d{4})$/);
    if (!yearMatch) {
      documentRoot.replaceChildren(element("p", "print-error", "The school-year ID must use YYYY-YYYY format."));
      return;
    }
    var startYear = Number(yearMatch[1]);
    var endYear = Number(yearMatch[2]);
    var events = collectEvents(yearSection, yearId);
    var periods = [
      {
        label: "August through December " + startYear,
        start: new Date(startYear, 7, 1),
        end: new Date(startYear, 11, 31),
        months: [7, 8, 9, 10, 11].map(function (month) { return { year: startYear, month: month }; })
      },
      {
        label: "January through June " + endYear,
        start: new Date(endYear, 0, 1),
        end: new Date(endYear, 5, 30),
        months: [0, 1, 2, 3, 4, 5].map(function (month) { return { year: endYear, month: month }; })
      }
    ];
    var footnote = (window.APLS_CALENDAR || {}).footnote || "";
    documentRoot.innerHTML = "";

    periods.forEach(function (period, pageIndex) {
      var sheet = element("section", "print-sheet");
      sheet.appendChild(pageHeader(yearId, period.label));
      var content = element("div", "print-calendar-layout");
      content.appendChild(buildWeekdayGrid(period, events));
      content.appendChild(buildNotes(period, events));
      sheet.appendChild(content);
      var footer = element("footer", "print-page-footer");
      var footerCopy = element("div");
      if (footnote) footerCopy.appendChild(element("p", "", footnote));
      footerCopy.appendChild(legendFor(events.filter(function (eventItem) { return eventIsInPeriod(eventItem, period); })));
      footer.appendChild(footerCopy);
      footer.appendChild(element("span", "print-page-number", "Page " + (pageIndex + 1) + " of " + periods.length));
      sheet.appendChild(footer);
      documentRoot.appendChild(sheet);
    });

    document.title = yearLabel + " | APLS Printable Calendar";
    document.getElementById("draft-badge").hidden = params.get("draft") !== "1";
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderPrintableCalendar();
    document.getElementById("print-button").addEventListener("click", function () { window.print(); });
  });
})();