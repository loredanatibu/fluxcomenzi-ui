import { Component, inject, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ObjectiveService } from '../../core/services/obiectiv.service';

@Component({
  selector: 'app-obiectiv',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule],
  templateUrl: './obiectiv.component.html',
  styleUrl: './obiectiv.component.scss',
})
export class ObiectivComponent {
  private readonly fb = inject(FormBuilder);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly form = this.fb.group({
    nume: ['', Validators.required],
    alias: [''],
    termenExecutie: [''],
    dataIncepere: [''],
  });

  constructor(readonly authService: AuthService, private readonly objectiveService: ObjectiveService) {}

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    const { nume, alias, termenExecutie, dataIncepere } = this.form.getRawValue();

    this.objectiveService
      .create({
        nume: nume!,
        alias: alias || null,
        termenExecutie: toIsoOrNull(termenExecutie),
        dataIncepere: toIsoOrNull(dataIncepere),
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.successMessage.set('Obiectivul a fost salvat.');
          this.form.reset();
        },
        error: () => {
          this.isSubmitting.set(false);
          this.errorMessage.set('Obiectivul nu a putut fi salvat.');
        },
      });
  }
}

function toIsoOrNull(value: string | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}
