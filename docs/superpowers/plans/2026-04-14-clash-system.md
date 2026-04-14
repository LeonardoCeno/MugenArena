# Clash System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a projectile clash system where two simultaneous priority skills collide visually, shake for 1–3 seconds, and only the winner's damage is applied.

**Architecture:** Backend detects clash condition and resolves winner before sending response; frontend receives clash metadata, launches both animations simultaneously, pauses projectiles on overlap, runs shake, then resumes winner. The Web Animations API replaces CSS transitions for projectile movement to enable clean pause/resume.

**Tech Stack:** PHP 8 (backend), Vanilla JS ES modules (frontend), Web Animations API, CSS `translate` property (independent of `transform`).

---

## File Map

| File | Role |
|---|---|
| `backend/characters/sukuna/Sukuna.php` | Add `clashable: true` to Kamino Fuga |
| `backend/characters/gojo/Gojo.php` | Add `priority: true, clashable: true` to Vazio Roxo |
| `backend/GameService.php` | `acaoEhClashavel()`, `resolverClash()`, clash branch in `executarTurnoSimultaneo()` |
| `frontend/batalha.css` | `.clash-shaking` + `@keyframes clash-shake` |
| `frontend/battle-animations.js` | `criarProjetil()` → Web Animations API; expose `rodarTimeline`/`wait`; add `montarAnimacaoClash()` |
| `frontend/clash-system.js` | New — full visual clash orchestration |
| `frontend/app.js` | Import clash system; clash branch in `processarAcao()` |

---

## Task 1 — Add `clashable` flag to character skills

**Files:**
- Modify: `backend/characters/sukuna/Sukuna.php:144-149`
- Modify: `backend/characters/gojo/Gojo.php:61`

- [ ] **Step 1: Add `clashable: true` + `priority: true` to Kamino Fuga in Sukuna.php**

Current block (lines 144–149):
```php
[
    "nome"       => "Kamino Fuga",
    "metodo"     => "kaminoFuga",
    "precisaAlvo"=> true,
    "energyCost" => self::CUSTO_KAMINO_FUGA,
],
```

Replace with:
```php
[
    "nome"       => "Kamino Fuga",
    "metodo"     => "kaminoFuga",
    "precisaAlvo"=> true,
    "energyCost" => self::CUSTO_KAMINO_FUGA,
    "priority"   => true,
    "clashable"  => true,
],
```

- [ ] **Step 2: Add `priority: true, clashable: true` to Vazio Roxo in Gojo.php**

Current line 61:
```php
["nome" => "Vazio Roxo", "metodo" => "vazioRoxo", "precisaAlvo" => true, "energyCost" => self::CUSTO_VAZIO_ROXO],
```

Replace with:
```php
["nome" => "Vazio Roxo", "metodo" => "vazioRoxo", "precisaAlvo" => true, "energyCost" => self::CUSTO_VAZIO_ROXO, "priority" => true, "clashable" => true],
```

- [ ] **Step 3: Verify manually**

Start the PHP server and open the battle page. Select Gojo vs Sukuna. Check that Vazio Roxo and Kamino Fuga buttons appear and are enabled. No PHP errors in the console.

- [ ] **Step 4: Commit**

```bash
git add backend/characters/sukuna/Sukuna.php backend/characters/gojo/Gojo.php
git commit -m "feat: add clashable flag to Kamino Fuga and Vazio Roxo"
```

---

## Task 2 — Backend clash detection and resolution in GameService

**Files:**
- Modify: `backend/GameService.php`

- [ ] **Step 1: Add `acaoEhClashavel()` helper after `acaoTemPrioridade()` (around line 113)**

```php
private static function acaoEhClashavel(Personagem $p, array $acao): bool {
    if ($acao['actionType'] !== 'skill') return false;
    $skillIndex  = $acao['skillIndex'] ?? null;
    $habilidades = $p->getHabilidades();
    if ($skillIndex === null || !isset($habilidades[$skillIndex])) return false;
    return (bool)($habilidades[$skillIndex]['clashable'] ?? false);
}
```

