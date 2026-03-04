# Almorz.ar

An Angular app to decide where to go for lunch. Spin the roulette wheel — it uses a smart weighting system that factors in each place's rating, cost, and how long it's been since your last visit, so the best options naturally rise to the top.


---

## Features

| Feature | Description |
|---|---|
| **SVG Roulette** | Interactive wheel with segments proportional to each place's calculated weight |
| **New Place mode** | A special segment that triggers a second spin among never-visited places |
| **Places manager** | Full CRUD — add, edit, delete places with custom tags |
| **Visit logger** | Record cost and rating (1–10) for every visit |
| **Smart weights** | Rating + cost + time since last visit determine each segment's probability |
| **No-repeat rule** | The last selected place is always excluded from the next spin |
| **Tag filter** | Filter the wheel to a subset of places before spinning (e.g. only "fast" or "cheap") |
| **Temporary blacklist** | Exclude a place for N days without deleting it |
| **Anti-repeat cooldown** | Configurable cooldown window — skip a place if visited within the last X days |
| **Visit history** | Visual timeline of every visit with cost and rating |
| **Analytics** | Monthly spend, favourite place, average rating per tag |
| **Real persistence** | JSON file database via `json-server` — survives restarts and redeploys |

---

## Quick Start

```bash
# Install dependencies (first time only)
npm install

# Start Angular dev server + API
npm start
```

- **App:** `http://localhost:4200`
- **API:** `http://localhost:3001`

`npm start` uses `concurrently` to run `ng serve` and `json-server` in parallel.

---

## How It Works

### 1. Add places

Go to the **Places** tab → **+ Add Place**. Enter a name and optional comma-separated tags (e.g. `grill, cheap, fast`). Places without any visit history start with a neutral weight of `1.0`.

### 2. Spin the wheel

Go to the **Roulette** tab → **SPIN**. The wheel spins with a randomised angle weighted by each segment's probability.

- If the arrow lands on **✨ New**: a brief pause plays, then a second automatic spin runs among places that have never been visited.
- If no unvisited places exist, the New spin is cancelled and the state resets.
- After spinning, a result card shows the selected place: name, tags, average rating, and average spend.

### 3. Log a visit

Go to the **Log Visit** tab. Select the place, enter the cost and a rating from 1 to 10, then submit. Data is persisted immediately to `db.json` via the REST API.

### 4. Filter by tag

Use the tag filter on the Roulette tab to narrow the wheel to a specific subset before spinning. The wheel redraws in real time to reflect the active filter.

---

## Weight Algorithm

Each place has a computed weight that determines its segment size on the wheel and its selection probability:

$$\text{weight} = \text{ratingFactor} \times \text{costFactor} \times \text{agingFactor}$$

| Factor | Formula | Effect |
|---|---|---|
| `ratingFactor` | `averageRating / 5` | Higher-rated places get more weight |
| `costFactor` | `1 / (1 + averageCost / 1000)` | Cheaper places get more weight |
| `agingFactor` | `1 + (weeksSinceLastVisit × 0.2)` | Places visited longer ago get more weight |
| No visits yet | — | Neutral weight of `1.0` until history exists |

The last selected place is always excluded from the next spin. Places within their configured cooldown window are also excluded.

### The "✨ New" segment

This segment's weight equals the **average** of all eligible places. Segment colors are assigned using a graph-coloring algorithm on a cycle, guaranteeing no two adjacent segments share the same color regardless of how many places are in the rotation.

---

## Architecture

```
src/app/
├── models/
│   └── place.model.ts              # Interfaces: Place, Visit, PlaceWithWeight
├── services/
│   ├── places.service.ts           # HttpClient + Signals — single source of truth
│   └── user.service.ts             # User preferences and settings
└── components/
    ├── roulette.component.*        # SVG wheel + SpinState state machine
    ├── places-manager.component.*  # Place CRUD
    ├── visit-logger.component.*    # Visit form
    ├── history.component.*         # Visit timeline
    └── stats.component.*           # Analytics dashboard
```

### Tech stack

| Layer | Technology |
|---|---|
| Framework | Angular 21 — standalone components, `ChangeDetectionStrategy.OnPush` |
| State | Signals — `signal()`, `computed()` for reactive state |
| HTTP | `HttpClient` + RxJS (`forkJoin`, `switchMap`, `tap`) |
| Forms | Angular Reactive Forms with validators |
| API | `json-server` v1 — REST API with `db.json` persistence |
| Dev runner | `concurrently` — starts Angular and json-server together |
| Containers | Docker multi-stage build — nginx (frontend) + node (API) |

### Data model (`db.json`)

```json
{
  "places": [
    {
      "id": "uuid",
      "name": "La Parrilla",
      "tags": ["grill", "cheap"],
      "visits": [
        { "date": "2026-01-15T12:00:00.000Z", "cost": 1500, "rating": 8 }
      ],
      "lastVisitDate": "2026-01-15T12:00:00.000Z",
      "createdAt": "2025-11-01T09:00:00.000Z",
      "blacklistedUntil": null,
      "cooldownDays": 3
    }
  ],
  "settings": [
    { "id": "1", "lastSelectedId": "uuid-or-null" }
  ]
}
```

`json-server` uses atomic writes (via a temp-file rename) — the API container must have a directory bind mount, not a single-file mount, to allow this.

---

## Commands

```bash
npm start        # Angular (4200) + json-server (3001) — local dev
npm run api      # json-server only
ng serve         # Angular only
ng build         # Production build
ng test          # Unit tests with Vitest
```

---

## Docker

```bash
# Build and start both containers
docker compose up --build

# App available at http://localhost
```

| Service | Base image | Port | Description |
|---|---|---|---|
| `web` | nginx:alpine | 80 | Compiled Angular app + reverse proxy |
| `api` | node:22-alpine | 3001 | json-server REST API |

nginx proxies all `/api/*` requests internally to `api:3001`, so the Angular app never needs to know the backend URL. Data persists via a bind mount on `./db.json`.

---

## License

Personal project. Free to adapt.
