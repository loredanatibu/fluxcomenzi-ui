#!/bin/sh
# Runs automatically on container start (nginx official image executes every
# executable script in /docker-entrypoint.d/ before starting nginx). Lets
# API_URL be set per-environment via `docker run -e` / docker-compose.yml
# without rebuilding the image.
set -eu

API_URL="${API_URL:-http://localhost:8080/api}"

cat <<EOF > /usr/share/nginx/html/assets/env.js
(function (window) {
  window.__env = window.__env || {};
  window.__env.apiUrl = "${API_URL}";
})(this);
EOF