- [ ] **Step 2: Add `resolverClash()` method after `acaoEhClashavel()`**

```php
/**
 * Resolve um turno onde ambas as ações são clashable.
 * Apenas o vencedor executa sua ação; o perdedor é cancelado.
 * Retorna o array de resultado padrão + chave 'clash'.
 */
private static function resolverClash(array &$game, string $k1, array $a1, string $k2, array $a2): array {
    $p1HasPriority = (bool)($game['p1']->getHabilidades()[$a1['skillIndex'] ?? -1]['priority'] ?? false);
    $p2HasPriority = (bool)($game['p2']->getHabilidades()[$a2['skillIndex'] ?? -1]['priority'] ?? false);

    // Determine winner
    if ($p1HasPriority && $p2HasPriority) {
        $winnerKey = random_int(0, 1) === 0 ? 'p1' : 'p2';
        $durationMs = 3000;
    } elseif ($p1HasPriority) {
        $winnerKey  = 'p1';
        $durationMs = 1000;
    } else {
        $winnerKey  = 'p2';
        $durationMs = 1000;
    }

    $loserKey = $winnerKey === 'p1' ? 'p2' : 'p1';

    // Execute only winner's action
    $mensagem = self::executarAcaoPendente($game, $winnerKey);

    // Clear loser without executing
    $game['pendingActions'][$loserKey] = null;

    // Continuous effects, turn advance, energy regen
    if ($game['p1']->estaVivo()) $game['p1']->processarEfeitosContinuosFimTurno();
    if ($game['p2']->estaVivo()) $game['p2']->processarEfeitosContinuosFimTurno();

    $game['turno']++;
    $game['pendingActions'] = ['p1' => null, 'p2' => null];
    $game['p1']->iniciarTurno();
    $game['p2']->iniciarTurno();

    return [
        'mensagem'            => $mensagem,
        'resetJogo'           => false,
        'resolucaoOrdem'      => [$winnerKey, $loserKey],
        'mensagensResolucao'  => [$mensagem],
        'estadoIntermediario' => null,
        'clash' => [
            'occurred'   => true,
            'winner'     => $winnerKey,
            'durationMs' => $durationMs,
        ],
    ];
}
```

- [ ] **Step 3: Add clash branch at the top of `executarTurnoSimultaneo()`, before `determinarOrdem()`**

After line 228 (`$a2 = $game['pendingActions']['p2'];`), insert:

```php
// Clash: ambos usaram skills clashable — apenas o vencedor age
if (self::acaoEhClashavel($game['p1'], $a1) && self::acaoEhClashavel($game['p2'], $a2)) {
    return self::resolverClash($game, 'p1', $a1, 'p2', $a2);
}
```

- [ ] **Step 4: Thread `clash` key through `resolverRodada()` and `submeterAcao()`**

In `resolverRodada()` (around line 295), the `$resultado` array is returned. Add `clash` passthrough:

```php
return [
    'mensagem'           => implode(' ', array_filter($mensagens)),
    'resetJogo'          => $resetJogo,
    'resolucaoOrdem'     => $resolucaoOrdem,
    'mensagensResolucao' => $resultado['mensagensResolucao'] ?? [],
    'estadoIntermediario' => $estadoIntermediario,
    'clash'              => $resultado['clash'] ?? null,
];
```

In `submeterAcao()` (around line 450), add `clash` to the resolved return:

```php
return [
    'resolved'            => true,
    'mensagem'            => $resultado['mensagem'],
    'resetJogo'           => $resultado['resetJogo'],
    'resolucaoOrdem'      => $resultado['resolucaoOrdem'],
    'mensagensResolucao'  => $resultado['mensagensResolucao'] ?? [],
    'estadoIntermediario' => $resultado['estadoIntermediario'],
    'clash'               => $resultado['clash'] ?? null,
];
```

