// Local dev default. In Docker this file is regenerated at container
// startup (see docker/generate-env.sh) from the API_URL env var, so the
// backend URL can change without rebuilding the image.
(function (window) {
  window.__env = window.__env || {};
  window.__env.apiUrl = 'http://localhost:8080/api';
})(this);
