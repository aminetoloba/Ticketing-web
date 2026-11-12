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