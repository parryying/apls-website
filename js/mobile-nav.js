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
    var mobileQuery = window.matchMedia("(max-width: 1220px)");
    var groups = Array.prototype.slice.call(nav.querySelectorAll(".nav-programs"));

    function setSubmenuOpen(group, isOpen) {
      var link = group.querySelector(":scope > a");
      group.classList.toggle("is-open", isOpen);
      if (link) link.setAttribute("aria-expanded", String(isOpen));
    }

    function closeSubmenus(except) {
      groups.forEach(function (group) {
        if (group !== except) setSubmenuOpen(group, false);
      });
    }

    groups.forEach(function (group, index) {
      var link = group.querySelector(":scope > a");
      var submenu = group.querySelector(":scope > .submenu");
      if (!link || !submenu) return;

      if (!submenu.id) submenu.id = "site-nav-submenu-" + index;
      link.setAttribute("aria-haspopup", "true");
      link.setAttribute("aria-controls", submenu.id);
      link.setAttribute("aria-expanded", "false");

      var overview = document.createElement("a");
      overview.className = "submenu-overview";
      overview.href = link.href;
      overview.textContent = link.textContent.trim() === "Programs" ? "All Programs" : "Enrollment Overview";
      submenu.insertBefore(overview, submenu.firstChild);

      link.addEventListener("click", function (event) {
        if (!mobileQuery.matches) return;
        event.preventDefault();
        var shouldOpen = !group.classList.contains("is-open");
        closeSubmenus(group);
        setSubmenuOpen(group, shouldOpen);
      });
    });

    function setOpen(isOpen) {
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? closeLabel : openLabel);
      nav.classList.toggle("is-open", isOpen);
      if (!isOpen) {
        closeSubmenus();
      } else {
        var currentGroup = groups.find(function (group) {
          return group.querySelector('[aria-current="page"]');
        });
        if (currentGroup) setSubmenuOpen(currentGroup, true);
      }
    }

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    nav.addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (!link) return;
      if (mobileQuery.matches && link.parentElement && link.parentElement.classList.contains("nav-programs")) return;
      setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });

    mobileQuery.addEventListener("change", function (event) {
      setOpen(false);
      if (!event.matches) closeSubmenus();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMobileNav);
  } else {
    initMobileNav();
  }
})();
