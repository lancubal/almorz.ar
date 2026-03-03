# 🍽️ Almorz.ar

Una aplicación Angular para decidir dónde ir a comer cada día. Gira la ruleta, que usa un sistema de pesos inteligente para favorecer los mejores lugares según tu historial.

---

## ✨ Características

| Feature | Descripción |
|---|---|
| 🎰 **Ruleta SVG** | Rueda interactiva con segmentos proporcionales al peso de cada lugar |
| ✨ **Modo Nuevo** | Un segmento especial que re-gira entre lugares nunca visitados |
| 📍 **Gestión de Lugares** | CRUD completo con nombre y tags personalizados |
| 📝 **Registro de Visitas** | Guardá costo y rating (1–10) por visita |
| ⚖️ **Pesos Inteligentes** | Rating + costo + aging determinan la probabilidad de cada lugar |
| 🚫 **Sin Repetición** | El último lugar no aparece en la siguiente tirada |
| 💾 **Persistencia Real** | Base de datos en archivo JSON vía `json-server` — sobrevive reinicios |

---

## 🚀 Inicio Rápido

```bash
# 1. Instalar dependencias (solo la primera vez)
npm install

# 2. Arrancar app Angular + API
npm start
```

- **App:** `http://localhost:4200`
- **API (json-server):** `http://localhost:3001`

> `npm start` usa `concurrently` para correr `ng serve` y `json-server` en paralelo.

---

## 📖 Cómo Usar

### 1. Agregar lugares

1. Ve a la pestaña **📍 Lugares**
2. Clic en **+ Agregar Lugar**
3. Ingresá nombre y tags opcionales (separados por coma: `parrilla, económico, rápido`)
4. Clic en **Crear**

### 2. Girar la ruleta

1. Ve a la pestaña **🎰 Ruleta**
2. Clic en **¡GIRAR!**
3. La rueda gira — el segmento ganador se alinea con la flecha
4. Si cae en **✨ Nuevo**: pausa breve → segunda tirada automática entre lugares no visitados
5. Se muestra una tarjeta con el lugar elegido: nombre, tags, rating promedio, gasto promedio

### 3. Registrar una visita

1. Ve a la pestaña **📝 Registrar Visita**
2. Seleccioná el lugar
3. Ingresá el gasto y el rating
4. Clic en **Registrar Visita**

Los datos se persisten inmediatamente en `db.json` vía REST API.

---

## ⚖️ Algoritmo de Pesos

Cada lugar tiene un peso calculado que determina el tamaño de su segmento en la rueda y su probabilidad:

```
peso = ratingFactor × costFactor × agingFactor
```

| Factor | Lógica |
|---|---|
| **ratingFactor** | `promedio_rating / 5` — mejor puntuado, más peso |
| **costFactor** | `1 / (1 + costo_promedio / 1000)` — más barato, más peso |
| **agingFactor** | `1 + (semanas_sin_visitar × 0.2)` — más tiempo sin ir, más peso |
| **Sin visitas** | Peso neutral de `1.0` hasta tener historial |

El **último lugar seleccionado** se excluye siempre de la tirada siguiente.

### Segmento "✨ Nuevo"

Tiene un peso igual al **promedio** de todos los lugares elegibles. Si la rueda cae ahí:

1. Aparece un banner dorado: "Modo Nuevo activado…"
2. Se hace una segunda tirada entre los lugares con **cero visitas**
3. Si no hay lugares sin visitar, se cancela y vuelve al estado inicial

---

## 🏗️ Arquitectura

```
src/app/
├── models/
│   └── place.model.ts          # Interfaces: Place, Visit, PlaceWithWeight
├── services/
│   └── places.service.ts       # HttpClient + Signals — fuente de verdad
└── components/
    ├── roulette.component.*    # Rueda SVG + máquina de estados SpinState
    ├── places-manager.component.*  # CRUD de lugares
    └── visit-logger.component.*    # Formulario de visitas
```

