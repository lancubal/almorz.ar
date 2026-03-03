import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
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
    tags: new FormControl('', { nonNullable: true })
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
