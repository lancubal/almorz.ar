import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { UserSetupComponent } from './components/user-setup.component';
import { UserService } from './services/user.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UserSetupComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  protected readonly currentUser = this.userService.currentUser;
  protected readonly userIsReady = this.userService.isReady;
  protected readonly isAdminRoute = toSignal(
    this.router.events.pipe(map(() => this.router.url.startsWith('/admin'))),
    { initialValue: this.router.url.startsWith('/admin') },
  );

  protected logout(): void {
    this.userService.logout();
  }
}
