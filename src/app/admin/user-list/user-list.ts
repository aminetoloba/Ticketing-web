import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, merge, of, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth-service';
import { ROLE_LABELS } from '../../core/labels';
import { PagedResult, Role, UserDto } from '../../core/models';
import { UsersApi } from '../../core/users-api';

const PAGE_SIZE = 20;
const ROLES: Role[] = ['Participant', 'Organizer', 'Staff', 'Admin'];

@Component({
  selector: 'app-user-list',
  imports: [ReactiveFormsModule],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
})
export class UserList {
  private readonly api = inject(UsersApi);
  private readonly reload$ = new Subject<void>();
  private page = 1;

  protected readonly auth = inject(AuthService);
  protected readonly roles = ROLES;
  protected readonly labels = ROLE_LABELS;

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly roleFilter = new FormControl<Role | ''>('', { nonNullable: true });

  protected readonly result = signal<PagedResult<UserDto> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly changingId = signal<string | null>(null);
  protected readonly changeError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  constructor() {
    // switchMap annule la requête précédente si une nouvelle arrive avant sa réponse
    this.reload$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.api
            .list({
              search: this.search.value.trim(),
              role: this.roleFilter.value,
              page: this.page,
              pageSize: PAGE_SIZE,
            })
            .pipe(
              catchError((error: unknown) => {
                this.error.set(apiErrorMessage(error));
                return of(null);
              }),
            ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (result) this.result.set(result);
        this.loading.set(false);
      });

    // Un changement de filtre repart de la page 1, après une courte pause de frappe
    merge(this.search.valueChanges, this.roleFilter.valueChanges)
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe(() => {
        this.page = 1;
        this.reload$.next();
      });

    this.reload$.next();
  }

  protected goTo(page: number): void {
    this.page = page;
    this.reload$.next();
  }

  protected changeRole(user: UserDto, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const role = select.value as Role;

    if (role === user.role || this.changingId()) {
      select.value = user.role;
      return;
    }

    const question =
      `Passer ${user.fullName} (${user.email}) de « ${this.labels[user.role]} » ` +
      `à « ${this.labels[role]} » ?`;

    if (!confirm(question)) {
      // Le menu a déjà changé à l'écran : on le remet sur le rôle réel
      select.value = user.role;
      return;
    }

    this.changingId.set(user.id);
    this.changeError.set(null);
    this.notice.set(null);

    this.api.changeRole(user.id, role).subscribe({
      next: (updated) => {
        this.result.update((r) =>
          r ? { ...r, items: r.items.map((u) => (u.id === updated.id ? updated : u)) } : r,
        );
        this.notice.set(
          `${updated.fullName} est désormais « ${this.labels[updated.role]} ». ` +
            `Le changement s'applique à sa prochaine connexion, ou au plus tard dans 15 minutes.`,
        );
        this.changingId.set(null);
      },
      error: (error: unknown) => {
        select.value = user.role;
        this.changeError.set(apiErrorMessage(error));
        this.changingId.set(null);
      },
    });
  }
}