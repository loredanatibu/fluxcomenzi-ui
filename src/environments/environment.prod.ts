// Fallback only: in the Docker image, src/assets/env.js is regenerated at
// container startup from the API_URL env var and takes priority. See
// RuntimeConfigService and docker/generate-env.sh.
export const environment = {
  production: true,
  apiUrl: 'http://localhost:8080/api',
};
