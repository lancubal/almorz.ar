import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { PlacesService } from '../services/places.service';
import { UserService } from '../services/user.service';
import { PlaceWithWeight } from '../models/place.model';

const COLORS = [
  '#2563eb', // blue
  '#dc2626', // red
  '#059669', // emerald
  '#7c3aed', // violet
  '#d97706', // amber
  '#0891b2', // cyan
  '#db2777', // pink
  '#374151', // slate
  '#65a30d', // lime
  '#9333ea', // purple
  '#c2410c', // orange
  '#0d9488', // teal
  '#be185d', // rose
  '#4338ca', // indigo
  '#92400e', // brown
];

const NUEVO_COLOR = '#f59e0b';
const SPIN_DURATION_MS = 3500;
const NUEVO_PAUSE_MS = 1500;

type SpinState = 'idle' | 'spinning-normal' | 'nuevo-pause' | 'spinning-nuevo' | 'done';

interface WheelSegment {
  id: string;
  label: string;
  color: string;
  path: string;
  textX: number;
  textY: number;
  midAngle: number;
  textRotation: number;
  weight: number;
  isNuevo: boolean;
  place: PlaceWithWeight | null;
}

@Component({
  selector: 'app-roulette',
  templateUrl: './roulette.component.html',
  styleUrl: './roulette.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RouletteComponent {
  private readonly placesService = inject(PlacesService);
  private readonly userService = inject(UserService);

  // ─── State ────────────────────────────────────────────────────────────────
  protected readonly spinState = signal<SpinState>('idle');
  protected readonly wheelRotation = signal(0);
  protected readonly selectedPlace = signal<PlaceWithWeight | null>(null);
  protected readonly isNewPlace = signal(false);
  protected readonly activeTags = signal<string[]>([]);
  protected readonly tagFilterOpen = signal(false);

  protected readonly isSpinning = computed(
    () => this.spinState() === 'spinning-normal' || this.spinState() === 'spinning-nuevo',
  );
  protected readonly showNuevoBanner = computed(() => this.spinState() === 'nuevo-pause');
  protected readonly showResult = computed(() => this.spinState() === 'done');

  /** All unique tags across all places, sorted. */
  protected readonly allTags = computed(() => {
    const tags = new Set<string>();
    this.placesService.places().forEach(p => p.tags.forEach(t => tags.add(t)));
    return [...tags].sort();
  });

  private readonly filteredEligible = computed(() => {
    const eligible = this.placesService.getEligiblePlaces();
    const active = this.activeTags();
    if (active.length === 0) return eligible;
    return eligible.filter(p => p.tags.some(t => active.includes(t)));
  });

  protected readonly emptyReason = computed(() => {
    if (this.placesService.places().length === 0) return 'no-places';
    const eligible = this.placesService.getEligiblePlaces();
    if (eligible.length === 0) return 'all-excluded';
    if (this.filteredEligible().length === 0) return 'tag-filter';
    return null;
  });

  // ─── Wheel segments ───────────────────────────────────────────────────────
  protected readonly wheelSegments = computed<WheelSegment[]>(() => {
    const eligible = this.filteredEligible();
    if (eligible.length === 0) return [];

    const avgWeight = eligible.reduce((s, p) => s + p.weight, 0) / eligible.length;

    type Entry = { id: string; label: string; weight: number; isNuevo: boolean; place: PlaceWithWeight | null };
    const entries: Entry[] = [
      ...eligible.map(p => ({ id: p.id, label: p.name, weight: p.weight, isNuevo: false, place: p })),
      ...(this.placesService.showNuevoSegment()
        ? [{ id: 'nuevo', label: '✨ Nuevo', weight: avgWeight, isNuevo: true, place: null }]
        : []),
    ];

    const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
    const cx = 200, cy = 200, r = 188;
    let currentAngle = 0;

    return entries.map((entry, i) => {
      const segDeg = (entry.weight / totalWeight) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + segDeg;
      const midAngle = currentAngle + segDeg / 2;
      currentAngle = endAngle;

      const path = buildSlicePath(cx, cy, r, startAngle, endAngle);
      const textR = r * 0.58;
      const midRad = midAngle * (Math.PI / 180);
      const textX = cx + textR * Math.sin(midRad);
      const textY = cy - textR * Math.cos(midRad);

      // Radial rotation: text points outward along the radius.
      // Flip lower-half segments (+180°) so text is never upside-down.
      const textRotation = midAngle <= 180 ? midAngle - 90 : midAngle + 90;

      const MAX_CHARS = 16;
      const label = entry.label.length > MAX_CHARS
        ? entry.label.substring(0, MAX_CHARS - 1) + '…'
        : entry.label;

      return {
        id: entry.id,
        label,
        color: entry.isNuevo ? NUEVO_COLOR : COLORS[i % COLORS.length],
        path,
        textX,
        textY,
        midAngle,
        textRotation,
        weight: entry.weight,
        isNuevo: entry.isNuevo,
        place: entry.place,
      };
    });
  });

  // ─── Actions ─────────────────────────────────────────────────────────────
  protected spin(): void {
    if (this.spinState() !== 'idle' && this.spinState() !== 'done') return;

    const segments = this.wheelSegments();
    if (segments.length === 0) return;

    this.selectedPlace.set(null);
    this.isNewPlace.set(false);

    const winner = pickFromSegments(segments);
    this.animateTo(winner.midAngle);
    this.spinState.set('spinning-normal');

    setTimeout(() => {
      if (winner.isNuevo) {
        this.spinState.set('nuevo-pause');
        setTimeout(() => this.spinNuevo(), NUEVO_PAUSE_MS);
      } else {
        this.selectedPlace.set(winner.place);
        if (winner.place) this.placesService.setLastSelected(winner.place.id).subscribe();
        this.spinState.set('done');
      }
    }, SPIN_DURATION_MS);
  }

  private spinNuevo(): void {
    const active = this.activeTags();
    const allUnvisited = this.placesService.getUnvisitedPlaces();
    const unvisited = active.length === 0
      ? allUnvisited
      : allUnvisited.filter(p => p.tags.some(t => active.includes(t)));

    const eligible = this.filteredEligible();
    const pool = unvisited.length > 0 ? unvisited : eligible;

    if (pool.length === 0) {
      this.spinState.set('idle');
      return;
    }

    const place = this.placesService.selectFromWeighted(pool);
    if (!place) {
      this.spinState.set('idle');
      return;
    }

    // Find that place’s segment (same wheel) and spin to it
    const segments = this.wheelSegments();
    const target = segments.find(s => s.id === place.id) ?? segments[0];

    this.animateTo(target.midAngle);
    this.spinState.set('spinning-nuevo');

    setTimeout(() => {
      this.selectedPlace.set(place);
      this.isNewPlace.set(unvisited.length > 0);
      this.placesService.setLastSelected(place.id).subscribe();
      this.spinState.set('done');
    }, SPIN_DURATION_MS);
  }

  private animateTo(midAngle: number): void {
    const prev = this.wheelRotation();
    const currentWorldAngle = ((midAngle + prev) % 360 + 360) % 360;
    const alignExtra = (360 - currentWorldAngle) % 360;
    this.wheelRotation.set(prev + alignExtra + 5 * 360);
  }

  protected resetSpin(): void {
    this.spinState.set('idle');
    this.selectedPlace.set(null);
    this.isNewPlace.set(false);
  }

  protected toggleTag(tag: string): void {
    this.activeTags.update(current =>
      current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]
    );
  }

  protected blacklistAndRespin(placeId: string): void {
    this.placesService.blacklistPlace(placeId, 7).subscribe(() => this.resetSpin());
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  protected getAvgRating(place: PlaceWithWeight): number | null {
    if (place.visits.length === 0) return null;
    return place.visits.reduce((s, v) => s + v.rating, 0) / place.visits.length;
  }

  protected getAvgCost(place: PlaceWithWeight): number | null {
    if (place.visits.length === 0) return null;
    return place.visits.reduce((s, v) => s + v.cost, 0) / place.visits.length;
  }

  /** Per-user breakdown for the selected place, sorted by visit count desc. */
  protected readonly selectedPlaceUserStats = computed(() => {
    const place = this.selectedPlace();
    if (!place || place.visits.length === 0) return [];
    const usersMap = this.userService.usersMap();
    const currentUserId = this.userService.currentUser()?.id;
    const map = new Map<string, { ratings: number[]; costs: number[] }>();
    for (const v of place.visits) {
      if (!map.has(v.userId)) map.set(v.userId, { ratings: [], costs: [] });
      map.get(v.userId)!.ratings.push(v.rating);
      map.get(v.userId)!.costs.push(v.cost);
    }
    return [...map.entries()]
      .map(([userId, data]) => ({
        userId,
        displayName: usersMap[userId] ?? userId,
        isMe: userId === currentUserId,
        count: data.ratings.length,
        avgRating: Math.round(data.ratings.reduce((s, r) => s + r, 0) / data.ratings.length * 10) / 10,
        avgCost: Math.round(data.costs.reduce((s, c) => s + c, 0) / data.costs.length),
      }))
      .sort((a, b) => b.count - a.count);
  });

  protected ratingColor(rating: number): string {
    if (rating >= 8) return '#22c55e';
    if (rating >= 5) return '#f59e0b';
    return '#ef4444';
  }
}

// ─── Pure helpers (outside class) ─────────────────────────────────────────────

function toXY(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = angleDeg * (Math.PI / 180);
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

function buildSlicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [x1, y1] = toXY(cx, cy, r, startDeg);
  const [x2, y2] = toXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

function pickFromSegments(segments: WheelSegment[]): WheelSegment {
  const total = segments.reduce((s, seg) => s + seg.weight, 0);
  let rand = Math.random() * total;
  for (const seg of segments) {
    rand -= seg.weight;
    if (rand <= 0) return seg;
  }
  return segments[segments.length - 1];
}
