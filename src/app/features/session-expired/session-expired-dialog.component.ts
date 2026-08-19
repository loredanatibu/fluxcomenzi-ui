import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-session-expired-dialog',
  standalone: true,
  templateUrl: './session-expired-dialog.component.html',
  styleUrl: './session-expired-dialog.component.scss',
})
export class SessionExpiredDialogComponent {
  constructor(private readonly authService: AuthService) {}

  close(): void {
    this.authService.acknowledgeSessionExpired();
  }
}