- [ ] **Step 5: Verify manually**

Start server. Gojo vs Sukuna. Both use Vazio Roxo / Kamino Fuga in the same turn. Check browser Network tab → the API response should contain `"clash":{"occurred":true,"winner":"p1" or "p2","durationMs":3000}`. No PHP errors.

- [ ] **Step 6: Commit**

```bash
git add backend/GameService.php
git commit -m "feat: backend clash detection — only winner executes action"
```

---

## Task 3 — CSS clash-shake styles

**Files:**
- Modify: `frontend/batalha.css`

- [ ] **Step 1: Add clash-shake rule at the end of `batalha.css`**

```css
/* ── Clash system ──────────────────────────────────────────────────── */

/* Uses standalone `translate` (CSS Transforms Level 2) so it composes
   independently of the inline `transform` (scaleX flip + rotate) that
   projectile elements already have. No conflict. */
.clash-shaking {
    animation: clash-shake 0.08s infinite alternate;
}

@keyframes clash-shake {
    from { translate: -5px 0; }
    to   { translate:  5px 0; }
}
```

- [ ] **Step 2: Verify CSS parses cleanly**

Open `batalha.html` in browser. Open DevTools → Console. No CSS parsing errors. The `translate` property is supported in Chrome 104+, Firefox 72+, Safari 14.1+.

- [ ] **Step 3: Commit**

```bash
git add frontend/batalha.css
git commit -m "feat: add clash-shake CSS animation"
```

---

## Task 4 — Rewrite `criarProjetil()` to use Web Animations API

**Files:**
- Modify: `frontend/battle-animations.js:433-446`

The goal: `criarProjetil()` returns `{ el, animation }` instead of just `el`. The `animation` object (Web Animations API `Animation`) supports `.pause()` and `.play()`. Non-clash callers get `el` from destructuring `{ el }`.

- [ ] **Step 1: Replace `criarProjetil()` body**

Current function (lines 433–447):
```js
function criarProjetil(overlay, pos) {
    const el = document.createElement("img");
    el.className = "arena-action-overlay";
    el.src = overlay.sprite;
    el.alt = "";
    el.setAttribute("aria-hidden", "true");
    const sizePx = escala(overlay.sizePx ?? 260, pos.arenaW);
    el.style.cssText = `width:${sizePx}px;left:${pos.origemX}px;top:${pos.origemY}px;transform:translate(-50%,-50%) scaleX(${pos.escalaHorizontal}) scale(${overlay.scale ?? 1}) rotate(${pos.anguloProjetil}deg);transition:left ${overlay.durationMs}ms linear,top ${overlay.durationMs}ms linear`;
    els.arena.appendChild(el);
    void el.getBoundingClientRect();
    el.style.left = `${pos.alvoX}px`;
    el.style.top  = `${pos.alvoY}px`;
    return el;
}
```

Replace with:
```js
function criarProjetil(overlay, pos) {
    const el = document.createElement("img");
    el.className = "arena-action-overlay";
    el.src = overlay.sprite;
    el.alt = "";
    el.setAttribute("aria-hidden", "true");
    const sizePx = escala(overlay.sizePx ?? 260, pos.arenaW);
    // Set size + transform (flip/rotate) via style; position set by animation below
    el.style.cssText = `width:${sizePx}px;left:${pos.origemX}px;top:${pos.origemY}px;transform:translate(-50%,-50%) scaleX(${pos.escalaHorizontal}) scale(${overlay.scale ?? 1}) rotate(${pos.anguloProjetil}deg);`;
    els.arena.appendChild(el);
    void el.getBoundingClientRect(); // force layout before animation starts

    const animation = el.animate(
        [
            { left: `${pos.origemX}px`, top: `${pos.origemY}px` },
            { left: `${pos.alvoX}px`,   top: `${pos.alvoY}px`   },
        ],
        { duration: overlay.durationMs, fill: "forwards", easing: "linear" }
    );
    // Default: remove element when animation finishes (non-clash path)
    animation.onfinish = () => el.remove();

    return { el, animation };
}
```

