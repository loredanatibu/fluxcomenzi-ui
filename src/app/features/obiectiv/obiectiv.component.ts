import { Component, OnInit, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { LucrareService } from '../../core/services/lucrare.service';
import { ObjectiveService } from '../../core/services/obiectiv.service';
import { Obiectiv } from '../../core/models/obiectiv.model';

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [NgIf, NgFor, ReactiveFormsModule],
  templateUrl: './task-form.component.html',
  styleUrl: './task-form.component.scss',
})
export class TaskFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly objectives = signal<Obiectiv[]>([]);
  readonly isLoadingObjectives = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly form = this.fb.group({
    idObiectiv: [null as number | null, Validators.required],
    nume: ['', Validators.required],
  });

  constructor(
    readonly authService: AuthService,
    private readonly lucrareService: LucrareService,
    private readonly objectiveService: ObjectiveService,
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }
    this.loadObjectives();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    const { idObiectiv, nume } = this.form.getRawValue();

    this.lucrareService.create({ idObiectiv: idObiectiv!, nume: nume! }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set('Lucrarea a fost salvată.');
        this.form.reset();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Lucrarea nu a putut fi salvată.');
      },
    });
  }

  private loadObjectives(): void {
    this.isLoadingObjectives.set(true);

    this.objectiveService.getAll().subscribe({
      next: (objectives) => {
        this.objectives.set(objectives);
        this.isLoadingObjectives.set(false);
      },
      error: () => {
        this.isLoadingObjectives.set(false);
        this.errorMessage.set('Nu s-au putut încărca obiectivele.');
      },
    });
  }
}
