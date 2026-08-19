import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { TaskFormComponent } from './features/tasks/task-form.component';
import { PlaceholderComponent } from './features/placeholder/placeholder.component';
import { authGuard } from './core/guards/auth.guard';

// Rendered inside <router-outlet>, below the nav bar in AppComponent, which
// stays outside the outlet so options 1-4 are reachable from any route.
// Options 1-4 require authentication; authGuard redirects to '' otherwise.
export const routes: Routes = [
  { path: '', component: HomeComponent },
  { 
    path: 'obiectiv-nou', 
    component: TaskFormComponent, 
    canActivate: [authGuard] }, // option 1
  {
    path: 'comenzi',
    component: PlaceholderComponent,
    data: { optionNumber: 2 },
    canActivate: [authGuard],
  },
  {
    path: 'rapoarte',
    component: PlaceholderComponent,
    data: { optionNumber: 3 },
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
