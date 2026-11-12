export type EventStatus = 'Draft' | 'Published' | 'Postponed' | 'Cancelled' | 'Completed';

export interface EventDto {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  status: EventStatus;
  organizerId: string;
  originalStartDate: string | null;
  originalEndDate: string | null;
  postponementReason: string | null;
  postponedAt: string | null;
  refundWindowEndsAt: string | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface EventQuery {
  search?: string;
  location?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export type Role = 'Participant' | 'Organizer' | 'Staff' | 'Admin';

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  role: 'Participant' | 'Organizer';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  userId: string;
  email: string;
  fullName: string;
  role: Role;
}