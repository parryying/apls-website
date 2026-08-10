(function () {
  "use strict";

  function initProgramFilters() {
    var filterGroup = document.querySelector(".program-filters");
    var cards = Array.prototype.slice.call(document.querySelectorAll(".hub-card[data-groups]"));
    var status = document.getElementById("filter-status");
    if (!filterGroup || !cards.length) return;

    filterGroup.addEventListener("click", function (event) {
      var button = event.target.closest(".program-filter");
      if (!button) return;

      var selected = button.getAttribute("data-filter");
      var visibleCount = 0;

      filterGroup.querySelectorAll(".program-filter").forEach(function (filterButton) {
        var isActive = filterButton === button;
        filterButton.classList.toggle("is-active", isActive);
        filterButton.setAttribute("aria-pressed", String(isActive));
      });

      cards.forEach(function (card) {
        var groups = (card.getAttribute("data-groups") || "").split(" ");
        var isVisible = selected === "all" || groups.indexOf(selected) !== -1;
        card.hidden = !isVisible;
        if (isVisible) visibleCount += 1;
      });

      if (status) {
        status.textContent = visibleCount + (visibleCount === 1 ? " program shown" : " programs shown");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProgramFilters);
  } else {
    initProgramFilters();
  }
})();
