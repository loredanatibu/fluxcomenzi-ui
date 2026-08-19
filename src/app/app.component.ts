import { Component, HostListener } from '@angular/core';
import { NgIf } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { NavComponent } from './features/nav/nav.component';
import { LoginComponent } from './features/login/login.component';
import { SessionExpiredDialogComponent } from './features/session-expired/session-expired-dialog.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, RouterOutlet, NavComponent, LoginComponent, SessionExpiredDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  constructor(readonly authService: AuthService, router: Router) {
    // Catches an expired token on any navigation, in addition to the
    // click/keydown listeners below -- covers browser back/forward too.
    router.events.subscribe(() => this.authService.checkTokenExpiry());
  }

  // Checked on any user interaction, not only when it happens to trigger a
  // backend call, so an expired session surfaces the dialog right away.
  @HostListener('document:click')
  @HostListener('document:keydown')
  onUserActivity(): void {
    this.authService.checkTokenExpiry();
  }
}
