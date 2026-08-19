import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { Obiectiv } from '../models/obiectiv.model';

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

  // POST /api/obiective -- creates a new objective.
  create(obiectiv: {
    nume: string;
    alias?: string | null;
    termenExecutie?: string | null;
    dataIncepere?: string | null;
  }): Observable<Obiectiv> {
    return this.http.post<Obiectiv>(`${this.config.apiUrl}/obiective`, obiectiv);
  }
}
