import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './api-config';
import { TicketDto } from './models';

@Injectable({ providedIn: 'root' })
export class TicketsApi {
  private readonly http = inject(HttpClient);

  mine() {
    return this.http.get<TicketDto[]>(`${API_URL}/tickets/mine`);
  }

  // L'image arrive en « blob » (données brutes) : l'interceptor ajoute le token comme pour tout appel
  qr(id: string) {
    return this.http.get(`${API_URL}/tickets/${id}/qr`, { responseType: 'blob' });
  }
}