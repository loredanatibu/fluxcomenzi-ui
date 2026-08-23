import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { LoginRequest, TokenResponse } from '../models/auth.model';

const TOKEN_KEY = 'fluxcomenzi_token';
const EMAIL_KEY = 'fluxcomenzi_email';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly emailSignal = signal<string | null>(localStorage.getItem(EMAIL_KEY));
  private readonly loginErrorSignal = signal<string | null>(null);
  private readonly sessionExpiredSignal = signal(false);

  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);
  readonly currentEmail = computed(() => this.emailSignal());
  readonly loginError = this.loginErrorSignal.asReadonly();
  readonly sessionExpired = this.sessionExpiredSignal.asReadonly();

  constructor(
    private readonly http: HttpClient,
    private readonly config: RuntimeConfigService,
    private readonly router: Router,
  ) {}

  login(email: string, password: string): Observable<TokenResponse> {
    const body: LoginRequest = { email, password };
    return this.http.post<TokenResponse>(`${this.config.apiUrl}/auth/login`, body).pipe(
      tap((response) => {
        localStorage.setItem(TOKEN_KEY, response.token);
        localStorage.setItem(EMAIL_KEY, email);
        this.tokenSignal.set(response.token);
        this.emailSignal.set(email);
        this.loginErrorSignal.set(null);
      }),
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    this.tokenSignal.set(null);
    this.emailSignal.set(null);
    this.router.navigate(['/']);
  }

  reportLoginError(message: string | null): void {
    this.loginErrorSignal.set(message);
  }

  getToken(): string | null {
    return this.tokenSignal();
  }

  // Reads the JWT's exp claim without validating the signature (the backend
  // is the source of truth; this is just a client-side hint to avoid
  // sending requests that are certain to be rejected).
  isTokenExpired(token: string): boolean {
    const payload = decodeJwtPayload(token);
    return payload?.exp === undefined || Date.now() >= payload.exp * 1000;
  }

  // Called by the auth interceptor when a request is rejected with 401 (or
  // would be, per the client-side expiry check below). A 401 here isn't
  // necessarily an actually-expired session -- it can just as easily be a
  // backend bug -- so this shows a generic error dialog rather than forcing
  // a re-login. The user stays "logged in" on screen until they close it.
  notifySessionExpired(): void {
    if (this.tokenSignal() === null) {
      return;
    }
    this.sessionExpiredSignal.set(true);
  }

  // Called on every user interaction (see AppComponent), not just when a
  // backend call happens -- so an expired session is caught immediately,
  // even if the user's next action wouldn't itself have hit the API.
  checkTokenExpiry(): void {
    const token = this.tokenSignal();
    if (token && this.isTokenExpired(token)) {
      this.notifySessionExpired();
    }
  }

  // Just dismisses the dialog -- doesn't log the user out, since a 401 here
  // isn't reliably a real session expiry (see notifySessionExpired).
  acknowledgeSessionExpired(): void {
    this.sessionExpiredSignal.set(false);
  }
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  const [, payload] = token.split('.');
  if (!payload) {
    return null;
  }
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}
