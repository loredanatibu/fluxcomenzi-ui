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
}
