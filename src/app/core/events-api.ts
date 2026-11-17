import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './api-config';
import {
  EventDto,
  EventQuery,
  PagedResult,
  SaveEventRequest,
  SaveTicketTypeRequest,
  TicketTypeDto,
} from './models';

// On n'envoie que les filtres renseignés
function toParams(query: EventQuery): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class EventsApi {
  private readonly http = inject(HttpClient);

  list(query: EventQuery = {}) {
    return this.http.get<PagedResult<EventDto>>(`${API_URL}/events`, { params: toParams(query) });
  }

  mine(query: EventQuery = {}) {
    return this.http.get<PagedResult<EventDto>>(`${API_URL}/events/mine`, { params: toParams(query) });
  }

  get(id: string) {
    return this.http.get<EventDto>(`${API_URL}/events/${id}`);
  }

  create(request: SaveEventRequest) {
    return this.http.post<EventDto>(`${API_URL}/events`, request);
  }

  update(id: string, request: SaveEventRequest) {
    return this.http.put<EventDto>(`${API_URL}/events/${id}`, request);
  }

  publish(id: string) {
    return this.http.post<EventDto>(`${API_URL}/events/${id}/publish`, {});
  }

  ticketTypes(id: string) {
    return this.http.get<TicketTypeDto[]>(`${API_URL}/events/${id}/ticket-types`);
  }

  addTicketType(id: string, request: SaveTicketTypeRequest) {
    return this.http.post<TicketTypeDto>(`${API_URL}/events/${id}/ticket-types`, request);
  }
}