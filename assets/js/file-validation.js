/* ==========================================================================
   FYPilot — file-validation.js (Activity 5, Task 3: Secure File Selection)

   Pure, side-effect-free helpers for client-side file validation, shared
   between the browser (assets/js/dashboard.js) and the Node test suite
   (tests/file-validation.test.js). Keeping the rules here — instead of
   inline inside dashboard.js — means the exact same logic that runs in the
   browser is what gets unit-tested.

   IMPORTANT (per the activity brief): client-side file validation is only an
   initial screening/UX layer. It inspects the file name's extension and the
   browser-reported size — it does NOT look at the file's actual bytes, so it
   cannot guarantee a ".pdf" is really a PDF. A complete application must also
   re-validate (ideally sniffing real file content/MIME type) on the server.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(); // Node (tests)
  } else {
    root.FYPFileValidation = factory(); // Browser
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".zip"];
  var MAX_FILE_SIZE_BYTES = 150 * 1024 * 1024; // 150 MB — matches the dropzone copy

  function getExtension(fileName) {
    var name = String(fileName == null ? "" : fileName);
    var i = name.lastIndexOf(".");
    if (i === -1 || i === name.length - 1) return "";
    return name.slice(i).toLowerCase();
  }

  function prettySize(bytes) {
    bytes = Number(bytes) || 0;
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  /* Validates a { name, size } -like object (a real File, or a plain object
     in tests). Returns { ok: true } or { ok: false, reason: "..." }. */
  function validateFile(file, options) {
    var opts = options || {};
    var allowed = opts.allowedExtensions || ALLOWED_EXTENSIONS;
    var maxSize = typeof opts.maxSizeBytes === "number" ? opts.maxSizeBytes : MAX_FILE_SIZE_BYTES;

    if (!file || !file.name) {
      return { ok: false, reason: "No file selected." };
    }

    var ext = getExtension(file.name);
    if (!ext || allowed.indexOf(ext) === -1) {
      return {
        ok: false,
        reason: "Unsupported file type" + (ext ? " (" + ext + ")" : " — missing extension") +
          ". Allowed types: " + allowed.join(", ") + "."
      };
    }

    var size = Number(file.size) || 0;
    if (size <= 0) {
      return { ok: false, reason: "The selected file appears to be empty (0 bytes)." };
    }
    if (size > maxSize) {
      return {
        ok: false,
        reason: "File is too large (" + prettySize(size) + "). Maximum allowed size is " +
          prettySize(maxSize) + "."
      };
    }

    return { ok: true };
  }

  return {
    ALLOWED_EXTENSIONS: ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE_BYTES: MAX_FILE_SIZE_BYTES,
    getExtension: getExtension,
    prettySize: prettySize,
    validateFile: validateFile
  };
});
