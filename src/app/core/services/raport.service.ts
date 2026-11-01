import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { HEADER_TOKEN_BLOCARE } from './blocare.service';
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
  // obiectivului, optional doar ale unei lucrari si/sau ale unui solicitant. Header-ul
  // X-Versiune-Raport e versiunea raportului (ultimul rand din comenzi_istoric al comenzilor
  // lui), trimisa inapoi la generarea avizului.
  getComenziPeObiectiv(filtru: FiltruRaportObiectiv): Observable<RaportObiectiv> {
    return this.http
      .get<ComandaTermenRaport[]>(`${this.config.apiUrl}/comenzi/pe-obiectiv`, {
        params: paramsFiltru(filtru),
        observe: 'response',
      })
      .pipe(
        map((response) => ({
          comenzi: response.body ?? [],
          versiune: Number(response.headers.get(HEADER_VERSIUNE_RAPORT) ?? 0),
        })),
      );
  }

  // POST /api/comenzi/pe-obiectiv/pdf -- avizul pentru raportul de mai sus, ca PDF, cate o pagina
  // pe lucrare. Doar pozitiile cu T > 0, livrate integral: backend-ul scrie cate un rand AVIZ.
  // tokenBlocare: tab-ul care tine obiectivul (BlocareService). versiune: a raportului afisat --
  // 409 daca intre timp s-a schimbat ceva pe comenzile lui (o receptie, alt aviz...).
  genereazaAvizObiectiv(filtru: FiltruRaportObiectiv, versiune: number, tokenBlocare: string): Observable<Blob> {
    return this.http.post(`${this.config.apiUrl}/comenzi/pe-obiectiv/pdf`, null, {
      params: { ...paramsFiltru(filtru), versiune },
      headers: { [HEADER_TOKEN_BLOCARE]: tokenBlocare },
      responseType: 'blob',
    });
  }
}

const HEADER_VERSIUNE_RAPORT = 'X-Versiune-Raport';

export interface RaportObiectiv {
  comenzi: ComandaTermenRaport[];
  versiune: number;
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
