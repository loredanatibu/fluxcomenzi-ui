import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

interface WindowWithEnv extends Window {
  __env?: { apiUrl?: string };
}

// Resolves the backend base URL at runtime from window.__env (populated by
// src/assets/env.js, which the Docker image regenerates from the API_URL
// env var on container start — see docker/generate-env.sh). Falls back to
// the build-time environment.ts value for `ng serve` / when no override
// is present.
@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  get apiUrl(): string {
    const win = window as WindowWithEnv;
    return win.__env?.apiUrl || environment.apiUrl;
  }
}