- [ ] **Step 2: Fix `criarOverlay()` — it calls `criarProjetil()` and returns just `el`**

Current line in `criarOverlay()`:
```js
return criarProjetil(overlay, pos);
```

Replace with:
```js
return criarProjetil(overlay, pos).el;
```

This preserves the existing contract: `criarOverlay()` still returns an element (or null), so `eventosOverlay` cleanup (`el?.remove()`) keeps working.

- [ ] **Step 3: Verify non-clash projectiles still work**

Start server. Play a normal turn where one player uses Kamino Fuga (no clash). The fire arrow should still travel from caster to target and the explosion should appear on impact. No JS errors in console.

- [ ] **Step 4: Commit**

```bash
git add frontend/battle-animations.js
git commit -m "refactor: criarProjetil uses Web Animations API, returns {el, animation}"
```

---

## Task 5 — Add `montarAnimacaoClash()` and expose `rodarTimeline`/`wait` from animation controller

**Files:**
- Modify: `frontend/battle-animations.js`

`montarAnimacaoClash()` builds two event groups (pre/post projectile arrival) and returns a getter for the projectile ref — which is populated when its creation event fires. Also exposes `rodarTimeline` and `wait` in the returned controller object so `clash-system.js` can use them.

- [ ] **Step 1: Add `montarAnimacaoClash()` inside `createAnimationController`, after `montarAnimacao()`**

```js
function montarAnimacaoClash(atacanteKey, acao, defensorKey) {
    const nomeAcao     = acao.nomeSprite || acao.nome;
    const actionConfig = state.serverState?.[atacanteKey]?.visual?.actions?.[nomeAcao] ?? {};

    const allOverlays  = overlaysDeConfig(actionConfig);
    const projOverlay  = allOverlays.find(o => o.mode === "projectile") ?? null;
    const otherOverlays = allOverlays.filter(o => o.mode !== "projectile");

    // Frame events (character sprite changes)
    const { events: frameEvts } = eventosFrames(atacanteKey, framesDeConfig(actionConfig));

    const projArrivalMs = projOverlay
        ? (projOverlay.startMs + projOverlay.durationMs)
        : 0;

    // Audio events split by projectile arrival
    const allAudio = eventosAudio(actionConfig);
    const preAudio  = allAudio.filter(e => e.at < projArrivalMs);
    const postAudio = allAudio.filter(e => e.at >= projArrivalMs)
        .map(e => ({ ...e, at: e.at - projArrivalMs }));

    // Non-projectile overlays split by projectile arrival
    const preOverlayEvts  = otherOverlays
        .filter(o => o.startMs < projArrivalMs)
        .flatMap(o => eventosOverlay(o, atacanteKey));
    const postOverlayEvts = otherOverlays
        .filter(o => o.startMs >= projArrivalMs)
        .flatMap(o => {
            // Normalize timing to be relative to projectile arrival
            return eventosOverlay(o, atacanteKey).map(e => ({
                ...e,
                at: e.at - projArrivalMs,
            }));
        });

    // Projectile creation event — stores ref in closure when it fires
    let projectileRef = null;
    const projCreationEvent = projOverlay ? {
        at: projOverlay.startMs,
        run() {
            const arenaRect = els.arena?.getBoundingClientRect();
            const origemEl  = els.fighters[atacanteKey]?.root;
            const alvoEl    = els.fighters[defensorKey]?.root;
            if (!arenaRect || !origemEl || !alvoEl) return;
            const pos = posicoes(projOverlay, atacanteKey, origemEl, alvoEl, arenaRect);
            const ref = criarProjetil(projOverlay, pos);
            // Clash system manages removal — disable default onfinish
            ref.animation.onfinish = null;
            projectileRef = ref;
        },
    } : null;

    // Pre events: frames + pre-arrival audio + pre-arrival overlays + projectile creation
    const preEvents = [
        ...frameEvts,
        ...preAudio,
        ...preOverlayEvts,
        ...(projCreationEvent ? [projCreationEvent] : []),
    ];

    // Post events: post-arrival overlays + audio (timing relative to projectile arrival)
    const postEvents = [...postAudio, ...postOverlayEvts];

    return {
        preEvents,
        postEvents,
        projectileStartMs: projOverlay?.startMs ?? 0,
        getProjectileRef: () => projectileRef,
    };
}
```

