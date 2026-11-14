import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './api-config';
import { CreateOrderRequest, OrderDto } from './models';

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);

  create(request: CreateOrderRequest) {
    return this.http.post<OrderDto>(`${API_URL}/orders`, request);
  }

  get(id: string) {
    return this.http.get<OrderDto>(`${API_URL}/orders/${id}`);
  }
}