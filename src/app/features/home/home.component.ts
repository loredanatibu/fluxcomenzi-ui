import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: true,
  template: `
    <div class="home">
      <p>Alege una dintre opțiunile 1-4 din meniu.</p>
    </div>
  `,
  styles: [
    `
      .home {
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class HomeComponent {}
