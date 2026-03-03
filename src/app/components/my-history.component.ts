import { Component, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
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

  protected readonly showGlobal = signal(false);

  protected readonly entries = computed(() => {
    if (this.showGlobal()) return this.placesService.getAllVisits();
    const userId = this.userService.currentUser()?.id;
    if (!userId) return [];
    return this.placesService.getMyVisits(userId);
  });

  protected readonly avgRating = computed(() => {
    const list = this.entries();
    if (list.length === 0) return '—';
    return (list.reduce((s, e) => s + e.visit.rating, 0) / list.length).toFixed(1);
  });

  protected readonly avgCost = computed(() => {
    const list = this.entries();
    if (list.length === 0) return '—';
    return Math.round(list.reduce((s, e) => s + e.visit.cost, 0) / list.length).toLocaleString('es-AR');
  });

  protected readonly totalSpent = computed(() => {
    const list = this.entries();
    if (list.length === 0) return '—';
    return list.reduce((s, e) => s + e.visit.cost, 0).toLocaleString('es-AR');
  });

  protected userName(userId: string): string {
    return this.userService.usersMap()[userId] ?? userId;
  }

  protected ratingBarWidth(rating: number): number {
    return (rating / 10) * 100;
  }

  protected ratingColor(rating: number): string {
    if (rating >= 8) return '#22c55e';
    if (rating >= 5) return '#f59e0b';
    return '#ef4444';
  }

  protected formatShortDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
    });
  }
}
