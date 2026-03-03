import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouletteComponent } from './components/roulette.component';
import { PlacesManagerComponent } from './components/places-manager.component';
import { VisitLoggerComponent } from './components/visit-logger.component';

type Tab = 'roulette' | 'places' | 'visits';

@Component({
  selector: 'app-root',
  imports: [RouletteComponent, PlacesManagerComponent, VisitLoggerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  protected readonly activeTab = signal<Tab>('roulette');

  protected setActiveTab(tab: Tab): void {
    this.activeTab.set(tab);
  }
}
