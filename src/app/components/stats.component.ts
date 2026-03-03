import { Component, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { PlacesService } from '../services/places.service';
import { UserService } from '../services/user.service';

interface MonthBar { label: string; total: number; }
interface PlaceStat { name: string; count: number; avgRating: number; avgCost: number; }
interface TagStat { tag: string; avgRating: number; count: number; }

@Component({
  selector: 'app-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css',
})
export class StatsComponent {
  private readonly placesService = inject(PlacesService);
  private readonly userService = inject(UserService);

  protected readonly showGlobal = signal(false);

  protected readonly entries = computed(() => {
    if (this.showGlobal()) return this.placesService.getAllVisits();
    const userId = this.userService.currentUser()?.id;
    if (!userId) return [];
    return this.placesService.getMyVisits(userId);
  });

  protected readonly summary = computed(() => {
    const list = this.entries();
    if (list.length === 0) return null;
    const totalCost = list.reduce((s, e) => s + e.visit.cost, 0);
    const avgRating = list.reduce((s, e) => s + e.visit.rating, 0) / list.length;
    return {
      count: list.length,
      avgRating: avgRating.toFixed(1),
      avgCost: Math.round(totalCost / list.length).toLocaleString('es-AR'),
      totalCost: totalCost.toLocaleString('es-AR'),
    };
  });

  /** Monthly spend for the last 6 months */
  protected readonly monthlySpend = computed((): MonthBar[] => {
    const now = new Date();
    const orderedKeys: string[] = [];
    const labels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      orderedKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      labels.push(d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }));
    }
    const totals: Record<string, number> = {};
    for (const k of orderedKeys) totals[k] = 0;
    for (const e of this.entries()) {
      const d = new Date(e.visit.date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (k in totals) totals[k] += e.visit.cost;
    }
    return orderedKeys.map((k, i) => ({ label: labels[i], total: totals[k] }));
  });

  protected readonly maxMonthlySpend = computed(() =>
    Math.max(...this.monthlySpend().map(b => b.total), 1)
  );

  /** Top 5 places by visit count, includes avg rating and avg cost */
  protected readonly topPlaces = computed((): PlaceStat[] => {
    const map = new Map<string, { name: string; ratings: number[]; costs: number[] }>();
    for (const e of this.entries()) {
      if (!map.has(e.placeId)) map.set(e.placeId, { name: e.placeName, ratings: [], costs: [] });
      map.get(e.placeId)!.ratings.push(e.visit.rating);
      map.get(e.placeId)!.costs.push(e.visit.cost);
    }
    return [...map.values()]
      .map(p => ({
        name: p.name,
        count: p.ratings.length,
        avgRating: Math.round((p.ratings.reduce((s, r) => s + r, 0) / p.ratings.length) * 10) / 10,
        avgCost: Math.round(p.costs.reduce((s, c) => s + c, 0) / p.costs.length),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  protected readonly maxTopCount = computed(() =>
    this.topPlaces().length > 0 ? this.topPlaces()[0].count : 1
  );

  /** Average rating per tag, sorted best-first */
  protected readonly tagStats = computed((): TagStat[] => {
    const places = this.placesService.places();
    const map = new Map<string, number[]>();
    for (const e of this.entries()) {
      const place = places.find(p => p.id === e.placeId);
      for (const tag of (place?.tags ?? [])) {
        if (!map.has(tag)) map.set(tag, []);
        map.get(tag)!.push(e.visit.rating);
      }
    }
    return [...map.entries()]
      .map(([tag, ratings]) => ({
        tag,
        avgRating: Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10,
        count: ratings.length,
      }))
      .sort((a, b) => b.avgRating - a.avgRating);
  });

  protected ratingColor(rating: number): string {
    if (rating >= 8) return '#22c55e';
    if (rating >= 5) return '#f59e0b';
    return '#ef4444';
  }

  protected barPct(value: number, max: number): number {
    return max > 0 ? Math.max((value / max) * 100, 2) : 0;
  }

  protected formatCost(n: number): string {
    return n.toLocaleString('es-AR');
  }
}
