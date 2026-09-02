"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var test = require("node:test");
var vm = require("node:vm");

var analyticsPath = path.resolve(__dirname, "..", "js", "analytics.js");

function loadAnalytics() {
  var appendedScripts = [];
  var values = new Map();
  var elements = new Map();
  var document = createTestDocument(appendedScripts, elements);
  var browserWindow = {
    dataLayer: [],
    document: document,
    localStorage: {
      getItem: function (key) { return values.has(key) ? values.get(key) : null; },
      setItem: function (key, value) { values.set(key, value); },
      removeItem: function (key) { values.delete(key); }
    }
  };
  var source = fs.existsSync(analyticsPath) ? fs.readFileSync(analyticsPath, "utf8") : "";

  vm.runInNewContext(source, {
    Date: Date,
    document: document,
    module: { exports: {} },
    window: browserWindow
  });

  return {
    api: browserWindow.APLS_ANALYTICS,
    browserWindow: browserWindow,
    appendedScripts: appendedScripts,
    document: document,
    elements: elements,
    values: values
  };
}

function createTestDocument(appendedScripts, elements) {
  var documentListeners = {};
  var documentRef;

  function createElement(tagName) {
    var listeners = {};
    var element = {
      children: [],
      hidden: false,
      tagName: tagName.toUpperCase(),
      appendChild: function (child) {
        this.children.push(child);
        child.parentNode = this;
        if (child.id) elements.set(child.id, child);
        return child;
      },
      addEventListener: function (type, listener) { listeners[type] = listener; },
      click: function () {
        this.focus();
        if (listeners.click) listeners.click({ preventDefault: function () {} });
      },
      focus: function () { documentRef.activeElement = this; },
      setAttribute: function (name, value) { this[name] = value; }
    };
    return element;
  }

  documentRef = {
    activeElement: null,
    body: createElement("body"),
    createElement: createElement,
    documentElement: { lang: "en" },
    addEventListener: function (type, listener) { documentListeners[type] = listener; },
    dispatch: function (type, event) { documentListeners[type](event); },
    getElementById: function (id) { return elements.get(id) || null; },
    head: {
      appendChild: function (script) { appendedScripts.push(script); }
    }
  };
  return documentRef;
}

test("loads the GA4 script only after analytics consent and remembers the choice", function () {
  var harness = loadAnalytics();

  assert.equal(typeof (harness.api && harness.api.createConsentController), "function");

  var controller = harness.api.createConsentController({
    document: harness.browserWindow.document,
    storage: harness.browserWindow.localStorage,
    window: harness.browserWindow,
    now: function () { return new Date("2026-09-02T12:00:00-07:00"); }
  });

  controller.initialize();
  assert.equal(harness.appendedScripts.length, 0);

  controller.acceptAnalytics();
  controller.acceptAnalytics();

  assert.equal(harness.appendedScripts.length, 1);
  assert.equal(harness.appendedScripts[0].src, "https://www.googletagmanager.com/gtag/js?id=G-8D0PYTZKJV");
  var configCall = harness.browserWindow.dataLayer.map(function (entry) {
    return Array.from(entry);
  }).find(function (entry) {
    return entry[0] === "config";
  });
  assert.equal(configCall[1], "G-8D0PYTZKJV");
  assert.ok(configCall[2], "GA4 config includes explicit post-consent options");
  assert.equal(configCall[2].allow_google_signals, true);
  assert.equal(configCall[2].allow_ad_personalization_signals, true);
  assert.deepEqual(JSON.parse(harness.values.get("apls-analytics-consent")), {
    choice: "granted",
    expiresAt: "2027-09-02T19:00:00.000Z"
  });
});

test("keeps GA4 unloaded when analytics is turned off", function () {
  var harness = loadAnalytics();
  var controller = harness.api.createConsentController({
    storage: harness.browserWindow.localStorage,
    window: harness.browserWindow,
    now: function () { return new Date("2026-09-02T12:00:00-07:00"); }
  });

  assert.equal(typeof controller.disableAnalytics, "function");

  controller.disableAnalytics();
  controller.initialize();

  assert.equal(harness.appendedScripts.length, 0);
  assert.equal(JSON.parse(harness.values.get("apls-analytics-consent")).choice, "denied");
});