### Stack tecnológico

- **Angular 21** — standalone components, `ChangeDetectionStrategy.OnPush`
- **Signals** — `signal()`, `computed()` para estado reactivo
- **HttpClient + RxJS** — `forkJoin`, `switchMap`, `tap` para la API REST
- **Reactive Forms** — con validaciones
- **json-server** — API REST con persistencia en `db.json`
- **concurrently** — arranque simultáneo de Angular y json-server

### `db.json` (estructura)

```json
{
  "places": [
    {
      "id": "uuid",
      "name": "La Parrilla",
      "tags": ["parrilla", "económico"],
      "visits": [{ "date": "ISO-date", "cost": 1500, "rating": 8 }],
      "lastVisitDate": "ISO-date",
      "createdAt": "ISO-date"
    }
  ],
  "settings": [
    { "id": "1", "lastSelectedId": "uuid-or-null" }
  ]
}
```

---

## 💡 Ideas Futuras

Posibles mejoras ordenadas por impacto:

### Alta prioridad
- [x] **Blacklist temporal** — "No quiero ir esta semana": excluir un lugar N días sin borrarlo
- [x] **Filtro por tags antes de girar** — elegir solo entre lugares "económico" o "rápido" según el día
- [x] **Modo anti-repetición semanal** — no volver al mismo lugar dentro de X días configurables (desde Admin)

### Features de usabilidad
- [x] **Historial visual** — timeline de visitas con costo y rating
- [x] **Estadísticas / analytics** — gasto mensual, lugar favorito, rating promedio por tag
- [ ] **Exportar / importar datos** — backup y restauración del `db.json` desde la UI
- [ ] **Mapa de lugares** — link a Google Maps para cada lugar

### Features sociales / avanzados
- [ ] **Compartir la ruleta** — modo multi-usuario, o QR code para usarla con el equipo
- [ ] **Presupuesto mensual** — alerta cuando el gasto acumulado supera un límite configurado
- [ ] **Recordatorio de almuerzo** — notificación del navegador a la hora configurada
- [ ] **Integración con calendario** — deshabilitar la app si hay reunión al mediodía
- [ ] **Sugerencia de lugar nuevo** — integración con la API de Google Places para descubrir restaurantes cercanos

---

## 🛠️ Comandos útiles

```bash
npm start              # Angular (4200) + json-server (3001) — desarrollo local
npm run api            # Solo json-server
ng serve               # Solo Angular
ng build               # Build de producción
ng test                # Unit tests con Vitest
```

---

## 🐳 Docker

### Desarrollo local con Docker

```bash
# Construir y levantar ambos contenedores
docker compose up --build

# App disponible en http://localhost
```

### Servicios

| Servicio | Imagen base | Puerto | Descripción |
|---|---|---|---|
| `web` | nginx:alpine | 80 | Angular compilado + proxy reverso |
| `api` | node:22-alpine | 3001 | json-server — REST API |

nginx actúa de proxy: las llamadas a `/api/*` se redirigen internamente al contenedor `api:3001`, por lo que la app Angular no necesita conocer ninguna URL de backend externa.

Los datos persisten en `./db.json` (bind mount). En AWS se reemplaza por un volumen EFS.

---

## ☁️ Deploy en AWS (ECS Fargate)

1. **ECR** — Crear dos repositorios y subir las imágenes:
   ```bash
   docker build -t almorz-web .
   docker build -f Dockerfile.api -t almorz-api .
   # tag + push a ECR...
   ```
2. **EFS** — Crear un sistema de archivos para persistir `db.json` y montarlo en la task definition del contenedor `api` en `/app/db.json`.
3. **ECS Task Definition** — Dos contenedores en la misma task (equivalente al `docker-compose.yml`).
4. **ALB** — Application Load Balancer apuntando al contenedor `web` (puerto 80).

---

## 📝 Licencia

Proyecto de uso personal. Libre para adaptar.
