import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { ComandaTermenRaport } from '../models/comanda-termen-raport.model';

@Injectable({ providedIn: 'root' })
export class RaportService {
  constructor(
    private readonly http: HttpClient,
    private readonly config: RuntimeConfigService,
  ) {}

  // GET /api/comenzi/termen-3-zile-lucratoare -- comenzile nereceptionate integral, cu termen
  // de livrare inca nedepasit dar in urmatoarele 3 zile lucratoare, fiecare cu lucrarea si
  // obiectivul aferent.
  getComenziTermen3ZileLucratoare(): Observable<ComandaTermenRaport[]> {
    return this.http.get<ComandaTermenRaport[]>(`${this.config.apiUrl}/comenzi/termen-3-zile-lucratoare`);
  }

  // GET /api/comenzi/nelivrate -- comenzile nereceptionate integral, cu termenul de livrare depasit.
  getComenziNelivrate(): Observable<ComandaTermenRaport[]> {
    return this.http.get<ComandaTermenRaport[]>(`${this.config.apiUrl}/comenzi/nelivrate`);
  }

  // GET /api/comenzi/pe-agenti -- toate comenzile aprovizionate prin agent, indiferent de
  // termenul de livrare sau de receptie, fiecare cu agentul, lucrarea si obiectivul.
  getComenziPeAgenti(): Observable<ComandaTermenRaport[]> {
    return this.http.get<ComandaTermenRaport[]>(`${this.config.apiUrl}/comenzi/pe-agenti`);
  }

  // GET /api/comenzi/pe-agenti/{idAgent}/pdf -- sectiunea unui agent din raportul de mai sus, ca PDF.
  getPdfAgent(idAgent: number): Observable<Blob> {
    return this.http.get(`${this.config.apiUrl}/comenzi/pe-agenti/${idAgent}/pdf`, { responseType: 'blob' });
  }

  // GET /api/comenzi/pe-obiectiv?idObiectiv=&idLucrare=&idSolicitant= -- toate comenzile
  // obiectivului, optional doar ale unei lucrari si/sau ale unui solicitant.
  getComenziPeObiectiv(filtru: FiltruRaportObiectiv): Observable<ComandaTermenRaport[]> {
    return this.http.get<ComandaTermenRaport[]>(`${this.config.apiUrl}/comenzi/pe-obiectiv`, {
      params: paramsFiltru(filtru),
    });
  }

  // GET /api/comenzi/pe-obiectiv/pdf -- raportul de mai sus ca PDF, cate o pagina pe lucrare.
  getPdfObiectiv(filtru: FiltruRaportObiectiv): Observable<Blob> {
    return this.http.get(`${this.config.apiUrl}/comenzi/pe-obiectiv/pdf`, {
      params: paramsFiltru(filtru),
      responseType: 'blob',
    });
  }
}

export interface FiltruRaportObiectiv {
  idObiectiv: number;
  idLucrare: number | null;
  idSolicitant: number | null;
}

// Filtrele optionale nealese nu se trimit deloc (backend-ul le trateaza ca "toate").
function paramsFiltru(filtru: FiltruRaportObiectiv): Record<string, number> {
  const params: Record<string, number> = { idObiectiv: filtru.idObiectiv };
  if (filtru.idLucrare != null) params['idLucrare'] = filtru.idLucrare;
  if (filtru.idSolicitant != null) params['idSolicitant'] = filtru.idSolicitant;
  return params;
}
