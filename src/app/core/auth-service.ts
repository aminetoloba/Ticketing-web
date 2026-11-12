import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, throwError } from 'rxjs';
import { API_URL } from './api-config';
import { AuthResponse, LoginRequest, RegisterRequest, Role } from './models';

const STORAGE_KEY = 'ticketing.session';

export interface Session {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  user: { id: string; email: string; fullName: string; role: Role };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly session = signal<Session | null>(this.load());
  private refreshInFlight$: Observable<Session> | null = null;

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly role = computed(() => this.session()?.user.role ?? null);

  get accessToken(): string | null {
    return this.session()?.accessToken ?? null;
  }

  get refreshToken(): string | null {
    return this.session()?.refreshToken ?? null;
  }

  register(request: RegisterRequest): Observable<Session> {
    return this.http
      .post<AuthResponse>(`${API_URL}/auth/register`, request)
      .pipe(map((response) => this.store(response)));
  }

  login(request: LoginRequest): Observable<Session> {
    return this.http
      .post<AuthResponse>(`${API_URL}/auth/login`, request)
      .pipe(map((response) => this.store(response)));
  }

  // Si plusieurs requêtes reçoivent un 401 en même temps, une seule demande de
  // renouvellement part et tout le monde attend son résultat. C'est indispensable :
  // chaque refresh token ne sert qu'une fois, et l'API considère sa réutilisation
  // comme un vol et coupe toutes les sessions.
  refresh(): Observable<Session> {
    const refreshToken = this.refreshToken;
    if (!refreshToken) return throwError(() => new Error('Aucune session.'));

    this.refreshInFlight$ ??= this.http
      .post<AuthResponse>(`${API_URL}/auth/refresh`, { refreshToken })
      .pipe(
        map((response) => this.store(response)),
        finalize(() => (this.refreshInFlight$ = null)),
        shareReplay(1),
      );

    return this.refreshInFlight$;
  }

  // Déconnexion voulue par l'utilisateur
  logout(): void {
    const refreshToken = this.refreshToken;
    this.clear();

    if (refreshToken) {
      // Révocation côté serveur ; si elle échoue, la session locale est déjà fermée
      this.http
        .post(`${API_URL}/auth/logout`, { refreshToken })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
    void this.router.navigate(['/login']);
  }

  // Session devenue invalide (renouvellement refusé) : on revient à la connexion
  // en retenant la page où l'on était
  expireSession(): void {
    const returnUrl = this.router.url;
    this.clear();
    void this.router.navigate(['/login'], { queryParams: { returnUrl } });
  }

  private store(response: AuthResponse): Session {
    const session: Session = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      accessTokenExpiresAt: response.accessTokenExpiresAt,
      user: {
        id: response.userId,
        email: response.email,
        fullName: response.fullName,
        role: response.role,
      },
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Stockage indisponible (navigation privée stricte) : la session reste en mémoire
    }
    this.session.set(session);
    return session;
  }

  private clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Rien à faire
    }
    this.session.set(null);
  }

  private load(): Session | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Session;
      return parsed?.accessToken && parsed?.refreshToken && parsed?.user ? parsed : null;
    } catch {
      return null;
    }
  }
}