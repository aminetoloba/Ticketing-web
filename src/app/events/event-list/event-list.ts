import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, merge, of, switchMap, tap } from 'rxjs';
import { EventsApi } from '../../core/events-api';
import { EventDto, PagedResult } from '../../core/models';
import { RouterLink } from '@angular/router';

const PAGE_SIZE = 9;

@Component({
  selector: 'app-event-list',
  imports: [ReactiveFormsModule, DatePipe, RouterLink],
  templateUrl: './event-list.html',
  styleUrl: './event-list.scss',
})
export class EventList {
  private readonly api = inject(EventsApi);
  private readonly reload$ = new Subject<void>();
  private page = 1;

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly location = new FormControl('', { nonNullable: true });

  protected readonly result = signal<PagedResult<EventDto> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

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
              location: this.location.value.trim(),
              page: this.page,
              pageSize: PAGE_SIZE,
            })
            .pipe(
              catchError(() => {
                this.error.set("Impossible de charger les événements. Vérifiez que l'API est démarrée.");
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
    merge(this.search.valueChanges, this.location.valueChanges)
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
}