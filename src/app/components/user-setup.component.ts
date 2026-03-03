import { Component, signal, inject, ChangeDetectionStrategy, output } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-user-setup',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(3px);
    }
    .card {
      background: white;
      border-radius: 20px;
      padding: 2.5rem 2rem;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
    }
    .emoji { font-size: 3rem; margin-bottom: 1rem; display: block; }
    h2 { margin: 0 0 0.5rem; color: #1a1a1a; font-size: 1.5rem; }
    p { color: #666; margin: 0 0 1.5rem; font-size: 0.95rem; }
    input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid #ddd;
      border-radius: 10px;
      font-size: 1.1rem;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.2s;
      text-align: center;
    }
    input:focus { border-color: #667eea; }
    input.invalid { border-color: #e53935; }
    button {
      margin-top: 1rem;
      width: 100%;
      padding: 0.85rem;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #e53935; font-size: 0.85rem; margin-top: 0.4rem; }
  `],
  template: `
    <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <div class="card">
        <span class="emoji" aria-hidden="true">🍽️</span>
        <h2 id="setup-title">¡Bienvenido/a a Almorz.ar!</h2>
        <p>¿Cómo te llamás? Lo usamos para recordarte entre sesiones.</p>

        <input
          type="text"
          [formControl]="nameCtrl"
          [class.invalid]="nameCtrl.touched && nameCtrl.invalid"
          placeholder="Tu nombre"
          autocomplete="given-name"
          (keydown.enter)="submit()"
          aria-label="Tu nombre"
          aria-required="true"
        />

        @if (nameCtrl.touched && nameCtrl.hasError('required')) {
          <p class="error" role="alert">Ingresá tu nombre para continuar.</p>
        }
        @if (nameCtrl.touched && nameCtrl.hasError('minlength')) {
          <p class="error" role="alert">El nombre debe tener al menos 2 caracteres.</p>
        }
        @if (apiError()) {
          <p class="error" role="alert">No se pudo conectar a la API. ¿Está corriendo json-server?</p>
        }

        <button (click)="submit()" [disabled]="loading()" type="button">
          {{ loading() ? 'Entrando…' : '¡Entrar!' }}
        </button>
      </div>
    </div>
  `,
})
export class UserSetupComponent {
  private readonly userService = inject(UserService);

  readonly done = output<void>();

  protected readonly nameCtrl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2)],
  });
  protected readonly loading = signal(false);
  protected readonly apiError = signal(false);

  protected submit(): void {
    this.nameCtrl.markAsTouched();
    if (this.nameCtrl.invalid || this.loading()) return;

    this.loading.set(true);
    this.apiError.set(false);

    this.userService.login(this.nameCtrl.value).subscribe({
      next: () => {
        this.loading.set(false);
        this.done.emit();
      },
      error: () => {
        this.loading.set(false);
        this.apiError.set(true);
      },
    });
  }
}
