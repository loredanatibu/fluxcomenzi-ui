import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { Comanda } from '../models/comanda.model';

export interface ComandaPayload {
  idLucrare: number;
  idSolicitant: number;
  idFurnizor: number;
  idAgent: number | null;
  numeMaterial: string;
  cantitate: number;
  unitateMasura: string;
  termenLivrare: string;
  observatii: string;
}

// Recepție Comandă: the quantity received now (not the total) and the comanda's observații.
export interface ReceptiePayload {
  cantitateReceptionata: number;
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

  // PUT /api/comenzi/{id}/receptie -- Recepție Comandă: logs the quantity received now in
  // comenzi_istoric, whose sum is the comanda's totalReceptionat.
  receptioneaza(id: number, receptie: ReceptiePayload): Observable<Comanda> {
    return this.http.put<Comanda>(`${this.config.apiUrl}/comenzi/${id}/receptie`, receptie);
  }

  // PUT /api/comenzi/{id}/actualizare -- Actualizare Comandă: the API keeps cantitate as it
  // is and logs 0 received in comenzi_istoric.
  actualizeaza(id: number, comanda: ComandaPayload): Observable<Comanda> {
    return this.http.put<Comanda>(`${this.config.apiUrl}/comenzi/${id}/actualizare`, comanda);
  }

  // DELETE /api/comenzi/{id} -- removes a comanda.
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.config.apiUrl}/comenzi/${id}`);
  }
}
