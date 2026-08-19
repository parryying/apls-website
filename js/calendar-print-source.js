(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  if (params.get("draft") !== "1") return;

  try {
    var prefix = "APLS_CALENDAR_DRAFT:";
    var windowPayload = window.name.indexOf(prefix) === 0 ? window.name.slice(prefix.length) : "";
    var payload = JSON.parse(windowPayload || localStorage.getItem("apls-calendar-print-preview-v1") || "null");
    if (!payload || !payload.calendar) return;
    if (windowPayload) window.name = "";
    window.APLS_CALENDAR = payload.calendar;
    if (payload.tuition) window.APLS_TUITION = payload.tuition;
    if (payload.events) window.APLS_EVENTS = payload.events;
    document.documentElement.classList.add("is-draft-print");
  } catch (error) {
    document.documentElement.classList.add("print-source-error");
  }
})();