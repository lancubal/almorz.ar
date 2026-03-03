import { Component, signal, inject, computed, effect, viewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlacesService } from '../services/places.service';
import { MapsService, NearbyResult } from '../services/maps.service';
import { Place, PlaceLocation } from '../models/place.model';

@Component({
  selector: 'app-places-manager',
  imports: [ReactiveFormsModule],
  templateUrl: './places-manager.component.html',
  styleUrl: './places-manager.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlacesManagerComponent {
  private readonly placesService = inject(PlacesService);
  protected readonly mapsService = inject(MapsService);

  protected readonly places = this.placesService.places;
  protected readonly isFormVisible = signal(false);
  protected readonly editingPlace = signal<Place | null>(null);
  protected readonly blacklistingId = signal<string | null>(null);

  // Maps integration
  protected readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  protected readonly selectedLocation = signal<PlaceLocation | null>(null);
  protected readonly nearbyResults = signal<NearbyResult[]>([]);
  protected readonly nearbyLoading = signal(false);
  private autocomplete: google.maps.places.Autocomplete | null = null;

  constructor() {
    effect(() => {
      if (this.mapsService.ready() && this.isFormVisible()) {
        // Wait for template to render before attaching autocomplete
        setTimeout(() => this.initAutocomplete(), 50);
      }
    });
  }

  protected readonly placeForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    tags: new FormControl('', { nonNullable: true }),
  });

  // All unique tags used across all existing places
  protected readonly allExistingTags = computed(() => {
    const tags = new Set<string>();
    this.places().forEach(p => p.tags.forEach(t => tags.add(t)));
    return [...tags].sort();
  });

  // Tags that are not already in the current field value
  private readonly currentTagsValue = toSignal(this.placeForm.controls.tags.valueChanges, { initialValue: '' });
  protected readonly suggestedTags = computed(() => {
    const entered = this.currentTagsValue()
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);
    return this.allExistingTags().filter(t => !entered.includes(t.toLowerCase()));
  });

  // Reactive duplicate detection: warns if a place with the same normalised name exists
  private readonly nameValue = toSignal(this.placeForm.controls.name.valueChanges, { initialValue: '' });
  protected readonly duplicateWarning = computed(() => {
    const name = this.nameValue().trim().toLowerCase();
    if (name.length < 2) return null;
    const editingId = this.editingPlace()?.id;
    const match = this.places().find(
      p => p.name.trim().toLowerCase() === name && p.id !== editingId,
    );
    return match ? `Ya existe un lugar llamado "${match.name}".` : null;
  });

  protected showAddForm(): void {
    this.editingPlace.set(null);
    this.placeForm.reset();
    this.clearLocation();
    this.nearbyResults.set([]);
    this.isFormVisible.set(true);
  }

  protected showEditForm(place: Place): void {
    this.editingPlace.set(place);
    this.placeForm.patchValue({
      name: place.name,
      tags: place.tags.join(', ')
    });
    // Pre-fill location if place already has coords
    if (place.lat && place.lng) {
      this.selectedLocation.set({
        lat: place.lat,
        lng: place.lng,
        address: place.address ?? '',
        googlePlaceId: place.googlePlaceId ?? ''
      });
    } else {
      this.clearLocation();
    }
    this.nearbyResults.set([]);
    this.isFormVisible.set(true);
  }

  protected cancelForm(): void {
    this.isFormVisible.set(false);
    this.editingPlace.set(null);
    this.placeForm.reset();
    this.clearLocation();
    this.nearbyResults.set([]);
  }

  protected submitForm(): void {
    if (!this.placeForm.valid) return;

    const name = this.placeForm.value.name!;
    const tagsString = this.placeForm.value.tags || '';
    const tags = tagsString
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const location = this.selectedLocation() ?? undefined;
    const editing = this.editingPlace();
    if (editing) {
      this.placesService.updatePlace(editing.id, name, tags, location).subscribe({
        next: () => this.cancelForm()
      });
    } else {
      this.placesService.addPlace(name, tags, location).subscribe({
        next: () => this.cancelForm()
      });
    }
  }

  protected clearLocation(): void {
    this.selectedLocation.set(null);
    if (this.autocomplete) {
      google.maps.event.clearInstanceListeners(this.autocomplete);
      this.autocomplete = null;
    }
  }

  private initAutocomplete(): void {
    if (!this.mapsService.ready()) return;
    const inputEl = this.searchInput()?.nativeElement;
    if (!inputEl || this.autocomplete) return;

    this.autocomplete = new google.maps.places.Autocomplete(inputEl, {
      types: ['establishment'],
      fields: ['name', 'geometry', 'formatted_address', 'place_id'],
    });

    this.autocomplete.addListener('place_changed', () => {
      const result = this.autocomplete!.getPlace();
      if (!result.geometry?.location) return;
      this.selectedLocation.set({
        lat: result.geometry.location.lat(),
        lng: result.geometry.location.lng(),
        address: result.formatted_address ?? result.vicinity ?? '',
        googlePlaceId: result.place_id ?? '',
      });
      // Pre-fill name if empty
      if (!this.placeForm.controls.name.value && result.name) {
        this.placeForm.controls.name.setValue(result.name);
      }
    });
  }

  protected fetchNearbySuggestions(): void {
    if (!navigator.geolocation) return;
    this.nearbyLoading.set(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const excludeNames = this.places().map(p => p.name);
        const results = await this.mapsService.getNearbyRestaurants(
          pos.coords.latitude,
          pos.coords.longitude,
          excludeNames,
        );
        this.nearbyResults.set(results);
        this.nearbyLoading.set(false);
      },
      () => this.nearbyLoading.set(false),
    );
  }

  protected fillFromNearby(result: NearbyResult): void {
    this.placeForm.controls.name.setValue(result.name);
    this.selectedLocation.set({
      lat: result.lat,
      lng: result.lng,
      address: result.address,
      googlePlaceId: result.placeId,
    });
    this.nearbyResults.set([]);
  }

  protected appendTag(tag: string): void {
    const current = this.placeForm.controls.tags.value.trim();
    const newValue = current.length > 0 ? `${current}, ${tag}` : tag;
    this.placeForm.controls.tags.setValue(newValue);
  }

  protected deletePlace(id: string): void {
    if (confirm('¿Estás seguro de que quieres eliminar este lugar?')) {
      this.placesService.deletePlace(id).subscribe();
    }
  }

  protected getAverageRating(place: Place): number | null {
    if (place.visits.length === 0) return null;
    return place.visits.reduce((sum, v) => sum + v.rating, 0) / place.visits.length;
  }

  protected getAverageCost(place: Place): number | null {
    if (place.visits.length === 0) return null;
    return place.visits.reduce((sum, v) => sum + v.cost, 0) / place.visits.length;
  }

  protected isBlacklisted(place: Place): boolean {
    const bl = this.placesService.userBlacklist();
    return !!bl[place.id] && new Date(bl[place.id]) > new Date();
  }

  protected blacklistExpiry(place: Place): string {
    const bl = this.placesService.userBlacklist();
    if (!bl[place.id]) return '';
    return new Date(bl[place.id]).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  }

  protected startBlacklist(id: string): void {
    this.blacklistingId.set(id);
  }

  protected cancelBlacklist(): void {
    this.blacklistingId.set(null);
  }

  protected confirmBlacklist(id: string, days: number): void {
    this.blacklistingId.set(null);
    this.placesService.blacklistPlace(id, days).subscribe();
  }

  protected doRemoveFromBlacklist(id: string): void {
    this.placesService.removeFromBlacklist(id).subscribe();
  }
}
