import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { map } from 'rxjs';

// Stand-in view for options 2-4, which have no defined content yet.
@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [AsyncPipe],
  template: ` <p class="placeholder">Opțiunea {{ optionNumber$ | async }} — conținut în lucru.</p> `,
  styles: [
    `
      .placeholder {
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class PlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  readonly optionNumber$ = this.route.data.pipe(map((data) => data['optionNumber']));
}
