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

  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);
  readonly currentEmail = computed(() => this.emailSignal());
  readonly loginError = this.loginErrorSignal.asReadonly();

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
}
