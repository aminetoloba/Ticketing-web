import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './api-config';
import { CheckInResultDto, EventDto, StaffMemberDto } from './models';

@Injectable({ providedIn: 'root' })
export class StaffApi {
  private readonly http = inject(HttpClient);

  members(eventId: string) {
    return this.http.get<StaffMemberDto[]>(`${API_URL}/events/${eventId}/staff`);
  }

  assign(eventId: string, email: string) {
    return this.http.post<StaffMemberDto>(`${API_URL}/events/${eventId}/staff`, { email });
  }

  remove(eventId: string, staffId: string) {
    return this.http.delete<void>(`${API_URL}/events/${eventId}/staff/${staffId}`);
  }

  myEvents() {
    return this.http.get<EventDto[]>(`${API_URL}/staff/events`);
  }

  checkIn(eventId: string, code: string) {
    return this.http.post<CheckInResultDto>(`${API_URL}/events/${eventId}/check-in`, { code });
  }
}