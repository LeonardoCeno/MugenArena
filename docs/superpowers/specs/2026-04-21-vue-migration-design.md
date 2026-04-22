# Vue 3 Migration Design — MugenArena

## Overview

Migrate the MugenArena battle game frontend from vanilla JS + HTML to Vue 3 + Composition API + Vite, without breaking any game logic, animation, clash, audio, or domain systems.

---

## Constraints & Non-Goals

- All game logic stays in PHP backend — zero changes to backend
- Animation libs (battle-animations.js, clash-system.js, audio-controller.js, black-hole-animation.js) stay as vanilla JS — zero refactor of their internals
- Asset paths (`./assets/...`) must remain valid — Vite outputs to `frontend/` directly
- API URL (`../backend/web_api.php`) must remain valid
- Docker/compose setup must continue to work

---

## Section 1 — File Structure

```
MugenArena/
├── frontend/
│   ├── src/
│   │   ├── main.js                  ← Vue app entry, imports batalha.css
│   │   ├── App.vue                  ← root router (setup vs battle vs victory)
│   │   ├── composables/
│   │   │   └── useGame.js           ← all state + API calls (replaces app.js orchestration)
│   │   ├── components/
│   │   │   ├── GameSetup.vue        ← character/mode selection screen
│   │   │   ├── BattleArena.vue      ← main battle screen, owns all DOM refs
│   │   │   ├── CharacterSprite.vue  ← sprite img + exposes DOM ref
│   │   │   ├── HUD.vue              ← HP/energy bars + status icons
│   │   │   ├── ActionPanel.vue      ← action buttons (3/page + arrow)
│   │   │   ├── DomainOverlay.vue    ← domain background + black-hole canvas
│   │   │   └── VictoryScreen.vue    ← win image + message
│   │   └── libs/                    ← symlinks or copies of vanilla JS libs
│   │       ├── battle-animations.js
│   │       ├── clash-system.js
│   │       ├── audio-controller.js
│   │       └── black-hole-animation.js
│   ├── assets/                      ← unchanged (sprites, audio)
│   ├── batalha.css                  ← unchanged, imported in main.js
│   ├── index.html                   ← Vite entry (replaces batalha.html)
│   ├── vite.config.js
│   └── package.json
├── backend/                         ← unchanged
└── Dockerfile                       ← multi-stage: Node build → PHP/Apache serve
```

### Vite config key points

```js
// vite.config.js
export default {
  root: 'frontend',
  build: {
    outDir: '.',          // builds index.html into frontend/ — keeps ./assets/ paths valid
    emptyOutDir: false,   // don't delete assets/
  }
}
```

---

## Section 2 — Component Architecture & Data Flow

### State (useGame.js)

Single `reactive()` object replaces the plain state object from `app.js`:

```js
const state = reactive({
  phase: 'setup',        // 'setup' | 'battle' | 'victory'
  p1: {
    nome: '', hp: 0, maxHp: 0, energy: 0, maxEnergy: 0,
    statusEffects: [], actions: [], page: 0,
    config: null,        // getConfiguracaoVisual() result
  },
  p2: { /* same */ },
  message: '',
  clash: null,           // { kind, winner, durationMs, bothFailed } or null
  domain: null,          // { owner, nome } or null
  submitted: { p1: false, p2: false },
  winner: null,
})
```

`useGame.js` exports: `state`, `startGame()`, `submitAction(player, actionName)`, `nextPage(player)`.

### DOM Ref Bridge

`BattleArena.vue` collects refs and initializes libs on `onMounted`:

```js
// BattleArena.vue
const p1SpriteEl = ref(null)   // CharacterSprite.vue exposes its <img>
const p2SpriteEl = ref(null)
const arenaEl    = ref(null)
const canvasEl   = ref(null)

onMounted(() => {
  battleAnimations.init({
    p1El: p1SpriteEl.value,
    p2El: p2SpriteEl.value,
    arenaEl: arenaEl.value,
    onStateUpdate: (patch) => Object.assign(state, patch),
  })
  clashSystem.init({ p1El: p1SpriteEl.value, p2El: p2SpriteEl.value })
  audioController.init()
  blackHoleAnimation.init({ canvas: canvasEl.value })
})
```

Libs call back into Vue state via the injected `onStateUpdate` callback — libs never import Vue, Vue never reaches into lib internals.

### Animation Sequencing

`useGame.js` calls `battleAnimations.playTurn(turnData)` after each API response. `playTurn` handles timeline, clash branch, domain reveal — same logic as `app.js` `animarTurno()` but extracted to the existing lib. Vue state updates (HP bars, messages) happen via `onStateUpdate` callbacks fired mid-timeline.

---

## Section 3 — Dockerfile (Multi-Stage Build)

```dockerfile
# Stage 1: build Vue app
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: PHP + Apache serve
FROM php:8.4-apache
COPY --from=builder /app/ /var/www/html/frontend/
COPY backend/ /var/www/html/backend/
RUN chown -R www-data:www-data /var/www/html
EXPOSE 80
```

`compose.yaml` unchanged (ports 8080:80).

DocumentRoot stays at `/var/www/html` — browser hits `http://localhost:8080/frontend/` to load the game.

---

## Section 4 — Component Responsibilities

| Component | Owns | Emits |
|-----------|------|-------|
| `App.vue` | phase routing | — |
| `GameSetup.vue` | character/mode selection form | `game-start(config)` |
| `BattleArena.vue` | all DOM refs, lib init, turn sequencing | — |
| `CharacterSprite.vue` | `<img>` element + exposes ref | — |
| `HUD.vue` | HP/energy bar rendering | — |
| `ActionPanel.vue` | action buttons + pagination | `action-selected(name)` |
| `DomainOverlay.vue` | domain background + canvas | — |
| `VictoryScreen.vue` | winner display | `rematch` |

All components receive data via props from `BattleArena.vue` / `App.vue` (no Pinia needed — single composable is sufficient for this scale).

---

## Section 5 — Critical Invariants (must not break)

1. **Beam clash geometry**: `BEAM_TOUCH_EARLY_MULTIPLIER=0.7`, `BEAM_FRONT_REACH_RATIO=1.8` — these live in clash-system.js, untouched.
2. **Asset paths**: all sprite/audio paths start with `./assets/` — Vite `outDir: '.'` preserves this.
3. **API relative URL**: `../backend/web_api.php` — index.html in `frontend/` makes this valid.
4. **Two-player simultaneous submit**: each player submits independently; polling resolves when both done — logic in `useGame.js` matches current `app.js` behavior exactly.
5. **Domain clash audio**: `audio.muted` toggle must survive Vue re-renders — audio state lives in `audioController`, not in Vue reactive state.
6. **Sans HP=1 / energy absorbs damage**: pure backend logic, no frontend special-casing needed.
7. **Ubuntu two-phase**: `usaSomenteHabilidades` + `retornaAoSetup` — pure backend, frontend just renders what API returns.

---

## Migration Strategy

1. Add `package.json` + `vite.config.js` to `frontend/`
2. Create `src/` scaffold (composable + components stubs)
3. Move `batalha.html` structure into Vue components one section at a time
4. Migrate `app.js` orchestration logic into `useGame.js`
5. Wire DOM refs to animation libs
6. Verify clash + domain flows in browser
7. Update Dockerfile to multi-stage build
8. Smoke-test full game loop
