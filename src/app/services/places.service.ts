import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, switchMap, map, catchError, of, forkJoin } from 'rxjs';
import { Place, Visit, PlaceWithWeight } from '../models/place.model';

const API = 'http://localhost:3001';

interface Settings {
  id: string;
  lastSelectedId: string | null;
}

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly http = inject(HttpClient);

  // State signals
  private readonly placesSignal = signal<Place[]>([]);
  private readonly lastSelectedIdSignal = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly apiError = signal(false);

  // Public readonly surfaces
  readonly places = this.placesSignal.asReadonly();
  readonly lastSelectedId = this.lastSelectedIdSignal.asReadonly();
  readonly placesWithWeights = computed(() => this.calculateWeights(this.placesSignal()));

  constructor() {
    this.loadAll();
  }

  // â”€â”€â”€ Data loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  loadAll(): void {
    this.isLoading.set(true);
    forkJoin({
      places: this.http.get<Place[]>(`${API}/places`),
      settings: this.http.get<Settings>(`${API}/settings/1`),
    })
      .pipe(catchError(() => { this.apiError.set(true); return of(null); }))
      .subscribe(result => {
        this.isLoading.set(false);
        if (!result) return;
        this.placesSignal.set(result.places.map(p => this.parsePlaceDates(p)));
        this.lastSelectedIdSignal.set(result.settings?.lastSelectedId ?? null);
      });
  }

  private refreshPlaces(): Observable<void> {
    return this.http.get<Place[]>(`${API}/places`).pipe(
      tap(places => this.placesSignal.set(places.map(p => this.parsePlaceDates(p)))),
      map(() => void 0),
    );
  }

  private parsePlaceDates(p: Place): Place {
    return {
      ...p,
      createdAt: new Date(p.createdAt),
      lastVisitDate: p.lastVisitDate ? new Date(p.lastVisitDate) : null,
      visits: p.visits.map(v => ({ ...v, date: new Date(v.date) })),
    };
  }

  // â”€â”€â”€ Place CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  addPlace(name: string, tags: string[]): Observable<void> {
    const newPlace: Place = {
      id: crypto.randomUUID(),
      name,
      tags,
      visits: [],
      lastVisitDate: null,
      createdAt: new Date(),
    };
    return this.http.post<Place>(`${API}/places`, newPlace).pipe(
      switchMap(() => this.refreshPlaces()),
    );
  }

  updatePlace(id: string, name: string, tags: string[]): Observable<void> {
    const existing = this.placesSignal().find(p => p.id === id);
    if (!existing) return of(void 0);
    return this.http.put<Place>(`${API}/places/${id}`, { ...existing, name, tags }).pipe(
      switchMap(() => this.refreshPlaces()),
    );
  }

  deletePlace(id: string): Observable<void> {
    return this.http.delete(`${API}/places/${id}`).pipe(
      tap(() => {
        if (this.lastSelectedIdSignal() === id) this.setLastSelected(null).subscribe();
      }),
      switchMap(() => this.refreshPlaces()),
      map(() => void 0),
    );
  }

  addVisit(placeId: string, cost: number, rating: number): Observable<void> {
    const place = this.placesSignal().find(p => p.id === placeId);
    if (!place) return of(void 0);

    const visit: Visit = { date: new Date(), cost, rating };
    const updated: Place = {
      ...place,
      visits: [...place.visits, visit],
      lastVisitDate: visit.date,
    };
    return this.http.put<Place>(`${API}/places/${placeId}`, updated).pipe(
      switchMap(() => this.refreshPlaces()),
    );
  }

  setLastSelected(id: string | null): Observable<void> {
    return this.http.patch<Settings>(`${API}/settings/1`, { lastSelectedId: id }).pipe(
      tap(() => this.lastSelectedIdSignal.set(id)),
      map(() => void 0),
    );
  }

  // â”€â”€â”€ Weight & selection logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /** Places eligible for the normal spin (excludes last selected) */
  getEligiblePlaces(): PlaceWithWeight[] {
    const lastId = this.lastSelectedIdSignal();
    return this.placesWithWeights().filter(p => p.id !== lastId && p.weight > 0);
  }

  /** Places that have never been visited */
  getUnvisitedPlaces(): PlaceWithWeight[] {
    return this.placesWithWeights().filter(p => p.visits.length === 0);
  }

  /** Pick a random place for a normal spin */
  selectRandomPlace(): PlaceWithWeight | null {
    let pool = this.getEligiblePlaces();
    if (pool.length === 0) pool = this.placesWithWeights();
    return this.selectFromWeighted(pool);
  }

  /** Pick a random place for a "Nuevo" spin (unvisited first, fallback to eligible) */
  selectNewPlace(): { place: PlaceWithWeight; wasUnvisited: boolean } | null {
    const unvisited = this.getUnvisitedPlaces();
    const pool = unvisited.length > 0 ? unvisited : this.getEligiblePlaces();
    if (pool.length === 0) return null;
    const place = this.selectFromWeighted(pool);
    if (!place) return null;
    return { place, wasUnvisited: unvisited.length > 0 };
  }

  selectFromWeighted(places: PlaceWithWeight[]): PlaceWithWeight | null {
    if (places.length === 0) return null;
    const totalWeight = places.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    for (const place of places) {
      random -= place.weight;
      if (random <= 0) return place;
    }
    return places[places.length - 1];
  }

  // â”€â”€â”€ Weight calculation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private calculateWeights(places: Place[]): PlaceWithWeight[] {
    const now = Date.now();
    return places.map(place => {
      let weight = 1;

      // Rating: higher is better (range ~0.2â€“2.0)
      if (place.visits.length > 0) {
        const avgRating = place.visits.reduce((s, v) => s + v.rating, 0) / place.visits.length;
        weight *= avgRating / 5;
      }

      // Cost: cheaper is better
      if (place.visits.length > 0) {
        const avgCost = place.visits.reduce((s, v) => s + v.cost, 0) / place.visits.length;
        weight *= Math.max(0.5, Math.min(2, 3000 / (avgCost + 500)));
      }

      // Aging: longer not visited â†’ higher weight (capped at 3Ã—)
      if (place.lastVisitDate) {
        const daysSince = (now - new Date(place.lastVisitDate).getTime()) / 86_400_000;
        weight *= Math.min(1 + (daysSince / 7) * 0.2, 3);
      } else {
        const daysSinceCreation = (now - new Date(place.createdAt).getTime()) / 86_400_000;
        weight *= 1.5 + (daysSinceCreation / 7) * 0.3;
      }

      return { ...place, weight: Math.max(0.1, weight) };
    });
  }
}
