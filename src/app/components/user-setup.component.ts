import { Component, signal, inject, ChangeDetectionStrategy, output, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '../services/user.service';
import { User } from '../models/place.model';

@Component({
  selector: 'app-user-setup',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; backdrop-filter: blur(3px);
    }
    .card {
      background: white; border-radius: 20px;
      padding: 2.5rem 2rem; max-width: 400px; width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center;
    }
    .emoji { font-size: 3rem; margin-bottom: 1rem; display: block; }
    h2 { margin: 0 0 0.5rem; color: #1a1a1a; font-size: 1.5rem; }
    .subtitle { color: #666; margin: 0 0 1.25rem; font-size: 0.95rem; }
    /* Existing-users list */
    .user-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
    .user-btn {
      width: 100%; padding: 0.75rem 1rem;
      background: #f5f3ff; border: 2px solid #ddd;
      border-radius: 10px; font-size: 1rem; font-weight: 600; color: #4c1d95;
      cursor: pointer; transition: background 0.15s, border-color 0.15s;
    }
    .user-btn:hover:not(:disabled) { background: #ede9fe; border-color: #7c3aed; }
    .user-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .divider { position: relative; margin: 1rem 0 0.75rem; color: #aaa; font-size: 0.8rem; }
    .divider::before, .divider::after {
      content: ''; position: absolute; top: 50%; width: 42%; height: 1px; background: #e5e7eb;
    }
    .divider::before { left: 0; } .divider::after { right: 0; }
    /* Text input */
    input {
      width: 100%; padding: 0.75rem 1rem; border: 2px solid #ddd;
      border-radius: 10px; font-size: 1.1rem; box-sizing: border-box;
      outline: none; transition: border-color 0.2s; text-align: center;
    }
    input:focus { border-color: #667eea; }
    input.invalid { border-color: #e53935; }
    .submit-btn {
      margin-top: 1rem; width: 100%; padding: 0.85rem;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white; border: none; border-radius: 10px;
      font-size: 1rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s;
    }
    .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #e53935; font-size: 0.85rem; margin-top: 0.4rem; }
  `],
  template: `
    <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <div class="card">
        <span class="emoji" aria-hidden="true">🍽️</span>
        <h2 id="setup-title">¡Bienvenido/a a Almorz.ar!</h2>

        @if (loadingUsers()) {
          <p class="subtitle">Cargando…</p>
        } @else if (existingUsers().length > 0) {
          <p class="subtitle">¿Sos alguno/a de estos?</p>
          <div class="user-list" role="list">
            @for (u of existingUsers(); track u.id) {
              <button class="user-btn" type="button" role="listitem"
                (click)="selectExisting(u)" [disabled]="loading()">
                {{ u.displayName }}
              </button>
            }
          </div>
          <div class="divider" aria-hidden="true">o</div>
          <input
            type="text"
            [formControl]="nameCtrl"
            [class.invalid]="nameCtrl.touched && nameCtrl.invalid"
            placeholder="Soy otro/a — escribí tu nombre"
            autocomplete="given-name"
            (keydown.enter)="submitNew()"
            aria-label="Tu nombre si no estás en la lista"
          />
          @if (nameCtrl.touched && nameCtrl.hasError('minlength')) {
            <p class="error" role="alert">El nombre debe tener al menos 2 caracteres.</p>
          }
          @if (apiError()) {
            <p class="error" role="alert">No se pudo conectar a la API. ¿Está corriendo json-server?</p>
          }
          <button class="submit-btn" (click)="submitNew()" [disabled]="loading() || nameCtrl.value.trim().length < 2" type="button">
            {{ loading() ? 'Entrando…' : 'Entrar como nuevo/a usuario/a' }}
          </button>
        } @else {
          <p class="subtitle">¿Cómo te llamás? Lo usamos para recordarte entre sesiones.</p>
          <input
            type="text"
            [formControl]="nameCtrl"
            [class.invalid]="nameCtrl.touched && nameCtrl.invalid"
            placeholder="Tu nombre"
            autocomplete="given-name"
            (keydown.enter)="submitNew()"
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
          <button class="submit-btn" (click)="submitNew()" [disabled]="loading()" type="button">
            {{ loading() ? 'Entrando…' : '¡Entrar!' }}
          </button>
        }
      </div>
    </div>
  `,
})
export class UserSetupComponent implements OnInit {
  private readonly userService = inject(UserService);

  readonly done = output<void>();

  protected readonly nameCtrl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.minLength(2)],
  });
  protected readonly loading = signal(false);
  protected readonly apiError = signal(false);
  protected readonly loadingUsers = signal(true);
  protected readonly existingUsers = signal<User[]>([]);

  ngOnInit(): void {
    this.userService.getAll().subscribe(users => {
      this.existingUsers.set(users);
      this.loadingUsers.set(false);
    });
  }

  protected selectExisting(user: User): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.userService.loginWithUser(user);
    this.loading.set(false);
    this.done.emit();
  }

  protected submitNew(): void {
    this.nameCtrl.markAsTouched();
    const name = this.nameCtrl.value.trim();
    if (name.length < 2 || this.loading()) return;

    this.loading.set(true);
    this.apiError.set(false);

    this.userService.login(name).subscribe({
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
