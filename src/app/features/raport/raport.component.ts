import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { RaportService } from '../../core/services/raport.service';
import { ComandaTermenRaport } from '../../core/models/comanda-termen-raport.model';

type RaportType = 'termen-3-zile';

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
    this.loadTermen3Zile();
  }

  private loadTermen3Zile(): void {
    this.isLoading.set(true);
    this.raportService.getComenziTermen3ZileLucratoare().subscribe({
      next: (list) => {
        this.rows.set(list);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Raportul nu a putut fi încărcat.');
      },
    });
  }
}
