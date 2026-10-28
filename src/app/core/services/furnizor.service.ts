import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, shareReplay, tap, throwError } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { Furnizor, FurnizorInput } from '../models/furnizor.model';

@Injectable({ providedIn: 'root' })
export class FurnizorService {
  constructor(
    private readonly http: HttpClient,
    private readonly config: RuntimeConfigService,
  ) {}

  // Fetched once per app session: the first subscriber triggers GET /api/furnizori, every
  // later one (including after navigating away and back) gets the same cached list.
  // A failed request isn't cached, so the next call retries.
  private cache$?: Observable<Furnizor[]>;

  // GET /api/furnizori -- the full lookup list behind the Furnizor combobox.
  getAll(): Observable<Furnizor[]> {
    this.cache$ ??= this.http.get<Furnizor[]>(`${this.config.apiUrl}/furnizori`).pipe(
      catchError((err) => {
        this.cache$ = undefined;
        return throwError(() => err);
      }),
      shareReplay(1),
    );
    return this.cache$;
  }

  // POST /api/furnizori -- adds a furnizor (from Nomenclatoare). The cached list is dropped so
  // the comboboxes pick it up on their next getAll().
  create(furnizor: FurnizorInput): Observable<Furnizor> {
    return this.http.post<Furnizor>(`${this.config.apiUrl}/furnizori`, furnizor).pipe(tap(() => (this.cache$ = undefined)));
  }

  // DELETE /api/furnizori/{id} -- soft delete: the backend sets activ=false, so the furnizor
  // drops out of GET /api/furnizori. 409 (as plain text) when comenzi still reference it.
  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.config.apiUrl}/furnizori/${id}`)
      .pipe(tap(() => (this.cache$ = undefined)));
  }
}
