import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { TaskListComponent } from './features/tasks/task-list.component';
import { PlaceholderComponent } from './features/placeholder/placeholder.component';

// Rendered inside <router-outlet>, below the nav bar in AppComponent, which
// stays outside the outlet so options 1-4 are reachable from any route.
export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'obiective', component: TaskListComponent }, // option 1
  { path: 'optiune-2', component: PlaceholderComponent, data: { optionNumber: 2 } },
  { path: 'optiune-3', component: PlaceholderComponent, data: { optionNumber: 3 } },
  { path: 'optiune-4', component: PlaceholderComponent, data: { optionNumber: 4 } },
  { path: '**', redirectTo: '' },
];
