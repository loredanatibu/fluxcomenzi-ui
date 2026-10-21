import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { RaportService } from '../../core/services/raport.service';
import { ComandaTermenRaport } from '../../core/models/comanda-termen-raport.model';

type RaportType = 'nelivrate' | 'termen-3-zile';

@Component({
  selector: 'app-rapoarte',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './raport.component.html',
  styleUrl: './raport.component.scss',
})
export class RaportComponent {
  private readonly raportService = inject(RaportService);

  readonly activeReport = signal<RaportType | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly rows = signal<ComandaTermenRaport[]>([]);

  constructor(readonly authService: AuthService) {}

  selectReport(report: RaportType): void {
    if (this.activeReport() === report) return;

    this.activeReport.set(report);
    this.errorMessage.set(null);
    this.rows.set([]);
    this.loadReport(report);
  }

  private loadReport(report: RaportType): void {
    const request =
      report === 'nelivrate'
        ? this.raportService.getComenziNelivrate()
        : this.raportService.getComenziTermen3ZileLucratoare();

    this.isLoading.set(true);
    request.subscribe({
      next: (list) => {
        // A slower response for a report the user already switched away from is dropped.
        if (this.activeReport() !== report) return;
        this.rows.set(list);
        this.isLoading.set(false);
      },
      error: () => {
        if (this.activeReport() !== report) return;
        this.isLoading.set(false);
        this.errorMessage.set('Raportul nu a putut fi încărcat.');
      },
    });
  }
}
