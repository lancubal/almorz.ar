import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import { User } from '../models/place.model';

const API = 'http://localhost:3001';
const STORAGE_KEY = 'almorz-userId';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  private readonly currentUserSignal = signal<User | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  /** true once the initial localStorage check is resolved */
  readonly isReady = signal(false);

  constructor() {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      this.http.get<User>(`${API}/users/${savedId}`)
        .pipe(catchError(() => of(null)))
        .subscribe(user => {
          this.currentUserSignal.set(user);
          this.isReady.set(true);
        });
    } else {
      this.isReady.set(true);
    }
  }

  login(displayName: string): Observable<User> {
    const id = displayName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    return this.http.get<User>(`${API}/users/${id}`).pipe(
      catchError(() => {
        const newUser: User = {
          id,
          displayName: displayName.trim(),
          createdAt: new Date().toISOString(),
        };
        return this.http.post<User>(`${API}/users`, newUser);
      }),
      tap(user => {
        this.currentUserSignal.set(user);
        localStorage.setItem(STORAGE_KEY, user.id);
      }),
    );
  }

  /** Select an already-known user directly (no slugification needed). */
  loginWithUser(user: User): void {
    this.currentUserSignal.set(user);
    localStorage.setItem(STORAGE_KEY, user.id);
  }

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(`${API}/users`).pipe(catchError(() => of([])));
  }

  logout(): void {
    this.currentUserSignal.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }
}
