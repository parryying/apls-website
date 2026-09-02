(function (browserWindow, factory) {
  "use strict";

  var analytics = factory();
  var commonJs = typeof module !== "undefined" && module.exports;

  if (commonJs) {
    module.exports = analytics;
  }
  if (browserWindow) {
    browserWindow.APLS_ANALYTICS = analytics;
    if (!commonJs && browserWindow.document) {
      if (browserWindow.document.readyState === "loading") {
        browserWindow.document.addEventListener("DOMContentLoaded", function () {
          analytics.start({
            document: browserWindow.document,
            storage: browserWindow.localStorage,
            window: browserWindow
          });
        }, { once: true });
      } else {
        analytics.start({
          document: browserWindow.document,
          storage: browserWindow.localStorage,
          window: browserWindow
        });
      }
    }
  }
}(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var consentKey = "apls-analytics-consent";
  var measurementId = "G-8D0PYTZKJV";
  var approvedEvents = {
    application_click: true,
    chat_open: true,
    contact_click: true,
    generate_lead: true,
    tour_booking_complete: true,
    tour_booking_widget_view: true,
    tour_cta_click: true,
    virtual_tour_play: true
  };
  var approvedParameters = {
    booking_provider: true,
    contact_method: true,
    link_location: true,
    page_language: true,
    page_path: true,
    program: true
  };

  function eventForLink(link) {
    var href = String(link.href || "");
    var parameters = { link_location: link.location };

    if (/^tel:/i.test(href)) {
      parameters.contact_method = "phone";
      return { eventName: "contact_click", parameters: parameters };
    }
    if (/^mailto:/i.test(href)) {
      parameters.contact_method = "email";
      return { eventName: "contact_click", parameters: parameters };
    }
    if (link.program) {
      parameters.program = link.program;
      return { eventName: "application_click", parameters: parameters };
    }
    if (/(^|\/)tour\.html(?:[?#]|$)/i.test(href)) {
      return { eventName: "tour_cta_click", parameters: parameters };
    }
    return null;
  }

  function registerCalTracking(calApi, trackEvent) {
    var widgetTracked = false;
    var bookingTracked = false;

    calApi("on", {
      action: "linkReady",
      callback: function () {
        if (widgetTracked) return;
        widgetTracked = true;
        trackEvent("tour_booking_widget_view", { booking_provider: "cal_com" });
      }
    });
    calApi("on", {
      action: "bookingSuccessful",
      callback: function () {
        if (bookingTracked) return;
        bookingTracked = true;
        trackEvent("tour_booking_complete", { booking_provider: "cal_com" });
      }
    });
  }

  function linkLocation(anchor) {
    if (anchor.closest(".utility-bar")) return "utility";
    if (anchor.closest(".mobile-nav")) return "mobile_nav";
    if (anchor.closest("header")) return "header";
    if (anchor.closest(".hero, .page-hero")) return "hero";
    if (anchor.closest(".hub-card, .enroll-card, .event-card")) return "card";
    if (anchor.closest(".cta-band")) return "cta_band";
    if (anchor.closest("footer")) return "footer";
    return "body";
  }

  function createConsentController(options) {
    var browserWindow = options.window;
    var documentRef = options.document || (typeof document !== "undefined" ? document : null);
    var storage = options.storage;
    var now = options.now || function () { return new Date(); };
    var tagLoaded = false;

    function loadTag() {
      var script;

      if (tagLoaded) return;
      tagLoaded = true;
      browserWindow.dataLayer = browserWindow.dataLayer || [];
      browserWindow.gtag = browserWindow.gtag || function () {
        browserWindow.dataLayer.push(arguments);
      };
      script = documentRef.createElement("script");
      script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + measurementId;
      documentRef.head.appendChild(script);
      browserWindow.gtag("js", now());
      browserWindow.gtag("config", measurementId, {
        allow_google_signals: true,
        allow_ad_personalization_signals: true
      });
    }

    function savedChoice() {
      var saved;

      try {
        saved = JSON.parse(storage.getItem(consentKey));
      } catch (error) {
        storage.removeItem(consentKey);
        return null;
      }
      if (!saved || !saved.expiresAt || new Date(saved.expiresAt) <= now()) {
        storage.removeItem(consentKey);
        return null;
      }
      return saved.choice;
    }

    function saveChoice(choice) {
      var expiresAt = new Date(now().getTime());

      expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
      storage.setItem(consentKey, JSON.stringify({
        choice: choice,
        expiresAt: expiresAt.toISOString()
      }));
    }

    function acceptAnalytics() {
      saveChoice("granted");
      browserWindow["ga-disable-" + measurementId] = false;
      if (tagLoaded) {
        browserWindow.gtag("consent", "update", {
          ad_personalization: "granted",
          ad_storage: "granted",
          ad_user_data: "granted",
          analytics_storage: "granted"
        });
      }
      loadTag();
    }

    function disableAnalytics() {
      saveChoice("denied");
      browserWindow["ga-disable-" + measurementId] = true;
      if (browserWindow.gtag) {
        browserWindow.gtag("consent", "update", {
          ad_personalization: "denied",
          ad_storage: "denied",
          ad_user_data: "denied",
          analytics_storage: "denied"
        });
      }
    }

    function element(tagName, attributes, text) {
      var item = documentRef.createElement(tagName);

      Object.keys(attributes || {}).forEach(function (name) {
        if (name === "className") item.className = attributes[name];
        else if (name === "id") item.id = attributes[name];
        else item.setAttribute(name, attributes[name]);
      });
      if (text) item.textContent = text;
      return item;
    }

    function mountConsentUi() {
      var currentChoice = savedChoice();
      var banner = element("section", {
        "aria-label": "Analytics choices",
        className: "analytics-consent-banner",
        id: "apls-consent-banner"
      });
      var bannerBody = element("div", { className: "analytics-consent-body" });
      var bannerActions = element("div", { className: "analytics-consent-actions" });
      var privacyLink = element("a", {
        href: "privacy.html",
        id: "apls-privacy-link"
      }, "Privacy notice");
      var acceptButton = element("button", {
        className: "btn btn-primary",
        id: "apls-accept-analytics",
        type: "button"
      }, "Accept analytics");
      var settingsButton = element("button", {
        className: "btn btn-ghost",
        id: "apls-open-cookie-settings",
        type: "button"
      }, "Cookie settings");
      var shortcut = element("button", {
        className: "cookie-settings-link",
        id: "apls-cookie-settings-shortcut",
        type: "button"
      }, "Cookie settings");
      var settings = element("section", {
        "aria-labelledby": "apls-cookie-settings-title",
        "aria-modal": "true",
        className: "cookie-settings-dialog",
        id: "apls-cookie-settings",
        role: "dialog"
      });
      var settingsPanel = element("div", { className: "cookie-settings-panel" });
      var settingsActions = element("div", { className: "analytics-consent-actions" });
      var analyticsToggle = element("input", {
        id: "apls-analytics-toggle",
        type: "checkbox"
      });
      var settingsPrivacyLink = element("a", {
        href: "privacy.html",
        id: "apls-settings-privacy-link"
      }, "Read the Privacy & Cookie Notice");
      var saveButton = element("button", {
        className: "btn btn-primary",
        id: "apls-save-cookie-settings",
        type: "button"
      }, "Save settings");
      var closeButton = element("button", {
        className: "btn btn-ghost",
        id: "apls-close-cookie-settings",
        type: "button"
      }, "Cancel");
      var lastFocused = null;

      if (documentRef.getElementById("apls-consent-banner")) return;
      banner.hidden = !!currentChoice;
      settings.hidden = true;
      analyticsToggle.checked = currentChoice === "granted";

      bannerBody.appendChild(element("h2", {}, "Help us improve the APLS website"));
      bannerBody.appendChild(element("p", {}, "Optional analytics help us understand which pages and enrollment resources families find useful. We do not send names, contact details, or child information to analytics."));
      bannerBody.appendChild(privacyLink);
      bannerActions.appendChild(acceptButton);
      bannerActions.appendChild(settingsButton);
      bannerBody.appendChild(bannerActions);
      banner.appendChild(bannerBody);

      settingsPanel.appendChild(element("h2", { id: "apls-cookie-settings-title" }, "Cookie settings"));
      settingsPanel.appendChild(element("p", {}, "Necessary website features always work. Analytics is optional and stays off unless you allow it."));
      settingsPanel.appendChild(analyticsToggle);
      settingsPanel.appendChild(element("label", { "for": "apls-analytics-toggle" }, "Allow analytics"));
      settingsPanel.appendChild(element("p", { className: "small" }, "When enabled, APLS uses Google Analytics to measure aggregate website activity and campaign performance. You can change this choice later."));
      settingsPanel.appendChild(settingsPrivacyLink);
      settingsActions.appendChild(saveButton);
      settingsActions.appendChild(closeButton);
      settingsPanel.appendChild(settingsActions);
      settings.appendChild(settingsPanel);

      function openSettings() {
        lastFocused = documentRef.activeElement;
        analyticsToggle.checked = savedChoice() === "granted";
        settings.hidden = false;
        closeButton.focus();
      }
      function closeSettings() {
        settings.hidden = true;
        if (lastFocused && lastFocused.focus) lastFocused.focus();
      }
      acceptButton.addEventListener("click", function () {
        acceptAnalytics();
        banner.hidden = true;
      });
      settingsButton.addEventListener("click", openSettings);
      shortcut.addEventListener("click", openSettings);
      closeButton.addEventListener("click", closeSettings);
      documentRef.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !settings.hidden) closeSettings();
      });
      saveButton.addEventListener("click", function () {
        if (analyticsToggle.checked) {
          acceptAnalytics();
        } else {
          disableAnalytics();
        }
        banner.hidden = true;
        closeSettings();
      });

      documentRef.body.appendChild(banner);
      documentRef.body.appendChild(settings);
      documentRef.body.appendChild(shortcut);
    }

    return {
      initialize: function () {
        if (savedChoice() === "granted") loadTag();
      },
      acceptAnalytics: acceptAnalytics,
      disableAnalytics: disableAnalytics,
      trackEvent: function (eventName, parameters) {
        var safeParameters = {};

        if (!approvedEvents[eventName] || savedChoice() !== "granted") return false;
        Object.keys(parameters || {}).forEach(function (key) {
          if (approvedParameters[key]) safeParameters[key] = parameters[key];
        });
        loadTag();
        browserWindow.gtag("event", eventName, safeParameters);
        return true;
      },
      mountConsentUi: mountConsentUi
    };
  }

  function start(options) {
    var browserWindow = options.window;
    var documentRef = options.document;
    var controller = createConsentController(options);
    var virtualTour = documentRef.querySelector && documentRef.querySelector("#virtual-tour video");
    var virtualTourTracked = false;

    controller.initialize();
    controller.mountConsentUi();
    browserWindow.APLS_ANALYTICS.controller = controller;
    browserWindow.APLS_ANALYTICS.trackEvent = controller.trackEvent;

    documentRef.addEventListener("click", function (event) {
      var anchor = event.target.closest && event.target.closest("a[href]");
      var classified;

      if (!anchor) return;
      classified = eventForLink({
        href: anchor.getAttribute("href"),
        location: linkLocation(anchor),
        program: anchor.getAttribute("data-application-program")
      });
      if (!classified) return;
      classified.parameters.page_language = documentRef.documentElement.lang || "en";
      classified.parameters.page_path = browserWindow.location.pathname;
      controller.trackEvent(classified.eventName, classified.parameters);
    });
    if (virtualTour) {
      virtualTour.addEventListener("play", function () {
        if (virtualTourTracked) return;
        virtualTourTracked = true;
        controller.trackEvent("virtual_tour_play", {
          page_language: documentRef.documentElement.lang || "en",
          page_path: browserWindow.location.pathname
        });
      });
    }

    return controller;
  }

  return {
    createConsentController: createConsentController,
    eventForLink: eventForLink,
    registerCalTracking: registerCalTracking,
    start: start
  };
}));