import { Component, OnInit, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { TaskService } from '../../core/services/task.service';
import { Task } from '../../core/models/task.model';

interface Column {
  header: string;
  value: (task: Task) => string | number;
}

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [NgIf, NgFor],
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.scss',
})
export class TaskListComponent implements OnInit {
  // Extend this list as more columns are needed -- no template changes required.
  readonly columns: Column[] = [
    { header: 'ID', value: (task) => task.id },
    { header: 'Nume Obiectiv', value: (task) => task.name },
  ];

  readonly tasks = signal<Task[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    readonly authService: AuthService,
    private readonly taskService: TaskService,
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }
    this.loadTasks();
  }

  private loadTasks(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.taskService.getAllTasks().subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Nu s-au putut încărca task-urile.');
      },
    });
  }
}
