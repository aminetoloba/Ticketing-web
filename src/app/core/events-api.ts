import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './api-config';
import { toParams } from './http-params';
import {
  CancelEventResultDto,
  EventDto,
  EventQuery,
  PagedResult,
  PostponeEventRequest,
  SaveEventRequest,
  SaveTicketTypeRequest,
  TicketTypeDto,
} from './models';

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

  postpone(id: string, request: PostponeEventRequest) {
    return this.http.post<EventDto>(`${API_URL}/events/${id}/postpone`, request);
  }

  cancel(id: string) {
    return this.http.post<CancelEventResultDto>(`${API_URL}/events/${id}/cancel`, {});
  }

  ticketTypes(id: string) {
    return this.http.get<TicketTypeDto[]>(`${API_URL}/events/${id}/ticket-types`);
  }

  addTicketType(id: string, request: SaveTicketTypeRequest) {
    return this.http.post<TicketTypeDto>(`${API_URL}/events/${id}/ticket-types`, request);
  }
}