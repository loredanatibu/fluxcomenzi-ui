import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [NgFor, RouterLink, RouterLinkActive],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss',
})
export class NavComponent {
  readonly options = [
    { label: '1', route: '/obiective' },
    { label: '2', route: '/optiune-2' },
    { label: '3', route: '/optiune-3' },
    { label: '4', route: '/optiune-4' },
  ];
}
