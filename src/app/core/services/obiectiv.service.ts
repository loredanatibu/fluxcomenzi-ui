import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { Obiectiv } from '../models/obiectiv.model';
import { ObiectivCuLucrari } from '../models/obiectiv-cu-lucrari.model';

@Injectable({ providedIn: 'root' })
export class ObjectiveService {
  constructor(
    private readonly http: HttpClient,
    private readonly config: RuntimeConfigService,
  ) {}

  // GET /api/obiective -- returns all objectives available for the "Obiectiv" combobox.
  getAll(): Observable<Obiectiv[]> {
    return this.http.get<Obiectiv[]>(`${this.config.apiUrl}/obiective`);
  }

  // GET /api/obiective/cobiective´-cu-lucrari -- objectives paired with their lucrari; drives the
  // cascading Obiectiv -> Lucrare selection when editing a lucrare.
  getAllCuLucrari(): Observable<ObiectivCuLucrari[]> {
    return this.http.get<ObiectivCuLucrari[]>(`${this.config.apiUrl}/obiective/obiectiv-cu-lucrari`);
  }

  // POST /api/obiective -- creates a new objective.
  create(obiectiv: {
    nume: string;
    alias?: string | null;
    termenExecutie?: string | null;
    dataIncepere?: string | null;
  }): Observable<Obiectiv> {
    return this.http.post<Obiectiv>(`${this.config.apiUrl}/obiective`, obiectiv);
  }

  // PUT /api/obiective/{id} -- updates an existing objective (nume/alias are
  // sent unchanged; only termenExecutie/dataIncepere are editable in the UI).
  update(
    id: number,
    obiectiv: {
      nume: string;
      alias?: string | null;
      termenExecutie?: string | null;
      dataIncepere?: string | null;
    },
  ): Observable<Obiectiv> {
    return this.http.put<Obiectiv>(`${this.config.apiUrl}/obiective/${id}`, obiectiv);
  }

  // DELETE /api/obiective/{id} -- removes an objective.
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.config.apiUrl}/obiective/${id}`);
  }
}
