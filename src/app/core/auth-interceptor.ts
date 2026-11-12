import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_URL } from './api-config';
import { AuthService } from './auth-service';

// Ces appels n'ont pas besoin du token, et un 401 y a un autre sens
// (mauvais mot de passe, refresh token refusé) : on ne les intercepte pas
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // Le token ne part jamais vers une adresse autre que notre API
  if (!req.url.startsWith(API_URL)) return next(req);
  if (AUTH_PATHS.some((path) => req.url.startsWith(API_URL + path))) return next(req);

  return next(withToken(req, auth.accessToken)).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      if (!isUnauthorized || !auth.refreshToken) return throwError(() => error);

      // Token expiré : on le renouvelle, puis on rejoue la requête une seule fois
      return auth.refresh().pipe(
        catchError((refreshError: unknown) => {
          // Réseau coupé : on garde la session. Refus de l'API : elle est terminée.
          const networkDown = refreshError instanceof HttpErrorResponse && refreshError.status === 0;
          if (!networkDown) auth.expireSession();
          return throwError(() => refreshError);
        }),
        switchMap((session) => next(withToken(req, session.accessToken))),
      );
    }),
  );
};