- [ ] **Step 2: Expose `rodarTimeline`, `wait`, and `montarAnimacaoClash` in the returned object**

At the bottom of `createAnimationController`, the `return` block currently is:
```js
return {
    feedbackDano,
    wait,
    mostrarSplashErroInsano,
    rodarTimeline,
    cancelarAnimacao,
    montarAnimacao,
    visualPersonagem,
    animarEsquiva,
    animarMorte,
    animarTransformacao,
};
```

Replace with:
```js
return {
    feedbackDano,
    wait,
    mostrarSplashErroInsano,
    rodarTimeline,
    cancelarAnimacao,
    montarAnimacao,
    montarAnimacaoClash,
    visualPersonagem,
    animarEsquiva,
    animarMorte,
    animarTransformacao,
};
```

(`wait` and `rodarTimeline` were already exported — no change needed there, just confirm they are present.)

- [ ] **Step 3: Verify no JS errors**

Open browser DevTools. `animations.montarAnimacaoClash` should be a function. No errors on page load.

- [ ] **Step 4: Commit**

```bash
git add frontend/battle-animations.js
git commit -m "feat: add montarAnimacaoClash with pre/post event split"
```

---

## Task 6 — Create `clash-system.js`

**Files:**
- Create: `frontend/clash-system.js`

- [ ] **Step 1: Create the file**

```js
/**
 * Clash system — orchestrates the visual projectile clash sequence.
 *
 * runClash(ref1, ref2, clashMeta, postEvents1, postEvents2, anim):
 *   ref1/ref2      — { el, animation } for p1/p2 projectiles
 *   clashMeta      — { winner: 'p1'|'p2', durationMs: number }
 *   postEvents1/2  — timeline events to fire after each projectile reaches target
 *                    (timing relative to projectile arrival, i.e. at=0 means "on impact")
 *   anim           — animation controller (for rodarTimeline + wait)
 */
export function createClashSystem() {
    return { runClash };

    async function runClash(ref1, ref2, clashMeta, postEvents1, postEvents2, anim) {
        // 1. Poll until projectiles overlap by ≥20% of the smaller sprite width
        await waitForOverlap(ref1.el, ref2.el, 0.20);

        // 2. Freeze both at current position
        freezeAtCurrentPosition(ref1);
        freezeAtCurrentPosition(ref2);

        // 3. Start shake on both
        ref1.el.classList.add("clash-shaking");
        ref2.el.classList.add("clash-shaking");

        // 4. Hold for clash duration
        await anim.wait(clashMeta.durationMs);

        // 5. Identify winner/loser refs and their post-impact events
        const winnerRef    = clashMeta.winner === "p1" ? ref1 : ref2;
        const loserRef     = clashMeta.winner === "p1" ? ref2 : ref1;
        const winnerPost   = clashMeta.winner === "p1" ? postEvents1 : postEvents2;

        // 6. Remove loser
        loserRef.el.classList.remove("clash-shaking");
        loserRef.el.remove();
        loserRef.animation.cancel();

        // 7. Resume winner
        winnerRef.el.classList.remove("clash-shaking");
        winnerRef.animation.play();

        // 8. Wait for winner to reach target, then fire post-impact events
        await new Promise(resolve => {
            winnerRef.animation.onfinish = () => {
                winnerRef.el.remove();
                resolve();
            };
        });

        if (winnerPost.length > 0) {
            const handle = anim.rodarTimeline(winnerPost);
            await anim.wait(handle.duration);
        }
    }

    /**
     * Pauses the Web Animations API animation and locks the element's
     * current animated position into its inline style so it stays put.
     */
    function freezeAtCurrentPosition(ref) {
        // Read the animated position before pausing
        const computed = window.getComputedStyle(ref.el);
        const frozenLeft = computed.left;
        const frozenTop  = computed.top;

        ref.animation.pause();

        // Override inline style to the frozen position so that when the
        // animation is later cancelled and re-created it starts from here
        ref.el.style.left = frozenLeft;
        ref.el.style.top  = frozenTop;
    }

    /**
     * Polls via requestAnimationFrame until the horizontal overlap between
     * the two projectile elements is ≥ threshold fraction of the smaller width.
     * Resolves immediately if either element is removed from the DOM.
     */
    function waitForOverlap(el1, el2, threshold) {
        return new Promise(resolve => {
            function check() {
                if (!el1.isConnected || !el2.isConnected) { resolve(); return; }
                const r1 = el1.getBoundingClientRect();
                const r2 = el2.getBoundingClientRect();
                const overlapW = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
                const smaller  = Math.min(r1.width, r2.width);
                if (smaller > 0 && overlapW / smaller >= threshold) { resolve(); return; }
                requestAnimationFrame(check);
            }
            requestAnimationFrame(check);
        });
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/clash-system.js
git commit -m "feat: add clash-system.js — visual clash orchestration"
```

