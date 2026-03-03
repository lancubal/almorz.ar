import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
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

  protected readonly currentUser = this.userService.currentUser;
  protected readonly userIsReady = this.userService.isReady;

  protected logout(): void {
    this.userService.logout();
  }
}
