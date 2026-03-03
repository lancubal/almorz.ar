import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  viewChild,
  viewChildren,
  effect,
  OnInit,
} from '@angular/core';
import { GoogleMap, MapMarker, MapInfoWindow } from '@angular/google-maps';
import { Router, ActivatedRoute } from '@angular/router';
import { PlacesService } from '../services/places.service';
import { MapsService } from '../services/maps.service';
import { Place } from '../models/place.model';

@Component({
  selector: 'app-map',
  imports: [GoogleMap, MapMarker, MapInfoWindow],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map.component.html',
  styleUrl: './map.component.css',
})
export class MapComponent implements OnInit {
  private readonly placesService = inject(PlacesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly mapsService = inject(MapsService);

  private readonly infoWindowRef = viewChild(MapInfoWindow);
  private readonly markerRefs = viewChildren(MapMarker);

  protected readonly selectedPlace = signal<Place | null>(null);
  protected readonly highlightId = signal<string | null>(null);

  protected readonly mapCenter = signal<google.maps.LatLngLiteral>({
    lat: -34.6037,
    lng: -58.3816,
  });
  protected readonly mapZoom = signal(14);

  protected readonly mapOptions = computed(
    (): google.maps.MapOptions => ({
      center: this.mapCenter(),
      zoom: this.mapZoom(),
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: false,
    }),
  );

  protected readonly mappedPlaces = computed(() =>
    this.placesService.places().filter(p => p.lat != null && p.lng != null),
  );

  protected readonly unmappedPlaces = computed(() =>
    this.placesService.places().filter(p => p.lat == null || p.lng == null),
  );

  constructor() {
    // When the API becomes ready AND a highlight ID is set, center the map
    effect(() => {
      if (!this.mapsService.ready()) return;
      const id = this.highlightId();
      if (!id) return;
      const place = this.placesService.places().find(p => p.id === id);
      if (place?.lat && place?.lng) {
        this.mapCenter.set({ lat: place.lat, lng: place.lng });
        this.mapZoom.set(17);
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.queryParamMap.get('place');
    if (id) this.highlightId.set(id);
  }

  protected markerOptions(place: Place): google.maps.MarkerOptions {
    const isHighlighted = this.highlightId() === place.id;
    return {
      title: place.name,
      animation: isHighlighted ? google.maps.Animation.BOUNCE : null,
      zIndex: isHighlighted ? 100 : 1,
    };
  }

  protected openInfoWindow(idx: number, place: Place): void {
    const markers = this.markerRefs();
    const infoWindow = this.infoWindowRef();
    if (markers[idx] && infoWindow) {
      this.selectedPlace.set(place);
      infoWindow.open(markers[idx]);
    }
  }

  protected getAvgRating(place: Place): string {
    if (place.visits.length === 0) return '—';
    return (place.visits.reduce((s, v) => s + v.rating, 0) / place.visits.length).toFixed(1);
  }

  protected getAvgCost(place: Place): string {
    if (place.visits.length === 0) return '—';
    return Math.round(
      place.visits.reduce((s, v) => s + v.cost, 0) / place.visits.length,
    ).toLocaleString('es-AR');
  }

  protected mapsUrl(place: Place): string {
    if (place.googlePlaceId) return `https://www.google.com/maps/place/?q=place_id:${place.googlePlaceId}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`;
  }

  protected editPlace(place: Place): void {
    this.router.navigate(['/places']);
  }
}
