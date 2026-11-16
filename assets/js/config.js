/* Deployment configuration - the ONLY place the backend URL is set.
   - Local development (localhost / 127.0.0.1): talks to the Flask server on port 5000.
   - Deployed (e.g. Vercel): talks to the Render backend.
   After creating your Render service, replace the URL below with your real one
   (keep the trailing /api). */
(function () {
  var host = window.location.hostname;
  var isLocal = host === "localhost" || host === "127.0.0.1" || host === "";
  window.FYP_CONFIG = {
    API_BASE: isLocal
      ? "http://localhost:5000/api"
      : "https://fypilot-backend.onrender.com/api"
  };
})();
