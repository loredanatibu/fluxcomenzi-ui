import { Component, inject } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [NgFor, RouterLink, RouterLinkActive],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss',
})
export class NavComponent {
  private readonly authService = inject(AuthService);

  readonly isAuthenticated = this.authService.isAuthenticated;

  readonly options = [
    { label: 'Lucrare noua', route: '/obiective' },
    { label: '2', route: '/optiune-2' },
    { label: '3', route: '/optiune-3' },
    { label: '4', route: '/optiune-4' },
  ];
}
