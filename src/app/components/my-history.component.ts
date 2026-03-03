import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { PlacesService } from '../services/places.service';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-my-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-history.component.html',
  styleUrl: './my-history.component.css',
})
export class MyHistoryComponent {
  private readonly placesService = inject(PlacesService);
  private readonly userService = inject(UserService);

  protected readonly entries = computed(() => {
    const userId = this.userService.currentUser()?.id;
    if (!userId) return [];
    return this.placesService.getMyVisits(userId);
  });

  protected readonly avgRating = computed(() => {
    const list = this.entries();
    if (list.length === 0) return '—';
    const avg = list.reduce((s, e) => s + e.visit.rating, 0) / list.length;
    return avg.toFixed(1);
  });

  protected readonly avgCost = computed(() => {
    const list = this.entries();
    if (list.length === 0) return '—';
    const avg = list.reduce((s, e) => s + e.visit.cost, 0) / list.length;
    return Math.round(avg).toLocaleString('es-AR');
  });

  protected formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
