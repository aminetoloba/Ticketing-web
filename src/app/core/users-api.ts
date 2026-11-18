import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './api-config';
import { toParams } from './http-params';
import { PagedResult, Role, UserDto, UserQuery } from './models';

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);

  list(query: UserQuery = {}) {
    return this.http.get<PagedResult<UserDto>>(`${API_URL}/users`, { params: toParams(query) });
  }

  changeRole(id: string, role: Role) {
    return this.http.put<UserDto>(`${API_URL}/users/${id}/role`, { role });
  }
}