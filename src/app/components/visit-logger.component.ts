import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlacesService } from '../services/places.service';

@Component({
  selector: 'app-visit-logger',
  imports: [ReactiveFormsModule],
  templateUrl: './visit-logger.component.html',
  styleUrl: './visit-logger.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisitLoggerComponent {
  private readonly placesService = inject(PlacesService);

  protected readonly places = this.placesService.places;
  protected readonly showSuccess = signal(false);
  protected readonly Math = Math;

  protected readonly visitForm = new FormGroup({
    placeId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    cost: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0)] }),
    rating: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(1), Validators.max(10)] })
  });

  protected submitVisit(): void {
    if (!this.visitForm.valid) return;

    const { placeId, cost, rating } = this.visitForm.value;

    if (placeId && cost !== null && cost !== undefined && rating !== null && rating !== undefined) {
      this.placesService.addVisit(placeId, cost, rating).subscribe({
        next: () => {
          this.visitForm.reset();
          this.showSuccess.set(true);
          setTimeout(() => {
            this.showSuccess.set(false);
          }, 3000);
        }
      });
    }
  }

  protected getSelectedPlaceName(): string {
    const placeId = this.visitForm.value.placeId;
    if (!placeId) return '';

    const place = this.places().find(p => p.id === placeId);
    return place?.name || '';
  }
}
