import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { EventStatus, TicketDto, TicketStatus } from '../../core/models';
import { TicketsApi } from '../../core/tickets-api';

@Component({
  selector: 'app-ticket-list',
  imports: [DatePipe, RouterLink],
  templateUrl: './ticket-list.html',
  styleUrl: './ticket-list.scss',
})
export class TicketList {
  private readonly api = inject(TicketsApi);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly statusLabels: Record<TicketStatus, string> = {
    Valid: 'Valide',
    Used: 'Utilisé',
    Cancelled: 'Annulé',
  };
  protected readonly eventStatusLabels: Partial<Record<EventStatus, string>> = {
    Postponed: 'Événement reporté',
    Cancelled: 'Événement annulé',
    Completed: 'Événement terminé',
  };

  protected readonly tickets = signal<TicketDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  // QR affichés, par identifiant de billet
  protected readonly qr = signal<Record<string, SafeUrl>>({});
  protected readonly qrLoading = signal<Record<string, boolean>>({});
  protected readonly qrError = signal<Record<string, string>>({});

  // Adresses temporaires créées : on les libère quand on masque un QR ou qu'on quitte la page
  private readonly objectUrls = new Map<string, string>();

  protected readonly usable = computed(() => this.tickets().filter((t) => this.isUsable(t)));
  protected readonly others = computed(() => this.tickets().filter((t) => !this.isUsable(t)));

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
      this.objectUrls.clear();
    });

    this.api.mine().subscribe({
      next: (tickets) => {
        this.tickets.set(tickets);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected isUsable(ticket: TicketDto): boolean {
    return (
      ticket.status === 'Valid' &&
      ticket.eventStatus !== 'Cancelled' &&
      ticket.eventStatus !== 'Completed' &&
      Date.parse(ticket.eventEndDate) > Date.now()
    );
  }

  protected toggleQr(ticket: TicketDto): void {
    if (this.qr()[ticket.id]) {
      this.hideQr(ticket.id);
      return;
    }
    if (this.qrLoading()[ticket.id]) return;

    this.qrLoading.update((s) => ({ ...s, [ticket.id]: true }));
    this.qrError.update((s) => this.without(s, ticket.id));

    this.api.qr(ticket.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.objectUrls.set(ticket.id, url);

        // Cette adresse est fabriquée ici, à partir de la réponse de notre API :
        // on peut dire à Angular qu'elle est sûre
        this.qr.update((s) => ({ ...s, [ticket.id]: this.sanitizer.bypassSecurityTrustUrl(url) }));
        this.qrLoading.update((s) => this.without(s, ticket.id));
      },
      error: (error: unknown) => {
        // Pour une image, l'erreur arrive en « blob » : on s'appuie sur le statut HTTP
        const status = error instanceof HttpErrorResponse ? error.status : -1;
        const message =
          status === 404
            ? 'Billet introuvable.'
            : status === 400
              ? "Ce billet n'est plus valide."
              : status === 0
                ? "L'API est injoignable."
                : 'Impossible de charger le QR code.';

        this.qrError.update((s) => ({ ...s, [ticket.id]: message }));
        this.qrLoading.update((s) => this.without(s, ticket.id));
      },
    });
  }

  private hideQr(id: string): void {
    const url = this.objectUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    this.objectUrls.delete(id);
    this.qr.update((s) => this.without(s, id));
  }

  private without<T>(record: Record<string, T>, key: string): Record<string, T> {
    const { [key]: _removed, ...rest } = record;
    return rest;
  }
}