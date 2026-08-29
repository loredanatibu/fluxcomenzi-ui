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

  // GET /api/comenzi/termen-3-zile-lucratoare -- comenzile cu termen de livrare
  // in urmatoarele 3 zile lucratoare, fiecare cu lucrarea si obiectivul aferent.
  getComenziTermen3ZileLucratoare(): Observable<ComandaTermenRaport[]> {
    return this.http.get<ComandaTermenRaport[]>(`${this.config.apiUrl}/comenzi/termen-3-zile-lucratoare`);
  }
}