test("stops GA4 immediately when a visitor changes an accepted choice to off", function () {
  var harness = loadAnalytics();
  var controller = harness.api.createConsentController({
    storage: harness.browserWindow.localStorage,
    window: harness.browserWindow,
    now: function () { return new Date("2026-09-02T12:00:00-07:00"); }
  });

  controller.acceptAnalytics();
  controller.disableAnalytics();

  assert.equal(harness.browserWindow["ga-disable-G-8D0PYTZKJV"], true);
  assert.equal(controller.trackEvent("contact_click", { contact_method: "phone" }), false);
  var consentUpdate = harness.browserWindow.dataLayer.map(function (entry) {
    return Array.from(entry);
  }).find(function (entry) {
    return entry[0] === "consent" && entry[1] === "update";
  });
  assert.deepEqual(normalize(consentUpdate[2]), {
    ad_personalization: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    analytics_storage: "denied"
  });
});

test("discards an expired analytics grant", function () {
  var harness = loadAnalytics();
  var controller = harness.api.createConsentController({
    storage: harness.browserWindow.localStorage,
    window: harness.browserWindow,
    now: function () { return new Date("2026-09-02T12:00:00-07:00"); }
  });

  harness.values.set("apls-analytics-consent", JSON.stringify({
    choice: "granted",
    expiresAt: "2026-09-01T19:00:00.000Z"
  }));

  controller.initialize();

  assert.equal(harness.appendedScripts.length, 0);
  assert.equal(harness.values.has("apls-analytics-consent"), false);
});

test("emits only approved event names and non-identifying parameters after consent", function () {
  var harness = loadAnalytics();
  var controller = harness.api.createConsentController({
    storage: harness.browserWindow.localStorage,
    window: harness.browserWindow,
    now: function () { return new Date("2026-09-02T12:00:00-07:00"); }
  });

  assert.equal(typeof controller.trackEvent, "function");

  assert.equal(controller.trackEvent("contact_click", { contact_method: "phone" }), false);
  controller.acceptAnalytics();
  assert.equal(controller.trackEvent("unknown_event", { page_path: "/contact.html" }), false);
  assert.equal(controller.trackEvent("contact_click", {
    page_path: "/contact.html",
    contact_method: "phone",
    link_location: "body",
    phone_number: "+1-425-747-4172",
    question_text: "Please call about my child"
  }), true);

  var eventCalls = harness.browserWindow.dataLayer.map(function (entry) {
    return Array.from(entry);
  }).filter(function (entry) {
    return entry[0] === "event";
  });

  assert.equal(eventCalls.length, 1);
  assert.equal(eventCalls[0][1], "contact_click");
  assert.deepEqual(Object.assign({}, eventCalls[0][2]), {
    page_path: "/contact.html",
    contact_method: "phone",
    link_location: "body"
  });
});

test("classifies conversion links without copying contact values or visible text", function () {
  assert.deepEqual(normalize(harnesslessLinkEvent({
    href: "tel:+14257474172",
    location: "footer"
  })), {
    eventName: "contact_click",
    parameters: { contact_method: "phone", link_location: "footer" }
  });
  assert.deepEqual(normalize(harnesslessLinkEvent({
    href: "pdfs/Preschool-Application.pdf",
    location: "body",
    program: "preschool"
  })), {
    eventName: "application_click",
    parameters: { program: "preschool", link_location: "body" }
  });
  assert.deepEqual(normalize(harnesslessLinkEvent({
    href: "tour.html",
    location: "header"
  })), {
    eventName: "tour_cta_click",
    parameters: { link_location: "header" }
  });
  assert.equal(harnesslessLinkEvent({ href: "programs.html", location: "header" }), null);
});

function harnesslessLinkEvent(link) {
  var harness = loadAnalytics();

  assert.equal(typeof harness.api.eventForLink, "function");
  return harness.api.eventForLink(link);
}

function normalize(value) {
  return JSON.parse(JSON.stringify(value));
}

