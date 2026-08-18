(function () {
  "use strict";

  var dialog = document.querySelector("[data-open-house-dialog]");
  if (!dialog) return;

  var storageKey = "apls-open-house-2026-dismissed";
  var expiresAt = new Date("2026-08-23T00:00:00-07:00").getTime();

  function wasDismissed() {
    try {
      return window.localStorage.getItem(storageKey) === "true";
    } catch (error) {
      return false;
    }
  }

  function rememberDismissal() {
    try {
      window.localStorage.setItem(storageKey, "true");
    } catch (error) {
      // The popup can still be dismissed when storage is unavailable.
    }
  }

  function closePopup() {
    rememberDismissal();
    document.body.classList.remove("open-house-popup-open");
    if (dialog.open) dialog.close();
  }

  if (Date.now() >= expiresAt || wasDismissed()) {
    dialog.remove();
    return;
  }

  dialog.querySelector("[data-open-house-close]").addEventListener("click", closePopup);
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) closePopup();
  });
  dialog.addEventListener("cancel", function (event) {
    event.preventDefault();
    closePopup();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && dialog.open) {
      event.preventDefault();
      closePopup();
    }
  });
  dialog.addEventListener("close", function () {
    document.body.classList.remove("open-house-popup-open");
  });

  document.body.classList.add("open-house-popup-open");
  dialog.showModal();
})();