import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, shareReplay, tap, throwError } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { Solicitant, SolicitantInput } from '../models/solicitant.model';

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

  // POST /api/solicitanti -- adds a solicitant (from Nomenclatoare). The cached list is dropped so
  // the comboboxes pick it up on their next getAll().
  create(solicitant: SolicitantInput): Observable<Solicitant> {
    return this.http.post<Solicitant>(`${this.config.apiUrl}/solicitanti`, solicitant).pipe(tap(() => (this.cache$ = undefined)));
  }

  // DELETE /api/solicitanti/{id} -- soft delete: the backend sets activ=false, so the solicitant
  // drops out of GET /api/solicitanti. 409 (as plain text) when comenzi still reference it.
  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.config.apiUrl}/solicitanti/${id}`)
      .pipe(tap(() => (this.cache$ = undefined)));
  }
}
