import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { Agent } from '../models/agent.model';

@Injectable({ providedIn: 'root' })
export class AgentService {
  constructor(
    private readonly http: HttpClient,
    private readonly config: RuntimeConfigService,
  ) {}

  // Fetched once per app session: the first subscriber triggers GET /api/agenti, every
  // later one (including after navigating away and back) gets the same cached list.
  // A failed request isn't cached, so the next call retries.
  private cache$?: Observable<Agent[]>;

  // GET /api/agenti -- the full lookup list behind the Agent combobox.
  getAll(): Observable<Agent[]> {
    this.cache$ ??= this.http.get<Agent[]>(`${this.config.apiUrl}/agenti`).pipe(
      catchError((err) => {
        this.cache$ = undefined;
        return throwError(() => err);
      }),
      shareReplay(1),
    );
    return this.cache$;
  }
}
