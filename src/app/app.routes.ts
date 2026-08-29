import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { ObiectivComponent } from './features/obiectiv/obiectiv.component';
import { LucrareComponent } from './features/lucrare/lucrare.component';
import { ComandaComponent } from './features/comanda/comanda.component';
import { RaportComponent } from './features/raport/raport.component';
import { authGuard } from './core/guards/auth.guard';

// Rendered inside <router-outlet>, below the nav bar in AppComponent, which
// stays outside the outlet so options 1-4 are reachable from any route.
// Options 1-4 require authentication; authGuard redirects to '' otherwise.
export const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'obiective',
    component: ObiectivComponent,
    canActivate: [authGuard] },
  {
    path: 'lucrari',
    component: LucrareComponent,
    canActivate: [authGuard],
  },
  {
    path: 'comenzi',
    component: ComandaComponent,
    canActivate: [authGuard],
  },
  {
    path: 'rapoarte',
    component: RaportComponent,
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
