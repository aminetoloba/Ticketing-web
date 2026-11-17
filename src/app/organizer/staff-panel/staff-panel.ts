import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { apiErrorMessage } from '../../core/api-error';
import { StaffMemberDto } from '../../core/models';
import { StaffApi } from '../../core/staff-api';

@Component({
  selector: 'app-staff-panel',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './staff-panel.html',
  styleUrl: './staff-panel.scss',
})
export class StaffPanel implements OnInit {
  private readonly api = inject(StaffApi);

  readonly eventId = input.required<string>();

  protected readonly members = signal<StaffMemberDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly adding = signal(false);
  protected readonly addError = signal<string | null>(null);
  protected readonly removingId = signal<string | null>(null);
  protected readonly removeError = signal<string | null>(null);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(256)],
    }),
  });

  ngOnInit(): void {
    this.api.members(this.eventId()).subscribe({
      next: (members) => {
        this.members.set(members);
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

    this.adding.set(true);
    this.addError.set(null);

    this.api.assign(this.eventId(), this.form.getRawValue().email.trim()).subscribe({
      next: (member) => {
        this.members.update((list) => [...list, member]);
        this.form.reset();
        this.adding.set(false);
      },
      error: (error: unknown) => {
        this.addError.set(apiErrorMessage(error));
        this.adding.set(false);
      },
    });
  }

  protected remove(member: StaffMemberDto): void {
    if (this.removingId()) return;
    if (!confirm(`Retirer ${member.fullName} de cet événement ?`)) return;

    this.removingId.set(member.staffId);
    this.removeError.set(null);

    this.api.remove(this.eventId(), member.staffId).subscribe({
      next: () => {
        this.members.update((list) => list.filter((m) => m.staffId !== member.staffId));
        this.removingId.set(null);
      },
      error: (error: unknown) => {
        this.removeError.set(apiErrorMessage(error));
        this.removingId.set(null);
      },
    });
  }
}