import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouletteComponent } from './components/roulette.component';
import { VisitLoggerComponent } from './components/visit-logger.component';
import { MyHistoryComponent } from './components/my-history.component';
import { AdminComponent } from './components/admin.component';
import { UserSetupComponent } from './components/user-setup.component';
import { UserService } from './services/user.service';

type Tab = 'roulette' | 'visits' | 'history' | 'admin';

@Component({
  selector: 'app-root',
  imports: [RouletteComponent, VisitLoggerComponent, MyHistoryComponent, AdminComponent, UserSetupComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  private readonly userService = inject(UserService);

  protected readonly currentUser = this.userService.currentUser;
  protected readonly userIsReady = this.userService.isReady;

  protected readonly activeTab = signal<Tab>('roulette');

  protected setActiveTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  protected onUserSetupDone(): void {
    // currentUser signal is already updated by UserService
  }

  protected logout(): void {
    this.userService.logout();
  }
}
