import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { Comanda } from '../models/comanda.model';

export interface ComandaPayload {
  idLucrare: number;
  numeMaterial: string;
  cantitate: number;
  unitateMasura: string;
  numeFurnizor: string;
  emailFurnizor: string;
  termenLivrare: string;
  comandaTrimisa: boolean;
  comandaReceptionata: boolean;
  observatii: string;
}

@Injectable({ providedIn: 'root' })
export class ComandaService {
  constructor(
    private readonly http: HttpClient,
    private readonly config: RuntimeConfigService,
  ) {}

  // GET /api/comenzi -- returns all active comenzi (VersionedCrudController#findActive).
  getAll(): Observable<Comanda[]> {
    return this.http.get<Comanda[]>(`${this.config.apiUrl}/comenzi`);
  }

  // POST /api/comenzi -- creates a new comanda for the given lucrare.
  create(comanda: ComandaPayload): Observable<Comanda> {
    return this.http.post<Comanda>(`${this.config.apiUrl}/comenzi`, comanda);
  }

  // PUT /api/comenzi/{id} -- updates an existing comanda (numeMaterial is sent
  // unchanged; the rest are editable in the UI).
  update(id: number, comanda: ComandaPayload): Observable<Comanda> {
    return this.http.put<Comanda>(`${this.config.apiUrl}/comenzi/${id}`, comanda);
  }

  // DELETE /api/comenzi/{id} -- removes a comanda.
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.config.apiUrl}/comenzi/${id}`);
  }
}
