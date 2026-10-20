import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { Solicitant } from '../models/solicitant.model';

@Injectable({ providedIn: 'root' })
export class SolicitantService {
  constructor(
    private readonly http: HttpClient,
    private readonly config: RuntimeConfigService,
  ) {}

  // GET /api/solicitanti -- the full lookup list behind the Solicitant combobox.
  getAll(): Observable<Solicitant[]> {
    return this.http.get<Solicitant[]>(`${this.config.apiUrl}/solicitanti`);
  }
}
