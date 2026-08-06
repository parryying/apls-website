(function () {
  "use strict";

  function initMobileNav() {
    var toggle = document.querySelector(".nav-toggle");
    if (!toggle) return;

    var navId = toggle.getAttribute("aria-controls");
    var nav = navId ? document.getElementById(navId) : null;
    if (!nav) return;
    var openLabel = toggle.getAttribute("data-open-label") || "Open menu";
    var closeLabel = toggle.getAttribute("data-close-label") || "Close menu";

    function setOpen(isOpen) {
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? closeLabel : openLabel);
      nav.classList.toggle("is-open", isOpen);
    }

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });

    window.matchMedia("(min-width: 1101px)").addEventListener("change", function (event) {
      if (event.matches) setOpen(false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMobileNav);
  } else {
    initMobileNav();
  }
})();
