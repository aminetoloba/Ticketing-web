import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, interval, map, switchMap } from 'rxjs';
import { CURRENCY } from '../../core/api-config';
import { apiErrorMessage } from '../../core/api-error';
import { EventsApi } from '../../core/events-api';
import { EventDto, OrderDto, OrderStatus } from '../../core/models';
import { OrdersApi } from '../../core/orders-api';

@Component({
  selector: 'app-order-detail',
  imports: [DatePipe, CurrencyPipe, RouterLink],
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.scss',
})
export class OrderDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly ordersApi = inject(OrdersApi);
  private readonly eventsApi = inject(EventsApi);
  private readonly orderId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly currency = CURRENCY;
  protected readonly statusLabels: Record<OrderStatus, string> = {
    Pending: 'En attente de paiement',
    Paid: 'Payée',
    Expired: 'Expirée',
    Cancelled: 'Annulée',
  };

  protected readonly order = signal<OrderDto | null>(null);
  protected readonly event = signal<EventDto | null>(null);
  protected readonly ticketTypeNames = signal<Record<string, string>>({});
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  // Horloge du navigateur, mise à jour chaque seconde
  private readonly now = signal(Date.now());

  protected readonly msLeft = computed(() => {
    const order = this.order();
    return order ? Date.parse(order.expiresAt) - this.now() : 0;
  });

  // Une commande « En attente » dont le délai est passé est déjà perdue,
  // même si la tâche de fond de l'API ne l'a pas encore marquée « Expirée »
  protected readonly isExpired = computed(() => {
    const order = this.order();
    return !!order && (order.status === 'Expired' || (order.status === 'Pending' && this.msLeft() <= 0));
  });

  protected readonly isActive = computed(() => this.order()?.status === 'Pending' && !this.isExpired());

  protected readonly countdown = computed(() => {
    const seconds = Math.max(0, Math.floor(this.msLeft() / 1000));
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  });

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(Date.now()));

    this.ordersApi
      .get(this.orderId)
      .pipe(
        switchMap((order) =>
          forkJoin({
            event: this.eventsApi.get(order.eventId),
            ticketTypes: this.eventsApi.ticketTypes(order.eventId),
          }).pipe(map((extra) => ({ order, ...extra }))),
        ),
      )
      .subscribe({
        next: ({ order, event, ticketTypes }) => {
          this.order.set(order);
          this.event.set(event);
          this.ticketTypeNames.set(Object.fromEntries(ticketTypes.map((t) => [t.id, t.name])));
          this.loading.set(false);
        },
        error: (error: unknown) => {
          const notFound = error instanceof HttpErrorResponse && error.status === 404;
          this.error.set(notFound ? 'Commande introuvable.' : apiErrorMessage(error));
          this.loading.set(false);
        },
      });
  }
}