(function () {
  "use strict";

  function scrollToTarget(target, behavior) {
    target.scrollIntoView({ behavior: behavior, block: "start" });
  }

  function initProgramJumpLinks() {
    var links = document.querySelectorAll(".program-jumpbar a[href^='#']");
    if (!links.length) return;
    var behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        var targetId = link.getAttribute("href").slice(1);
        var target = document.getElementById(targetId);
        if (!target) return;

        event.preventDefault();
        window.history.pushState(null, "", "#" + targetId);
        scrollToTarget(target, behavior);
      });
    });

    if (window.location.hash) {
      var initialTarget = document.getElementById(window.location.hash.slice(1));
      if (initialTarget) {
        window.requestAnimationFrame(function () {
          scrollToTarget(initialTarget, "auto");
        });
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProgramJumpLinks);
  } else {
    initProgramJumpLinks();
  }
})();