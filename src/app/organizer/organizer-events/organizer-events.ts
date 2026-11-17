import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { EventsApi } from '../../core/events-api';
import { EVENT_STATUS_LABELS } from '../../core/labels';
import { EventDto, PagedResult } from '../../core/models';

@Component({
  selector: 'app-organizer-events',
  imports: [DatePipe, RouterLink],
  templateUrl: './organizer-events.html',
  styleUrl: './organizer-events.scss',
})
export class OrganizerEvents {
  protected readonly labels = EVENT_STATUS_LABELS;
  protected readonly result = signal<PagedResult<EventDto> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    inject(EventsApi)
      .mine({ pageSize: 100 })
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(apiErrorMessage(error));
          this.loading.set(false);
        },
      });
  }
}