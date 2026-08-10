(function () {
  "use strict";

  function removeExpiredBadges() {
    document.querySelectorAll("[data-enrollment-end]").forEach(function (badge) {
      var parts = badge.getAttribute("data-enrollment-end").split("-").map(Number);
      if (parts.length !== 3 || parts.some(function (part) { return !part; })) return;

      var expires = new Date(parts[0], parts[1] - 1, parts[2] + 1);
      if (new Date() >= expires) badge.remove();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", removeExpiredBadges);
  } else {
    removeExpiredBadges();
  }
})();