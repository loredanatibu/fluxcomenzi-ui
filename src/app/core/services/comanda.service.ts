import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { Comanda } from '../models/comanda.model';
import { HEADER_TOKEN_BLOCARE } from './blocare.service';

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

// Recepție Comandă, one grid row: the quantity received now (not the total) and the comanda's observații.
export interface ReceptiePayload {
  id: number;
  cantitateReceptionata: number;
  observatii: string;
}

// Actualizare Comandă, one grid row. The id travels next to the fields: the API ignores an id
// inside a Comanda body.
export interface ActualizarePayload {
  id: number;
  modificari: ComandaPayload;
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

  // PUT /api/comenzi/receptie -- Recepție Comandă: every changed grid row in one transaction, all
  // saved or none. Logs the quantity received now in comenzi_istoric, whose sum is the comanda's
  // totalReceptionat. tokenBlocare: the tab holding the lucrare (BlocareService); 409 otherwise.
  receptioneaza(receptii: ReceptiePayload[], tokenBlocare: string): Observable<Comanda[]> {
    return this.http.put<Comanda[]>(`${this.config.apiUrl}/comenzi/receptie`, receptii, {
      headers: { [HEADER_TOKEN_BLOCARE]: tokenBlocare },
    });
  }

  // PUT /api/comenzi/actualizare -- Actualizare Comandă, all rows together like Recepție: only for
  // comenzi with nothing received yet; saves every field, cantitate included, and logs 0
  // received in comenzi_istoric.
  actualizeaza(actualizari: ActualizarePayload[], tokenBlocare: string): Observable<Comanda[]> {
    return this.http.put<Comanda[]>(`${this.config.apiUrl}/comenzi/actualizare`, actualizari, {
      headers: { [HEADER_TOKEN_BLOCARE]: tokenBlocare },
    });
  }

  // DELETE /api/comenzi/{id} -- removes a comanda; from Modifică Comandă, so it needs the lucrare's
  // blocare too.
  delete(id: number, tokenBlocare: string): Observable<void> {
    return this.http.delete<void>(`${this.config.apiUrl}/comenzi/${id}`, {
      headers: { [HEADER_TOKEN_BLOCARE]: tokenBlocare },
    });
  }
}
