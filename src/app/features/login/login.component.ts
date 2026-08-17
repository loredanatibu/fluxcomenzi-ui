import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly errorMessage = this.authService.loginError;
  readonly isSubmitting = signal(false);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.authService.reportLoginError(null);
    this.isSubmitting.set(true);

    this.authService.login(email!, password!).subscribe({
      next: () => this.isSubmitting.set(false),
      error: () => {
        this.isSubmitting.set(false);
        this.authService.reportLoginError('User sau parolă incorecte.');
      },
    });
  }
}