---

## Task 7 — Wire clash system into `app.js`

**Files:**
- Modify: `frontend/app.js`

- [ ] **Step 1: Import `createClashSystem` at the top of `app.js`**

After the existing imports (lines 1–2), add:
```js
import { createClashSystem } from "./clash-system.js";
```

- [ ] **Step 2: Instantiate the clash system alongside the animation controller**

Around line 399, after `animations = createAnimationController(...)`:
```js
animations = createAnimationController({ state, els, atualizarHUD });
const clashSystem = createClashSystem();
```

- [ ] **Step 3: Add `executarTurnoClash()` helper function inside the IIFE, before `processarAcao()`**

```js
async function executarTurnoClash(acoesMap, clashMeta, estadoFinal) {
    // Determine which key is p1 and which is p2 from acoesMap
    const key1 = "p1";
    const key2 = "p2";
    const acao1 = acoesMap[key1];
    const acao2 = acoesMap[key2];

    if (!acao1 || !acao2) return;

    const animData1 = animations.montarAnimacaoClash(key1, acao1, key2);
    const animData2 = animations.montarAnimacaoClash(key2, acao2, key1);

    // Merge pre-events from both characters and run simultaneously
    const allPreEvents = [...animData1.preEvents, ...animData2.preEvents];
    const handle = animations.rodarTimeline(allPreEvents);
    state.anim = handle;

    // Wait until both projectiles are in flight (max of both startMs + small buffer)
    const bothLaunchedMs = Math.max(animData1.projectileStartMs, animData2.projectileStartMs) + 80;
    await animations.wait(bothLaunchedMs);

    const ref1 = animData1.getProjectileRef();
    const ref2 = animData2.getProjectileRef();

    if (ref1 && ref2) {
        await clashSystem.runClash(
            ref1, ref2, clashMeta,
            animData1.postEvents, animData2.postEvents,
            animations
        );
    } else {
        // Fallback: no projectile refs (config issue) — just wait out the clash duration
        await animations.wait(clashMeta.durationMs);
    }

    animations.cancelarAnimacao();
}
```

- [ ] **Step 4: Add clash branch inside `processarAcao()`, after `acoesMap` is built**

