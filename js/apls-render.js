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

  /* ---------- Gallery ---------- */
  function instagramPostUrl(value) {
    var match = String(value || "").trim().match(/^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/[^/?#]+/i);
    return match ? match[0] + "/" : "";
  }

  function loadInstagramEmbeds() {
    if (window.instgrm && window.instgrm.Embeds) {
      window.instgrm.Embeds.process();
      return;
    }
    if (document.getElementById("instagram-embed-script")) return;
    var script = document.createElement("script");
    script.id = "instagram-embed-script";
    script.async = true;
    script.src = "https://www.instagram.com/embed.js";
    document.body.appendChild(script);
  }

  function renderGallery() {
    var root = document.getElementById("instagram-gallery-root");
    var section = document.getElementById("instagram-gallery-section");
    if (!root || !section || typeof window.APLS_GALLERY === "undefined") return;
    var data = window.APLS_GALLERY;
    var posts = (data.instagramPosts || []).filter(function (post) {
      return post.visible !== false && instagramPostUrl(post.url);
    });
    if (!posts.length) {
      section.hidden = true;
      return;
    }

    var heading = document.getElementById("instagram-gallery-heading");
    var intro = document.getElementById("instagram-gallery-intro");
    var profile = document.getElementById("instagram-profile-link");
    if (heading) heading.textContent = data.instagramHeading || "Latest from APLS";
    if (intro) intro.textContent = data.instagramIntro || "";
    if (profile && data.instagramProfileUrl) profile.href = data.instagramProfileUrl;
    root.innerHTML = "";
    posts.forEach(function (post) {
      var card = el("article", "instagram-gallery-card");
      var embed = el("blockquote", "instagram-media");
      embed.setAttribute("data-instgrm-permalink", instagramPostUrl(post.url));
      embed.setAttribute("data-instgrm-version", "14");
      embed.appendChild(el("a", null, post.caption || "View this post on Instagram"));
      embed.querySelector("a").href = instagramPostUrl(post.url);
      card.appendChild(embed);
      if (post.caption) card.appendChild(el("p", "instagram-gallery-caption", post.caption));
      root.appendChild(card);
    });
    section.hidden = false;
    loadInstagramEmbeds();
  }

  /* ---------- Events and announcements ---------- */
  function dateFromValue(value) {
    var parts = String(value || "").split("-").map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2] ? date : null;
  }

  function eventIsPast(item) {
    var end = dateFromValue(item.endDate || item.startDate);
    if (!end) return false;
    end.setHours(23, 59, 59, 999);
    return end < new Date();
  }

  function timeLabel(value) {
    var match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return "";
    var hour = Number(match[1]);
    var minute = match[2];
    return (hour % 12 || 12) + (minute === "00" ? "" : ":" + minute) + " " + (hour < 12 ? "a.m." : "p.m.");
  }

  function eventDateLabel(item, longForm) {
    var start = dateFromValue(item.startDate);
    var end = dateFromValue(item.endDate);
    if (!start) return "";
    var options = longForm
      ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
    var label = new Intl.DateTimeFormat("en-US", options).format(start);
    if (end && item.endDate !== item.startDate) label += " - " + new Intl.DateTimeFormat("en-US", options).format(end);
    return label;
  }

  function eventWhenLabel(item, longForm) {
    var label = eventDateLabel(item, longForm);
    var startTime = timeLabel(item.startTime);
    var endTime = timeLabel(item.endTime);
    if (startTime) label += " | " + startTime + (endTime ? "-" + endTime : "");
    return label;
  }

  function eventAction(label, url, primary) {
    if (!label || !url) return null;
    var link = el("a", primary ? "btn btn-primary" : "btn btn-ghost", label);
    link.href = url;
    if (/^https?:\/\//i.test(url)) {
      link.target = "_blank";
      link.rel = "noopener";
    }
    return link;
  }

  function appendEventActions(parent, item) {
    var primary = eventAction(item.primaryLabel, item.primaryUrl, true);
    var secondary = eventAction(item.secondaryLabel, item.secondaryUrl, false);
    if (!primary && !secondary) return;
    var actions = el("div", "event-actions");
    if (primary) actions.appendChild(primary);
    if (secondary) actions.appendChild(secondary);
    parent.appendChild(actions);
  }

  function renderFeaturedEvent(item) {
    var article = el("article", "container event-feature" + (item.image ? "" : " event-feature-no-image"));
    var details = el("div", "event-details");
    var eyebrow = item.type === "announcement" ? "Announcement" : (eventIsPast(item) ? "Past event" : "Upcoming event");
    details.appendChild(el("p", "eyebrow", eyebrow));
    details.appendChild(el("h2", null, item.title || "Untitled"));
    if (item.type !== "announcement" && item.startDate) details.appendChild(el("p", "event-date", eventWhenLabel(item, true)));
    if (item.summary) details.appendChild(el("p", null, item.summary));

    var facts = el("dl", "event-facts");
    if (item.type !== "announcement" && item.startDate) {
      var when = el("div");
      when.appendChild(el("dt", null, "When"));
      when.appendChild(el("dd", null, eventWhenLabel(item, false)));
      facts.appendChild(when);
    }
    if (item.address || item.locationName) {
      var where = el("div");
      where.appendChild(el("dt", null, "Where"));
      var whereValue = el("dd");
      if (item.mapUrl) {
        var mapLink = el("a", null, item.address || item.locationName);
        mapLink.href = item.mapUrl;
        mapLink.target = "_blank";
        mapLink.rel = "noopener";
        whereValue.appendChild(mapLink);
      } else {
        whereValue.textContent = item.address || item.locationName;
      }
      where.appendChild(whereValue);
      facts.appendChild(where);
    }
    var contact = el("div");
    contact.appendChild(el("dt", null, "Contact"));
    var contactValue = el("dd");
    var phone = el("a", null, "425-747-4172");
    phone.href = "tel:+14257474172";
    var email = el("a", null, "apls@apls.org");
    email.href = "mailto:apls@apls.org";
    contactValue.appendChild(phone);
    contactValue.appendChild(document.createTextNode(" | "));
    contactValue.appendChild(email);
    contact.appendChild(contactValue);
    facts.appendChild(contact);
    details.appendChild(facts);
    appendEventActions(details, item);
    article.appendChild(details);

    if (item.image) {
      var figure = el("figure", "event-flyer");
      var imageLink = el("a");
      imageLink.href = item.image;
      imageLink.target = "_blank";
      imageLink.rel = "noopener";
      imageLink.setAttribute("aria-label", "Open the full-size image for " + (item.title || "this event"));
      var image = el("img");
      image.src = item.image;
      image.alt = item.imageAlt || item.title || "APLS event";
      image.loading = "lazy";
      imageLink.appendChild(image);
      figure.appendChild(imageLink);
      figure.appendChild(el("figcaption", null, "Select the image to view it full size."));
      article.appendChild(figure);
    }
    return article;
  }

  function renderEventCard(item) {
    var card = el("article", "event-card");
    card.appendChild(el("p", "eyebrow", item.type === "announcement" ? "Announcement" : (eventIsPast(item) ? "Past event" : "Upcoming event")));
    card.appendChild(el("h3", null, item.title || "Untitled"));
    if (item.type !== "announcement" && item.startDate) card.appendChild(el("p", "event-card-date", eventWhenLabel(item, false)));
    if (item.summary) card.appendChild(el("p", null, item.summary));
    appendEventActions(card, item);
    return card;
  }

  function updateEventSchema(items) {
    var existing = document.getElementById("apls-events-schema");
    if (existing) existing.remove();
    var events = items.filter(function (item) { return item.type === "event" && item.startDate; }).map(function (item) {
      var schema = {
        "@type": "Event",
        name: item.title,
        description: item.summary,
        startDate: item.startDate + (item.startTime ? "T" + item.startTime : ""),
        endDate: (item.endDate || item.startDate) + (item.endTime ? "T" + item.endTime : ""),
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        organizer: { "@type": "EducationalOrganization", name: "Asia Pacific Language School", url: "https://www.apls.org/" }
      };
      if (item.image) schema.image = new URL(item.image, "https://www.apls.org/").href;
      if (item.locationName || item.address) schema.location = { "@type": "Place", name: item.locationName || "Asia Pacific Language School", address: item.address || "" };
      return schema;
    });
    if (!events.length) return;
    var script = document.createElement("script");
    script.id = "apls-events-schema";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": events });
    document.head.appendChild(script);
  }

  function renderEvents() {
    var root = document.getElementById("events-root");
    if (!root || typeof window.APLS_EVENTS === "undefined") return;
    var items = (window.APLS_EVENTS.items || []).filter(function (item) { return item.status === "published"; });
    root.innerHTML = "";
    if (!items.length) {
      var empty = el("section", "section");
      var emptyInner = el("div", "container events-empty");
      emptyInner.appendChild(el("h2", null, "No current announcements"));
      emptyInner.appendChild(el("p", null, "Please check back for upcoming APLS events and school announcements."));
      empty.appendChild(emptyInner);
      root.appendChild(empty);
      return;
    }
    var featured = items.find(function (item) { return item.featured; }) || items[0];
    var featureSection = el("section", "section");
    featureSection.appendChild(renderFeaturedEvent(featured));
    root.appendChild(featureSection);
    var remaining = items.filter(function (item) { return item !== featured; });
    if (remaining.length) {
      var listSection = el("section", "section event-list-section");
      var listInner = el("div", "container");
      listInner.appendChild(el("h2", null, "More events and announcements"));
      var grid = el("div", "event-list-grid");
      remaining.forEach(function (item) { grid.appendChild(renderEventCard(item)); });
      listInner.appendChild(grid);
      listSection.appendChild(listInner);
      root.appendChild(listSection);
    }
    updateEventSchema(items);
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
      var calendarStartDate = program.calendarStartDate || program.startDate;
      if (!calendarStartDate && !program.endDate) return;
      years.forEach(function (year) {
        (year.months || []).forEach(function (month) {
          month.events = (month.events || []).filter(function (event) {
            return event[1] !== definitions[programKey][0] && event[1] !== definitions[programKey][1];
          });
        });
      });
      [calendarStartDate, program.endDate].forEach(function (value, boundaryIndex) {
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
    ((window.APLS_EVENTS || {}).items || []).filter(function (item) {
      return item.type === "event" && item.status === "published" && item.showOnCalendar && item.startDate;
    }).forEach(function (item) {
      var year = calendarYearForDate(years, item.startDate);
      if (!year) return;
      var start = dateFromValue(item.startDate);
      if (!start) return;
      var monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(start);
      var month = (year.months || []).find(function (candidate) { return candidate.name === monthName; });
      if (!month) {
        month = { name: monthName, events: [] };
        year.months = year.months || [];
        year.months.push(month);
      }
      month.events = (month.events || []).filter(function (event) {
        return !(event[2] && event[2].managedEvent === item.id);
      });
      var dateLabel = programCalendarLabel(item.startDate);
      if (item.endDate && item.endDate !== item.startDate) dateLabel += " - " + programCalendarLabel(item.endDate);
      month.events.push([dateLabel, item.title, {
        startDate: item.startDate,
        endDate: item.endDate || "",
        category: "school-event",
        notes: "Managed from Events & Announcements",
        managedEvent: item.id
      }]);
      month.events.sort(function (left, right) {
        var leftDate = left[2] && left[2].startDate;
        var rightDate = right[2] && right[2].startDate;
        if (leftDate && rightDate) return leftDate.localeCompare(rightDate);
        return 0;
      });
      year.months.sort(function (left, right) { return new Date(left.name + " 1") - new Date(right.name + " 1"); });
    });
    return years;
  }

  function calendarEventCategory(event) {
    var metadata = event[2] || {};
    if (metadata.category) return metadata.category;
    var name = String(event[1] || "");
    if (/childcare/i.test(name)) return "childcare";
    if (/camp/i.test(name)) return "camp";
    if (/school closed|closed for/i.test(name)) return "school-closed";
    if (/^(first|last) day/i.test(name)) return "program-date";
    return "school-event";
  }

  function renderCalendar() {
    var root = document.getElementById("calendar-root");
    if (!root || typeof window.APLS_CALENDAR === "undefined") return;
    var data = window.APLS_CALENDAR;
    var years = calendarWithProgramDates(data.years || []);
    root.innerHTML = "";

    // Printable views are generated directly from the same calendar data.
    if (years.length) {
      root.appendChild(el("h2", null, "Printable calendars"));
      var dl = el("p", "prog-downloads prog-downloads-stack");
      years.forEach(function (y) {
        var a = el("a", null, "Print or save " + y.label);
        a.href = "calendar-print.html?year=" + encodeURIComponent(y.id || "");
        a.target = "_blank";
        a.rel = "noopener";
        dl.appendChild(a);
      });
      root.appendChild(dl);
    }

    // One table per school year
    years.forEach(function (year) {
      var section = el("section", "calendar-year");
      section.dataset.calendarYear = year.id || "";
      var h = el("h2", null, year.label);
      if (year.id) h.id = year.id;
      section.appendChild(h);

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
          var metadata = ev[2] || {};
          tr.className = "calendar-event-row calendar-category-" + calendarEventCategory(ev);
          if (metadata.startDate) tr.dataset.startDate = metadata.startDate;
          if (metadata.endDate) tr.dataset.endDate = metadata.endDate;
          tr.appendChild(el("td", null, ev[0]));
          tr.appendChild(el("td", null, ev[1]));
          tbody.appendChild(tr);
        });
      });
      table.appendChild(tbody);
      section.appendChild(table);
      root.appendChild(section);
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
    renderGallery();
    renderEvents();
  });
})();
