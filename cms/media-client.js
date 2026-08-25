(function (root) {
  "use strict";

  var DATABASE = "apls-cms-media-v1";
  var STORE = "pending";
  var MAX_SOURCE_BYTES = 10 * 1024 * 1024;
  var MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
  var LARGE_DOCUMENT_BYTES = 5 * 1024 * 1024;
  var MAX_EDGE = 2000;
  var TARGET_BYTES = 500 * 1024;
  var HARD_LIMIT = 1024 * 1024;
  var acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

  function database() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = function () {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "path" });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function transaction(mode, operation) {
    return database().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var request = operation(tx.objectStore(STORE));
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error); };
        tx.oncomplete = function () { db.close(); };
      });
    });
  }

  function canvasBlob(canvas, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error("This browser could not create the optimized image."));
      }, "image/webp", quality);
    });
  }

  function slug(value) {
    return String(value || "image").toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "image";
  }

  function uniquePath(fileName) {
    var bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    var suffix = Array.from(bytes).map(function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
    return "images/uploads/" + new Date().getFullYear() + "/" + slug(fileName) + "-" + suffix + ".webp";
  }

  function uniqueDocumentPath(fileName) {
    var bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    var suffix = Array.from(bytes).map(function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
    return "pdfs/uploads/" + new Date().getFullYear() + "/" + slug(fileName) + "-" + suffix + ".pdf";
  }

  // A renamed or mistyped file can still claim to be a PDF, so trust the bytes, not the type.
  async function looksLikePdf(file) {
    var head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    return head.length === 5 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d;
  }

  async function processDocument(file) {
    if (file.type && file.type !== "application/pdf") throw new Error("Choose a PDF file.");
    if (file.size > MAX_DOCUMENT_BYTES) throw new Error("The PDF must be 10 MB or smaller. Ask your website manager to compress it.");
    if (!(await looksLikePdf(file))) throw new Error("That file is not a PDF. Open it and use Save as PDF, then try again.");
    return {
      path: uniqueDocumentPath(file.name),
      blob: file,
      size: file.size,
      type: "application/pdf",
      large: file.size > LARGE_DOCUMENT_BYTES,
      originalName: file.name,
      updatedAt: new Date().toISOString()
    };
  }

  async function process(file) {
    if (!acceptedTypes.has(file.type)) throw new Error("Choose a JPEG, PNG, or WebP image. SVG files are not accepted.");
    if (file.size > MAX_SOURCE_BYTES) throw new Error("The original image must be 10 MB or smaller.");
    var bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    var scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    var width = Math.max(1, Math.round(bitmap.width * scale));
    var height = Math.max(1, Math.round(bitmap.height * scale));
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var context = canvas.getContext("2d", { alpha: false });
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    var qualities = [0.84, 0.76, 0.68, 0.6, 0.52];
    var blob;
    for (var index = 0; index < qualities.length; index += 1) {
      blob = await canvasBlob(canvas, qualities[index]);
      if (blob.size <= TARGET_BYTES) break;
    }
    if (!blob || blob.size > HARD_LIMIT) throw new Error("The optimized image is still over 1 MB. Choose a smaller or simpler image.");
    return {
      path: uniquePath(file.name),
      blob: blob,
      width: width,
      height: height,
      size: blob.size,
      type: "image/webp",
      originalName: file.name,
      updatedAt: new Date().toISOString()
    };
  }

  root.APLS_CMS_MEDIA = {
    enabled: typeof indexedDB !== "undefined" && typeof createImageBitmap === "function",
    process: process,
    processDocument: processDocument,
    save: function (record) { return transaction("readwrite", function (store) { return store.put(record); }); },
    list: function () { return transaction("readonly", function (store) { return store.getAll(); }); },
    remove: function (path) { return transaction("readwrite", function (store) { return store.delete(path); }); },
    clear: function () { return transaction("readwrite", function (store) { return store.clear(); }); }
  };
})(window);