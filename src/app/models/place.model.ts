export interface User {
  id: string;          // slug: "agustin", "mica"
  displayName: string;
  createdAt: string;
}

export interface UserSettings {
  id: string;          // = userId
  lastSelectedId: string | null;
}

export interface Place {
  id: string;
  name: string;
  tags: string[];
  visits: Visit[];
  lastVisitDate: Date | null;
  createdAt: Date;
  /** ISO date string — place is excluded from the wheel until this date. */
  blacklistedUntil?: string | null;
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