test("offers Accept analytics and Cookie settings while keeping analytics off available in settings", function () {
  var harness = loadAnalytics();
  var controller = harness.api.createConsentController({
    document: harness.document,
    storage: harness.browserWindow.localStorage,
    window: harness.browserWindow,
    now: function () { return new Date("2026-09-02T12:00:00-07:00"); }
  });

  assert.equal(typeof controller.mountConsentUi, "function");
  controller.mountConsentUi();

  assert.equal(harness.elements.get("apls-consent-banner").hidden, false);
  assert.equal(harness.elements.get("apls-cookie-settings").hidden, true);
  assert.equal(harness.elements.has("apls-necessary-only"), false);
  assert.ok(harness.elements.get("apls-privacy-link"), "banner includes the privacy notice link");
  assert.equal(harness.elements.get("apls-privacy-link").href, "privacy.html");
  assert.ok(harness.elements.get("apls-settings-privacy-link"), "settings includes the privacy notice link");
  assert.equal(harness.elements.get("apls-settings-privacy-link").href, "privacy.html");

  harness.elements.get("apls-open-cookie-settings").click();
  assert.equal(harness.elements.get("apls-cookie-settings").hidden, false);
  assert.ok(harness.document.activeElement, "opening settings moves keyboard focus");
  assert.equal(harness.document.activeElement.id, "apls-close-cookie-settings");
  harness.document.dispatch("keydown", { key: "Escape" });
  assert.equal(harness.elements.get("apls-cookie-settings").hidden, true);
  assert.equal(harness.document.activeElement.id, "apls-open-cookie-settings");
  harness.elements.get("apls-open-cookie-settings").click();
  harness.elements.get("apls-save-cookie-settings").click();

  assert.equal(harness.elements.get("apls-consent-banner").hidden, true);
  assert.equal(harness.elements.get("apls-cookie-settings").hidden, true);
  assert.equal(harness.appendedScripts.length, 0);
  assert.equal(JSON.parse(harness.values.get("apls-analytics-consent")).choice, "denied");
});

test("maps Cal.com lifecycle callbacks to payload-free analytics events", function () {
  var harness = loadAnalytics();
  var registrations = [];
  var tracked = [];

  assert.equal(typeof harness.api.registerCalTracking, "function");
  harness.api.registerCalTracking(function (command, options) {
    registrations.push({ command: command, options: options });
  }, function (eventName, parameters) {
    tracked.push({ eventName: eventName, parameters: parameters });
  });

  assert.deepEqual(registrations.map(function (entry) {
    return entry.options.action;
  }), ["linkReady", "bookingSuccessful"]);

  registrations[0].options.callback({ detail: { data: { email: "family@example.com" } } });
  registrations[1].options.callback({ detail: { data: { email: "family@example.com" } } });

  assert.deepEqual(normalize(tracked), [
    { eventName: "tour_booking_widget_view", parameters: { booking_provider: "cal_com" } },
    { eventName: "tour_booking_complete", parameters: { booking_provider: "cal_com" } }
  ]);
});

test("browser startup tracks dynamically rendered conversion links through one delegated listener", function () {
  var harness = loadAnalytics();
  harness.browserWindow.location = { pathname: "/contact.html" };

  assert.equal(typeof harness.api.start, "function");
  var controller = harness.api.start({
    document: harness.document,
    storage: harness.browserWindow.localStorage,
    window: harness.browserWindow,
    now: function () { return new Date("2026-09-02T12:00:00-07:00"); }
  });
  controller.acceptAnalytics();

  var anchor = {
    getAttribute: function (name) { return name === "href" ? "tel:+14257474172" : null; },
    closest: function (selector) {
      if (selector === "a[href]") return this;
      if (selector === "footer") return {};
      return null;
    }
  };
  harness.document.dispatch("click", { target: anchor });

  var eventCalls = harness.browserWindow.dataLayer.map(function (entry) {
    return Array.from(entry);
  }).filter(function (entry) {
    return entry[0] === "event";
  });

  assert.equal(eventCalls.length, 1);
  assert.deepEqual(normalize(eventCalls[0]), ["event", "contact_click", {
    contact_method: "phone",
    link_location: "footer",
    page_language: "en",
    page_path: "/contact.html"
  }]);
});

test("tracks the first virtual tour play without sending the media URL", function () {
  var harness = loadAnalytics();
  var playListener;
  var video = {
    addEventListener: function (type, listener) {
      if (type === "play") playListener = listener;
    }
  };
  harness.browserWindow.location = { pathname: "/tour.html" };
  harness.document.querySelector = function (selector) {
    return selector === "#virtual-tour video" ? video : null;
  };

  var controller = harness.api.start({
    document: harness.document,
    storage: harness.browserWindow.localStorage,
    window: harness.browserWindow,
    now: function () { return new Date("2026-09-02T12:00:00-07:00"); }
  });
  controller.acceptAnalytics();

  assert.equal(typeof playListener, "function");
  playListener();
  playListener();

  var eventCalls = harness.browserWindow.dataLayer.map(function (entry) {
    return Array.from(entry);
  }).filter(function (entry) {
    return entry[0] === "event";
  });
  assert.deepEqual(normalize(eventCalls), [["event", "virtual_tour_play", {
    page_language: "en",
    page_path: "/tour.html"
  }]]);
});