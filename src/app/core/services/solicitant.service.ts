import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { Solicitant } from '../models/solicitant.model';

@Injectable({ providedIn: 'root' })
export class SolicitantService {
  constructor(
    private readonly http: HttpClient,
    private readonly config: RuntimeConfigService,
  ) {}

  // Fetched once per app session: the first subscriber triggers GET /api/solicitanti, every
  // later one (including after navigating away and back) gets the same cached list.
  // A failed request isn't cached, so the next call retries.
  private cache$?: Observable<Solicitant[]>;

  // GET /api/solicitanti -- the full lookup list behind the Solicitant combobox.
  getAll(): Observable<Solicitant[]> {
    this.cache$ ??= this.http.get<Solicitant[]>(`${this.config.apiUrl}/solicitanti`).pipe(
      catchError((err) => {
        this.cache$ = undefined;
        return throwError(() => err);
      }),
      shareReplay(1),
    );
    return this.cache$;
  }
}
