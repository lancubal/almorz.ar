import { Injectable, NgZone, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface NearbyResult {
  name: string;
  address: string;
  placeId: string;
  lat: number;
  lng: number;
}

@Injectable({ providedIn: 'root' })
export class MapsService {
  private readonly zone = inject(NgZone);

  readonly apiKey = environment.googleMapsApiKey;
  readonly configured = environment.googleMapsApiKey !== 'YOUR_GOOGLE_MAPS_API_KEY';

  readonly ready = signal(false);

  constructor() {
    if (!this.configured) return;
    if (typeof google !== 'undefined' && (google as any).maps) {
      this.ready.set(true);
      return;
    }
    this.loadScript();
  }

  private loadScript(): void {
    const callbackName = '__gmCb_' + Date.now();
    (window as Record<string, unknown>)[callbackName] = () => {
      this.zone.run(() => this.ready.set(true));
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  /** Find restaurants within `radius` metres of a point, excluding names already known. */
  getNearbyRestaurants(
    lat: number,
    lng: number,
    excludeNames: string[],
    radius = 500,
  ): Promise<NearbyResult[]> {
    if (!this.ready()) return Promise.resolve([]);

    const container = document.createElement('div');
    const service = new google.maps.places.PlacesService(container);
    const excluded = new Set(excludeNames.map(n => n.toLowerCase()));

    return new Promise(resolve => {
      service.nearbySearch(
        { location: { lat, lng }, radius, type: 'restaurant' },
        (results, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
            resolve([]);
            return;
          }
          resolve(
            results
              .filter(r => r.name && !excluded.has(r.name.toLowerCase()))
              .slice(0, 10)
              .map(r => ({
                name: r.name!,
                address: r.vicinity ?? r.formatted_address ?? '',
                placeId: r.place_id ?? '',
                lat: r.geometry!.location!.lat(),
                lng: r.geometry!.location!.lng(),
              })),
          );
        },
      );
    });
  }
}
