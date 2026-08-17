import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';
import { Task } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  constructor(
    private readonly http: HttpClient,
    private readonly config: RuntimeConfigService,
  ) {}

  // GET /api/tasks -- returns all active tasks (VersionedCrudController#findActive).
  getAllTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.config.apiUrl}/tasks`);
  }
}
