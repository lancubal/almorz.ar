import { Component, signal, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlacesService } from '../services/places.service';
import { Place } from '../models/place.model';

@Component({
  selector: 'app-places-manager',
  imports: [ReactiveFormsModule],
  templateUrl: './places-manager.component.html',
  styleUrl: './places-manager.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlacesManagerComponent {
  private readonly placesService = inject(PlacesService);

  protected readonly places = this.placesService.places;
  protected readonly isFormVisible = signal(false);
  protected readonly editingPlace = signal<Place | null>(null);

  protected readonly placeForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    tags: new FormControl('', { nonNullable: true }),
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
    this.isFormVisible.set(true);
  }

  protected showEditForm(place: Place): void {
    this.editingPlace.set(place);
    this.placeForm.patchValue({
      name: place.name,
      tags: place.tags.join(', ')
    });
    this.isFormVisible.set(true);
  }

  protected cancelForm(): void {
    this.isFormVisible.set(false);
    this.editingPlace.set(null);
    this.placeForm.reset();
  }

  protected submitForm(): void {
    if (!this.placeForm.valid) return;

    const name = this.placeForm.value.name!;
    const tagsString = this.placeForm.value.tags || '';
    const tags = tagsString
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const editing = this.editingPlace();
    if (editing) {
      this.placesService.updatePlace(editing.id, name, tags).subscribe({
        next: () => this.cancelForm()
      });
    } else {
      this.placesService.addPlace(name, tags).subscribe({
        next: () => this.cancelForm()
      });
    }
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
}
