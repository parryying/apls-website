(function (root) {
  "use strict";

  var meta = document.querySelector('meta[name="apls-cms-api"]');
  var configuredBase = meta && String(meta.content || "").replace(/\/$/, "");
  var privateBuild = root.APLS_CMS_BUILD && root.APLS_CMS_BUILD.sourceSha;
  var enabled = /^https?:$/.test(location.protocol) && Boolean(configuredBase || privateBuild);
  var base = configuredBase || (enabled ? location.origin : "");

  function request(path, options) {
    options = options || {};
    options.credentials = "include";
    options.headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    return fetch(base + path, options).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok) {
          var error = new Error(payload.error || "Cloud Content Studio request failed.");
          error.status = response.status;
          error.payload = payload;
          throw error;
        }
        return payload;
      });
    });
  }

  root.APLS_CMS_CLOUD = {
    enabled: enabled,
    load: function () { return request("/api/content"); },
    saveDraft: function (payload) {
      return request("/api/draft", { method: "PUT", body: JSON.stringify(payload) });
    },
    discardDraft: function () { return request("/api/draft", { method: "DELETE" }); },
    submit: function (payload) {
      return request("/api/submissions", { method: "POST", body: JSON.stringify(payload) });
    },
    status: function () { return request("/api/submissions/current"); }
  };
})(window);