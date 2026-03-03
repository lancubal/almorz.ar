import { Routes } from '@angular/router';
import { RouletteComponent } from './components/roulette.component';
import { VisitLoggerComponent } from './components/visit-logger.component';
import { MyHistoryComponent } from './components/my-history.component';
import { PlacesManagerComponent } from './components/places-manager.component';
import { AdminComponent } from './components/admin.component';
import { StatsComponent } from './components/stats.component';

export const routes: Routes = [
  { path: '',        component: RouletteComponent },
  { path: 'visits',  component: VisitLoggerComponent },
  { path: 'history', component: MyHistoryComponent },
  { path: 'stats',   component: StatsComponent },
  { path: 'places',  component: PlacesManagerComponent },
  { path: 'admin',   component: AdminComponent },
  { path: '**',      redirectTo: '' },
];
