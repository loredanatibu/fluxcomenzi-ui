import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { Lucrare } from '../models/lucrare.model';

@Injectable({ providedIn: 'root' })
export class LucrareService {
  constructor(
    private readonly http: HttpClient,
    private readonly config: RuntimeConfigService,
  ) {}

  // GET /api/lucrari -- returns all active lucrari (VersionedCrudController#findActive).
  getAll(): Observable<Lucrare[]> {
    return this.http.get<Lucrare[]>(`${this.config.apiUrl}/lucrari`);
  }

  // POST /api/lucrari -- creates a new lucrare for the given objective.
  create(lucrare: { idObiectiv: number; nume: string }): Observable<Lucrare> {
    return this.http.post<Lucrare>(`${this.config.apiUrl}/lucrari`, lucrare);
  }

  // PUT /api/lucrari/{id} -- updates an existing lucrare's nume and/or idObiectiv.
  update(id: number, lucrare: { idObiectiv: number; nume: string }): Observable<Lucrare> {
    return this.http.put<Lucrare>(`${this.config.apiUrl}/lucrari/${id}`, lucrare);
  }

  // DELETE /api/lucrari/{id} -- removes a lucrare.
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.config.apiUrl}/lucrari/${id}`);
  }
}
