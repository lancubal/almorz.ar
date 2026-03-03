// ─── Change this PIN to something only you know ──────────────────────────────
const ADMIN_PIN = '1234';
// ─────────────────────────────────────────────────────────────────────────────

import { Component, signal, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlacesManagerComponent } from './places-manager.component';
import { PlacesService } from '../services/places.service';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-admin',
  imports: [ReactiveFormsModule, PlacesManagerComponent, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent {
  private readonly placesService = inject(PlacesService);
  private readonly userService = inject(UserService);

  protected readonly isUnlocked = signal(false);
  protected readonly pinError = signal(false);
  protected readonly pinCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  protected readonly antiRepeatDays = this.placesService.antiRepeatDays;
  protected readonly antiRepeatOptions = [0, 1, 2, 3, 5, 7, 10, 14] as const;

  protected readonly userStats = computed(() => {
    const places = this.placesService.places();
    const statsMap = new Map<string, { displayName: string; visits: number; totalCost: number; totalRating: number }>();

    for (const place of places) {
      for (const visit of place.visits) {
        const uid = visit.userId ?? 'desconocido';
        const existing = statsMap.get(uid) ?? { displayName: uid, visits: 0, totalCost: 0, totalRating: 0 };
        statsMap.set(uid, {
          ...existing,
          visits: existing.visits + 1,
          totalCost: existing.totalCost + visit.cost,
          totalRating: existing.totalRating + visit.rating,
        });
      }
    }

    return Array.from(statsMap.values())
      .map(s => ({
        ...s,
        avgCost: s.visits > 0 ? Math.round(s.totalCost / s.visits) : 0,
        avgRating: s.visits > 0 ? (s.totalRating / s.visits).toFixed(1) : '—',
      }))
      .sort((a, b) => b.visits - a.visits);
  });

  protected readonly totalPlaces = computed(() => this.placesService.places().length);
  protected readonly totalVisits = computed(() =>
    this.placesService.places().reduce((s, p) => s + p.visits.length, 0)
  );

  protected readonly weightedPlaces = computed(() =>
    [...this.placesService.placesWithWeights()].sort((a, b) => b.weight - a.weight)
  );

  protected readonly maxWeight = computed(() => {
    const places = this.weightedPlaces();
    return places.length > 0 ? places[0].weight : 1;
  });

  protected readonly eligibleIds = computed(() =>
    new Set(this.placesService.getEligiblePlaces().map(p => p.id))
  );

  protected submitPin(): void {
    if (this.pinCtrl.value === ADMIN_PIN) {
      this.isUnlocked.set(true);
      this.pinError.set(false);
    } else {
      this.pinError.set(true);
      this.pinCtrl.setValue('');
    }
  }

  protected setAntiRepeatDays(days: number): void {
    this.placesService.setAntiRepeatDays(days).subscribe();
  }

  protected logout(): void {
    this.userService.logout();
  }
}
