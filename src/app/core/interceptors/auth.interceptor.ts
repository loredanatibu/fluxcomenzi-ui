import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
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

  // A 401 coming back from the backend is left to the calling component's
  // own error handling (it shows a message) rather than treated here as
  // proof the session expired -- the client-side expiry check above is the
  // only thing allowed to force a logout/redirect. A backend 401 can also
  // mean a misconfigured/misspelled endpoint or a permissions issue on that
  // one request, which isn't the same thing as an expired session.
  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
