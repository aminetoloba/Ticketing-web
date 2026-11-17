import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { CURRENCY } from '../../core/api-config';
import { apiErrorMessage } from '../../core/api-error';
import { EventsApi } from '../../core/events-api';
import { TicketTypeDto } from '../../core/models';

// Mêmes règles que l'API : au plus 2 décimales, quantité entière
const maxTwoDecimals = (c: AbstractControl): ValidationErrors | null => {
  const value = c.value as number | null;
  return value === null || Math.abs(value * 100 - Math.round(value * 100)) < 1e-6 ? null : { decimals: true };
};
const integer = (c: AbstractControl): ValidationErrors | null => {
  const value = c.value as number | null;
  return value === null || Number.isInteger(value) ? null : { integer: true };
};

@Component({
  selector: 'app-ticket-types-panel',
  imports: [ReactiveFormsModule, CurrencyPipe],
  templateUrl: './ticket-types-panel.html',
  styleUrl: './ticket-types-panel.scss',
})
export class TicketTypesPanel implements OnInit {
  private readonly api = inject(EventsApi);

  readonly eventId = input.required<string>();
  readonly editable = input(true);
  // Prévient la page parente du nombre de types, pour sa liste de contrôle de publication
  readonly countChange = output<number>();

  protected readonly currency = CURRENCY;
  protected readonly ticketTypes = signal<TicketTypeDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly adding = signal(false);
  protected readonly addError = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    price: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      Validators.max(1_000_000),
      maxTwoDecimals,
    ]),
    totalQuantity: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(100_000),
      integer,
    ]),
  });

  ngOnInit(): void {
    this.api.ticketTypes(this.eventId()).subscribe({
      next: (list) => {
        this.ticketTypes.set(list);
        this.countChange.emit(list.length);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(apiErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected add(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.adding()) return;

    const raw = this.form.getRawValue();
    this.adding.set(true);
    this.addError.set(null);

    this.api
      .addTicketType(this.eventId(), {
        name: raw.name.trim(),
        price: raw.price!,
        totalQuantity: raw.totalQuantity!,
      })
      .subscribe({
        next: (created) => {
          this.ticketTypes.update((list) =>
            [...list, created].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name)),
          );
          this.countChange.emit(this.ticketTypes().length);
          this.form.reset();
          this.adding.set(false);
        },
        error: (error: unknown) => {
          this.addError.set(apiErrorMessage(error));
          this.adding.set(false);
        },
      });
  }
}