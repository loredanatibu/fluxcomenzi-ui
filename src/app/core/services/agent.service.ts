import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, shareReplay, tap, throwError } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { Agent, AgentInput } from '../models/agent.model';

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

  // POST /api/agenti -- adds an agent (from Nomenclatoare). The cached list is dropped so
  // the comboboxes pick it up on their next getAll().
  create(agent: AgentInput): Observable<Agent> {
    return this.http.post<Agent>(`${this.config.apiUrl}/agenti`, agent).pipe(tap(() => (this.cache$ = undefined)));
  }

  // DELETE /api/agenti/{id} -- soft delete: the backend sets activ=false, so the agent
  // drops out of GET /api/agenti. 409 (as plain text) when comenzi still reference it.
  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.config.apiUrl}/agenti/${id}`)
      .pipe(tap(() => (this.cache$ = undefined)));
  }
}