Find this block in `processarAcao()` (around line 280):
```js
// Filtra apenas ataques que têm animação (ignora skip)
const ordemAnimada = ordem.filter(k => acoesMap[k] && acoesMap[k].type !== "skip");

for (let i = 0; i < ordemAnimada.length; i++) {
```

**Before** that block, insert:
```js
// ── Clash branch ────────────────────────────────────────────────────
if (resposta.clash?.occurred) {
    await executarTurnoClash(acoesMap, resposta.clash, estadoFinal);
    const estadoAntesDaAtualizacao = state.serverState;
    atualizarEstado(estadoFinal, true);
    atualizarHUD();
    await verificarEAnimarTransformacao(estadoAntesDaAtualizacao, estadoFinal);
    if (mensagem) ui.adicionarLog(mensagem);
    if (resposta.state?.winner) {
        await animations.animarMorte(oposto(resposta.state.winner));
    }
    atualizarHUD();
    return; // skip sequential animation flow
}
// ── End clash branch ─────────────────────────────────────────────────
```

Note: this `return` exits the `try` block cleanly — the `finally` block still runs (re-enables buttons, rebuilds action menu).

- [ ] **Step 5: Full manual test — Gojo vs Sukuna, both use priority projectile in same turn**

Expected sequence:
1. Both characters start their casting animations simultaneously
2. Fire arrow (Sukuna) and purple sphere (Gojo) appear and travel toward each other
3. When ~20% overlap occurs, both freeze and start shaking visibly
4. After 3 seconds (both priority) the loser disappears; winner resumes and hits the target
5. Explosion appears on the hit character
6. Damage applied to only the character who was hit
7. Turn advances normally

- [ ] **Step 6: Test non-priority vs priority clash (1-second)**

If only one character has priority (e.g., add a test case with a non-clashable projectile temporarily given `clashable: true` but `priority: false`), the clash should last 1 second and the priority skill always wins.

- [ ] **Step 7: Test normal (non-clash) turn still works**

Two attacks with no `clashable` flag must play sequentially as before. No regressions.

- [ ] **Step 8: Commit**

```bash
git add frontend/app.js
git commit -m "feat: wire clash system into app.js turn resolution"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| Simultaneous animation start | Task 7 — `executarTurnoClash` runs both `preEvents` in one `rodarTimeline` call |
| Collision at ~20% overlap | Task 6 — `waitForOverlap(el1, el2, 0.20)` |
| No full overlap | Task 6 — freezes on contact, not after |
| Shake during clash | Task 3 + Task 6 — `.clash-shaking` class added on freeze |
| Smart animation pause (no explosion mid-clash) | Task 5 — `postEvents` split out and withheld until after clash |
| 3-second duration (both priority) | Task 2 — backend sets `durationMs: 3000` |
| 1-second duration (one priority) | Task 2 — backend sets `durationMs: 1000` |
| Random winner (both priority) | Task 2 — `random_int(0, 1)` |
| Priority always wins vs non-priority | Task 2 — deterministic winner selection |
| Only winner deals damage | Task 2 — only winner's `executarAcaoPendente` is called |
| Winner resumes animation + final effects | Task 6 — `animation.play()` then `rodarTimeline(winnerPost)` |
| Loser removed cleanly | Task 6 — `el.remove()` + `animation.cancel()` |

### Placeholder scan

No TBD, TODO, or vague steps found.

### Type consistency

- `criarProjetil()` → `{ el, animation }` used consistently in Tasks 4, 5, 6
- `montarAnimacaoClash()` returns `{ preEvents, postEvents, projectileStartMs, getProjectileRef }` used consistently in Tasks 5, 7
- `runClash(ref1, ref2, clashMeta, postEvents1, postEvents2, anim)` signature consistent across Tasks 6 and 7
- `clashMeta.winner` (`'p1'|'p2'`) consistent across Tasks 2, 6, 7
- `clashMeta.durationMs` consistent across Tasks 2, 6, 7
