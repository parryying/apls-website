(function () {
  "use strict";

  var CATEGORY_LABELS = {
    "school-event": "School event",
    "school-closed": "School closed",
    childcare: "Childcare",
    camp: "Camp",
    "program-date": "Program date"
  };

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function monthCards(yearSection) {
    var cards = [];
    var currentCard = null;
    yearSection.querySelectorAll("tbody tr").forEach(function (row) {
      var monthHeading = row.querySelector(".cal-month");
      if (monthHeading) {
        currentCard = element("article", "print-month");
        currentCard.appendChild(element("h2", "print-month-title", monthHeading.textContent));
        currentCard.appendChild(element("div", "print-month-events"));
        cards.push(currentCard);
        return;
      }
      if (!currentCard) return;
      var cells = row.querySelectorAll("td");
      if (cells.length < 2) return;
      var eventRow = element("div", "print-event " + row.className);
      eventRow.appendChild(element("span", "print-event-date", cells[0].textContent));
      eventRow.appendChild(element("span", "print-event-name", cells[1].textContent));
      currentCard.querySelector(".print-month-events").appendChild(eventRow);
    });
    return cards;
  }

  function legendFor(cards) {
    var used = {};
    cards.forEach(function (card) {
      card.querySelectorAll(".print-event").forEach(function (eventRow) {
        Object.keys(CATEGORY_LABELS).forEach(function (category) {
          if (eventRow.classList.contains("calendar-category-" + category)) used[category] = true;
        });
      });
    });
    var legend = element("div", "print-legend");
    Object.keys(CATEGORY_LABELS).forEach(function (category) {
      if (!used[category]) return;
      legend.appendChild(element("span", "legend-item calendar-category-" + category, CATEGORY_LABELS[category]));
    });
    return legend;
  }

  function pageHeader(yearLabel, pageIndex) {
    var header = element("header", "print-page-header");
    var brand = element("div", "print-brand");
    var logo = element("img");
    logo.src = "images/apls-logo.png";
    logo.alt = "";
    brand.appendChild(logo);
    var brandCopy = element("div");
    brandCopy.appendChild(element("strong", "", "Asia Pacific Language School"));
    brandCopy.appendChild(element("span", "", "Chinese & Japanese | Bellevue, Washington"));
    brand.appendChild(brandCopy);
    header.appendChild(brand);
    var title = element("div", "print-title");
    title.appendChild(element("p", "", pageIndex ? "School calendar | continued" : "Printable school calendar"));
    title.appendChild(element("h1", "", yearLabel));
    header.appendChild(title);
    return header;
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
    var cards = monthCards(yearSection);
    var firstPageCount = Math.ceil(cards.length / 2);
    var pageGroups = cards.length > 6 ? [cards.slice(0, firstPageCount), cards.slice(firstPageCount)] : [cards];
    var footnote = (window.APLS_CALENDAR || {}).footnote || "";
    documentRoot.innerHTML = "";

    pageGroups.forEach(function (pageCards, pageIndex) {
      var sheet = element("section", "print-sheet");
      sheet.appendChild(pageHeader(yearLabel, pageIndex));
      var grid = element("div", "print-month-grid");
      pageCards.forEach(function (card) { grid.appendChild(card); });
      sheet.appendChild(grid);
      var footer = element("footer", "print-page-footer");
      var footerCopy = element("div");
      if (footnote) footerCopy.appendChild(element("p", "", footnote));
      footerCopy.appendChild(legendFor(pageCards));
      footer.appendChild(footerCopy);
      footer.appendChild(element("span", "print-page-number", "Page " + (pageIndex + 1) + " of " + pageGroups.length));
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