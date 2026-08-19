import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Attaches the bearer token to every request except the login call itself
// (which is the only endpoint SecurityConfig permits without one).
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  if (req.url.includes('/auth/login')) {
    return next(req);
  }

  const token = authService.getToken();
  if (!token) {
    return next(req);
  }

  // Check expiry up front so an expired token never goes out over the wire
  // -- it would just be rejected with 401 anyway.
  if (authService.isTokenExpired(token)) {
    authService.notifySessionExpired();
    return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Session expired' }));
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  ).pipe(
    catchError((error: unknown) => {
      // Covers the case where the token looked valid client-side but the
      // backend rejected it anyway (revoked, clock skew, wrong secret, ...).
      if (error instanceof HttpErrorResponse && error.status === 401) {
        authService.notifySessionExpired();
      }
      return throwError(() => error);
    }),
  );
};
