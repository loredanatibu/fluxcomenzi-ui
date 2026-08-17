import { Component } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavComponent } from './features/nav/nav.component';
import { LoginComponent } from './features/login/login.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, RouterOutlet, NavComponent, LoginComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  constructor(readonly authService: AuthService) {}
}
