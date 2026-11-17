import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth-service';
import { fromLocalInput, toLocalInput } from '../../core/date-utils';
import { EventsApi } from '../../core/events-api';
import { EVENT_STATUS_LABELS } from '../../core/labels';
import { EventDto, SaveEventRequest } from '../../core/models';
import { EventActions } from '../event-actions/event-actions';
import { StaffPanel } from '../staff-panel/staff-panel';
import { TicketTypesPanel } from '../ticket-types-panel/ticket-types-panel';

const endAfterStart: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const start = group.get('start')?.value as string;
  const end = group.get('end')?.value as string;
  return start && end && new Date(end) <= new Date(start) ? { endBeforeStart: true } : null;
};

const notInPast: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  control.value && new Date(control.value as string).getTime() <= Date.now() ? { past: true } : null;

@Component({
  selector: 'app-event-editor',
  imports: [ReactiveFormsModule, RouterLink, TicketTypesPanel, EventActions, StaffPanel],
  templateUrl: './event-editor.html',
  styleUrl: './event-editor.scss',
})
export class EventEditor {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(EventsApi);
  private readonly auth = inject(AuthService);

  // Pas de paramètre « id » dans l'adresse = création
  protected readonly eventId = this.route.snapshot.paramMap.get('id');
  protected readonly isNew = this.eventId === null;
  protected readonly labels = EVENT_STATUS_LABELS;

  protected readonly event = signal<EventDto | null>(null);
  protected readonly loading = signal(!this.isNew);
  protected readonly loadError = signal<string | null>(null);

  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly publishing = signal(false);
  protected readonly publishError = signal<string | null>(null);
  protected readonly ticketTypeCount = signal(0);

  protected readonly form = new FormGroup(
    {
      title: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(200)],
      }),
      description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(4000)] }),
      location: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(300)],
      }),
      start: new FormControl('', {
        nonNullable: true,
        // Seule la création exige une date future (comme l'API)
        validators: this.isNew ? [Validators.required, notInPast] : [Validators.required],
      }),
      end: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: endAfterStart },
  );

  protected readonly isOwner = computed(() => {
    const e = this.event();
    const user = this.auth.user();
    return !!e && !!user && (user.id === e.organizerId || user.role === 'Admin');
  });

  // Mêmes règles que l'API : modifiable en Brouillon ou Publié, par son organisateur
  protected readonly editable = computed(() => {
    const e = this.event();
    return this.isNew || (!!e && this.isOwner() && (e.status === 'Draft' || e.status === 'Published'));
  });

  // Une fois publié, les dates ne changent plus que par un report
  protected readonly datesLocked = computed(() => !this.isNew && this.event()?.status === 'Published');

  protected readonly canEditTickets = computed(() => {
    const e = this.event();
    return !!e && this.isOwner() && e.status !== 'Cancelled' && e.status !== 'Completed';
  });

  protected readonly canPublish = computed(() => this.event()?.status === 'Draft' && this.isOwner());
  protected readonly canManageStaff = computed(() => this.canEditTickets());
  protected readonly startPassed = computed(() => {
    const e = this.event();
    return !!e && Date.parse(e.startDate) <= Date.now();
  });

  constructor() {
    if (this.eventId) {
      this.api.get(this.eventId).subscribe({
        next: (event) => {
          this.applyEvent(event);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loadError.set(apiErrorMessage(error));
          this.loading.set(false);
        },
      });
    }
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

    const raw = this.form.getRawValue();
    const current = this.event();
    const locked = this.datesLocked() && !!current;

    const request: SaveEventRequest = {
      title: raw.title.trim(),
      description: raw.description.trim(),
      location: raw.location.trim(),
      // Dates verrouillées : on renvoie celles de l'API telles quelles, sans les arrondir
      startDate: locked ? current.startDate : fromLocalInput(raw.start),
      endDate: locked ? current.endDate : fromLocalInput(raw.end),
    };

    this.saving.set(true);
    this.saveError.set(null);
    this.saved.set(false);

    const call$ = this.isNew ? this.api.create(request) : this.api.update(this.eventId!, request);

    call$.subscribe({
      next: (event) => {
        this.saving.set(false);
        if (this.isNew) {
          void this.router.navigate(['/organizer/events', event.id]);
        } else {
          this.applyEvent(event);
          this.saved.set(true);
        }
      },
      error: (error: unknown) => {
        this.saveError.set(apiErrorMessage(error));
        this.saving.set(false);
      },
    });
  }

  protected publish(): void {
    if (this.publishing() || !this.eventId) return;
    if (!confirm('Publier cet événement ? Il sera visible de tous et ses billets seront mis en vente.')) return;

    this.publishing.set(true);
    this.publishError.set(null);

    this.api.publish(this.eventId).subscribe({
      next: (event) => {
        this.applyEvent(event);
        this.publishing.set(false);
      },
      error: (error: unknown) => {
        this.publishError.set(apiErrorMessage(error));
        this.publishing.set(false);
      },
    });
  }

  // Appelée quand un report ou une annulation vient de réussir
  protected onActionDone(event: EventDto): void {
    this.applyEvent(event);
  }

  private applyEvent(event: EventDto): void {
    this.event.set(event);

    this.form.enable({ emitEvent: false });
    this.form.patchValue({
      title: event.title,
      description: event.description,
      location: event.location,
      start: toLocalInput(event.startDate),
      end: toLocalInput(event.endDate),
    });
    this.form.markAsPristine();

    if (!this.editable()) {
      this.form.disable({ emitEvent: false });
    } else if (this.datesLocked()) {
      this.form.controls.start.disable({ emitEvent: false });
      this.form.controls.end.disable({ emitEvent: false });
    }
  }
}