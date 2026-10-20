import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { Furnizor } from '../models/furnizor.model';

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
}
