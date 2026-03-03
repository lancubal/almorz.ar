import { inject, Injectable, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, switchMap, map, catchError, of, forkJoin } from 'rxjs';
import { Place, Visit, PlaceWithWeight, UserSettings, VisitEntry } from '../models/place.model';
import { UserService } from './user.service';

const API = 'http://localhost:3001';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly http = inject(HttpClient);
  private readonly userService = inject(UserService);

  // State signals
  private readonly placesSignal = signal<Place[]>([]);
  private readonly lastSelectedIdSignal = signal<string | null>(null);
  private readonly antiRepeatDaysSignal = signal(5);
  private readonly userBlacklistSignal = signal<Record<string, string>>({});
  readonly isLoading = signal(false);
  readonly apiError = signal(false);

  readonly antiRepeatDays = this.antiRepeatDaysSignal.asReadonly();
  /** Per-user blacklist: placeId → ISO expiry. Reactive signal updated on every change. */
  readonly userBlacklist = this.userBlacklistSignal.asReadonly();

  // Public readonly surfaces
  readonly places = this.placesSignal.asReadonly();
  readonly lastSelectedId = this.lastSelectedIdSignal.asReadonly();
  readonly placesWithWeights = computed(() => this.calculateWeights(this.placesSignal()));

  readonly totalVisits = computed(() =>
    this.placesSignal().reduce((sum, p) => sum + p.visits.length, 0)
  );
  /** Show the "✨ Nuevo" segment only once there's a meaningful visit history. */
  readonly showNuevoSegment = computed(() => this.totalVisits() >= 20);

  constructor() {
    this.loadPlaces();
    this.loadAppConfig();

    // React to user changes: load their per-user settings
    effect(() => {
      const user = this.userService.currentUser();
      if (user) {
        this.loadUserSettings(user.id);
      } else {
        this.lastSelectedIdSignal.set(null);
        this.userBlacklistSignal.set({});
      }
    });
  }

  // --- Data loading ---------------------------------------------------------

  private loadAppConfig(): void {
    this.http.get<{ id: string; antiRepeatDays: number }>(`${API}/appConfig/1`)
      .pipe(catchError(() => of(null)))
      .subscribe(cfg => {
        if (cfg?.antiRepeatDays != null) this.antiRepeatDaysSignal.set(cfg.antiRepeatDays);
      });
  }

  setAntiRepeatDays(days: number): Observable<void> {
    return this.http.patch(`${API}/appConfig/1`, { antiRepeatDays: days }).pipe(
      tap(() => this.antiRepeatDaysSignal.set(days)),
      map(() => void 0),
    );
  }

  private loadPlaces(): void {
    this.isLoading.set(true);
    this.http.get<Place[]>(`${API}/places`)
      .pipe(catchError(() => { this.apiError.set(true); return of([]); }))
      .subscribe(places => {
        this.isLoading.set(false);
        this.placesSignal.set(places.map(p => this.parsePlaceDates(p)));
      });
  }

  loadUserSettings(userId: string): void {
    this.http.get<UserSettings>(`${API}/settings/${userId}`).pipe(
      catchError(() =>
        this.http.post<UserSettings>(`${API}/settings`, { id: userId, lastSelectedId: null, blacklist: {} })
      ),
      catchError(() => of(null)),
    ).subscribe(s => {
      this.lastSelectedIdSignal.set(s?.lastSelectedId ?? null);
      this.userBlacklistSignal.set(s?.blacklist ?? {});
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

  // --- Place CRUD -------------------------------------------------------------

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

    const userId = this.userService.currentUser()?.id ?? 'unknown';
    const visit: Visit = { date: new Date(), cost, rating, userId };
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
    const userId = this.userService.currentUser()?.id;
    if (!userId) return of(void 0);
    return this.http.patch<UserSettings>(`${API}/settings/${userId}`, { lastSelectedId: id }).pipe(
      tap(() => this.lastSelectedIdSignal.set(id)),
      map(() => void 0),
    );
  }

  // --- Weight & selection logic ----------------------------------------------

  /** Places eligible for the normal spin (excludes last selected, user-blacklisted, and recent anti-repeat). */
  getEligiblePlaces(): PlaceWithWeight[] {
    const lastId = this.lastSelectedIdSignal();
    const now = new Date();
    const antiDays = this.antiRepeatDaysSignal();
    const cutoff = antiDays > 0 ? new Date(Date.now() - antiDays * 86_400_000) : null;
    const blacklist = this.userBlacklistSignal();
    return this.placesWithWeights().filter(p => {
      if (p.id === lastId) return false;
      if (p.weight <= 0) return false;
      if (blacklist[p.id] && new Date(blacklist[p.id]) > now) return false;
      if (cutoff && p.lastVisitDate && new Date(p.lastVisitDate) > cutoff) return false;
      return true;
    });
  }

  blacklistPlace(placeId: string, days: number): Observable<void> {
    const userId = this.userService.currentUser()?.id;
    if (!userId) return of(void 0);
    const until = new Date(Date.now() + days * 86_400_000).toISOString();
    const updated = { ...this.userBlacklistSignal(), [placeId]: until };
    return this.http.patch<UserSettings>(`${API}/settings/${userId}`, { blacklist: updated }).pipe(
      tap(() => this.userBlacklistSignal.set(updated)),
      map(() => void 0),
    );
  }

  removeFromBlacklist(placeId: string): Observable<void> {
    const userId = this.userService.currentUser()?.id;
    if (!userId) return of(void 0);
    const updated = { ...this.userBlacklistSignal() };
    delete updated[placeId];
    return this.http.patch<UserSettings>(`${API}/settings/${userId}`, { blacklist: updated }).pipe(
      tap(() => this.userBlacklistSignal.set(updated)),
      map(() => void 0),
    );
  }

  /** Places that have never been visited (by anyone) */
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

  /** Returns all visits for a given user, newest first */
  getMyVisits(userId: string): VisitEntry[] {
    return this.placesSignal()
      .flatMap(p =>
        p.visits
          .filter(v => v.userId === userId)
          .map(v => ({ placeName: p.name, placeId: p.id, visit: v }))
      )
      .sort((a, b) => new Date(b.visit.date).getTime() - new Date(a.visit.date).getTime());
  }

  // --- Weight calculation ---------------------------------------------------
  // Weights are global � based on visits from ALL users combined

  private calculateWeights(places: Place[]): PlaceWithWeight[] {
    const now = Date.now();
    return places.map(place => {
      let weight = 1;

      // Rating: higher is better (range ~0.2�2.0)
      if (place.visits.length > 0) {
        const avgRating = place.visits.reduce((s, v) => s + v.rating, 0) / place.visits.length;
        weight *= avgRating / 5;
      }

      // Cost: cheaper is better
      if (place.visits.length > 0) {
        const avgCost = place.visits.reduce((s, v) => s + v.cost, 0) / place.visits.length;
        weight *= Math.max(0.5, Math.min(2, 3000 / (avgCost + 500)));
      }

      // Aging: longer not visited ? higher weight (capped at 3�)
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

