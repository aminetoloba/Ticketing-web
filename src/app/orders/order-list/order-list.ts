import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { CURRENCY } from '../../core/api-config';
import { apiErrorMessage } from '../../core/api-error';
import { EventsApi } from '../../core/events-api';
import { OrderDto, OrderStatus } from '../../core/models';
import { OrdersApi } from '../../core/orders-api';

@Component({
  selector: 'app-order-list',
  imports: [DatePipe, CurrencyPipe, RouterLink],
  templateUrl: './order-list.html',
  styleUrl: './order-list.scss',
})
export class OrderList {
  private readonly ordersApi = inject(OrdersApi);
  private readonly eventsApi = inject(EventsApi);

  protected readonly currency = CURRENCY;
  protected readonly statusLabels: Record<OrderStatus, string> = {
    Pending: 'En attente de paiement',
    Paid: 'Payée',
    Expired: 'Expirée',
    Cancelled: 'Annulée',
  };

  protected readonly orders = signal<OrderDto[]>([]);
  protected readonly eventTitles = signal<Record<string, string>>({});
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.ordersApi
      .mine()
      .pipe(
        switchMap((orders) => {
          const eventIds = [...new Set(orders.map((o) => o.eventId))];
          if (eventIds.length === 0) return of({ orders, titles: {} as Record<string, string> });

          // Un titre d'événement introuvable ne doit pas bloquer toute la liste
          return forkJoin(
            eventIds.map((id) =>
              this.eventsApi.get(id).pipe(
                map((event) => [id, event.title] as const),
                catchError(() => of([id, 'Événement indisponible'] as const)),
              ),
            ),
          ).pipe(map((pairs) => ({ orders, titles: Object.fromEntries(pairs) })));
        }),
      )
      .subscribe({
        next: ({ orders, titles }) => {
          this.orders.set(orders);
          this.eventTitles.set(titles);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(apiErrorMessage(error));
          this.loading.set(false);
        },
      });
  }

  // Une commande « En attente » dont le délai est passé est déjà perdue,
  // même si la tâche de fond de l'API ne l'a pas encore marquée « Expirée »
  protected status(order: OrderDto): OrderStatus {
    return order.status === 'Pending' && Date.parse(order.expiresAt) <= Date.now()
      ? 'Expired'
      : order.status;
  }
}