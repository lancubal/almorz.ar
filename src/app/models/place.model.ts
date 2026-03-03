export interface Place {
  id: string;
  name: string;
  tags: string[];
  visits: Visit[];
  lastVisitDate: Date | null;
  createdAt: Date;
}

export interface Visit {
  date: Date;
  cost: number;
  rating: number; // 1-10
}

export interface PlaceWithWeight extends Place {
  weight: number;
}
