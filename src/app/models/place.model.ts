export interface User {
  id: string;          // slug: "agustin", "mica"
  displayName: string;
  createdAt: string;
}

export interface UserSettings {
  id: string;          // = userId
  lastSelectedId: string | null;
  /** placeId → ISO expiry date. Place is excluded from this user's wheel until that date. */
  blacklist?: Record<string, string>;
}

export interface Place {
  id: string;
  name: string;
  tags: string[];
  visits: Visit[];
  lastVisitDate: Date | null;
  createdAt: Date;
  /** Google Maps data — optional (backward-compatible with existing places) */
  lat?: number;
  lng?: number;
  address?: string;
  googlePlaceId?: string;
}

/** Extracted from Google Places Autocomplete / Nearby Search */
export interface PlaceLocation {
  lat: number;
  lng: number;
  address: string;
  googlePlaceId: string;
}

export interface Visit {
  date: Date;
  cost: number;
  rating: number; // 1-10
  userId: string;
}

export interface PlaceWithWeight extends Place {
  weight: number;
}

export interface VisitEntry {
  placeName: string;
  placeId: string;
  visit: Visit;
}
