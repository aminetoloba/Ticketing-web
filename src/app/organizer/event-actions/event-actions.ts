import { Component, computed, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { apiErrorMessage } from '../../core/api-error';
import { fromLocalInput } from '../../core/date-utils';
import { EventsApi } from '../../core/events-api';
import { CancelEventResultDto, EventDto } from '../../core/models';

const endAfterStart: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const start = group.get('start')?.value as string;
  const end = group.get('end')?.value as string;
  return start && end && new Date(end) <= new Date(start) ? { endBeforeStart: true } : null;
};

const notInPast: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  control.value && new Date(control.value as string).getTime() <= Date.now() ? { past: true } : null;

@Component({
  selector: 'app-event-actions',
  imports: [ReactiveFormsModule],
  templateUrl: './event-actions.html',
  styleUrl: './event-actions.scss',
})
export class EventActions {
  private readonly api = inject(EventsApi);

  readonly event = input.required<EventDto>();
  // Prévient la page parente de l'état à jour de l'événement
  readonly changed = output<EventDto>();

  protected readonly postponeForm = new FormGroup(
    {
      start: new FormControl('', { nonNullable: true, validators: [Validators.required, notInPast] }),
      end: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      reason: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(1000)],
      }),
    },
    { validators: endAfterStart },
  );

  protected readonly postponing = signal(false);
  protected readonly postponeError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly cancelling = signal(false);
  protected readonly cancelError = signal<string | null>(null);
  protected readonly cancelResult = signal<CancelEventResultDto | null>(null);

  // Mêmes règles que l'API : on ne reporte qu'un événement publié, et une seule fois
  protected readonly canPostpone = computed(() => this.event().status === 'Published');
  protected readonly canCancel = computed(
    () => this.event().status === 'Published' || this.event().status === 'Postponed',
  );
  protected readonly isCancelled = computed(() => this.event().status === 'Cancelled');

  // Après un échec partiel, ou après un rechargement de la page, on peut relancer les remboursements
  protected readonly needsRetry = computed(() => {
    const result = this.cancelResult();
    return result === null || result.failedOrderIds.length > 0;
  });

  protected postpone(): void {
    if (this.postponeForm.invalid) {
      this.postponeForm.markAllAsTouched();
      return;
    }
    if (this.postponing()) return;

    const raw = this.postponeForm.getRawValue();
    const start = fromLocalInput(raw.start);
    const end = fromLocalInput(raw.end);
    const current = this.event();

    if (Date.parse(start) === Date.parse(current.startDate) && Date.parse(end) === Date.parse(current.endDate)) {
      this.postponeError.set('Les nouvelles dates sont identiques aux dates actuelles.');
      return;
    }

    if (
      !confirm(
        'Reporter cet événement ? Les billets déjà vendus restent valables à la nouvelle date, ' +
          'et les participants pourront demander un remboursement pendant 14 jours. ' +
          'Un événement ne peut être reporté qu\'une seule fois.',
      )
    ) {
      return;
    }

    this.postponing.set(true);
    this.postponeError.set(null);

    this.api
      .postpone(current.id, { newStartDate: start, newEndDate: end, reason: raw.reason.trim() })
      .subscribe({
        next: (updated) => {
          const until = updated.refundWindowEndsAt
            ? new Date(updated.refundWindowEndsAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : null;

          this.notice.set(
            until
              ? `Événement reporté. Les participants peuvent demander un remboursement jusqu'au ${until}.`
              : 'Événement reporté.',
          );
          this.postponing.set(false);
          this.changed.emit(updated);
        },
        error: (error: unknown) => {
          this.postponeError.set(apiErrorMessage(error));
          this.postponing.set(false);
        },
      });
  }

  protected cancel(): void {
    if (this.cancelling()) return;

    const message = this.isCancelled()
      ? 'Relancer le remboursement des commandes restantes ?'
      : 'Annuler cet événement ? Toutes les commandes payées seront remboursées et tous les billets ' +
        'annulés. Cette action est définitive.';
    if (!confirm(message)) return;

    this.cancelling.set(true);
    this.cancelError.set(null);

    this.api.cancel(this.event().id).subscribe({
      next: (result) => {
        this.cancelResult.set(result);
        this.cancelling.set(false);
        this.changed.emit(result.event);
      },
      error: (error: unknown) => {
        this.cancelError.set(apiErrorMessage(error));
        this.cancelling.set(false);
      },
    });
  }
}