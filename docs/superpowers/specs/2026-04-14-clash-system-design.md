# Clash System Design
**Date:** 2026-04-14  
**Status:** Approved

---

## Overview

When two players simultaneously use skills with projectile overlays, a visual "clash of forces" plays out before damage is applied. The backend resolves who wins; the frontend orchestrates the collision animation.

---

## 1. Clash Trigger Conditions

A clash occurs when both players submit a `skill` action in the same turn AND both skills have `clashable: true`.

The `clashable` flag is set on skills that fire a `projectile`-mode overlay. It is distinct from `priority`, which governs standard turn order.

### Outcome rules
| p1 priority | p2 priority | Winner | Duration |
|---|---|---|---|
| true | true | random 50/50 | 3000 ms |
| true | false | p1 always | 1000 ms |
| false | true | p2 always | 1000 ms |

---

## 2. Backend Changes

### 2a. Skill flag additions

**`Sukuna.php` — Kamino Fuga:**
```php
'priority'  => true,
'clashable' => true,
```

**`Gojo.php` — Vazio Roxo:**
```php
'priority'  => true,
'clashable' => true,
```

### 2b. `GameService.php`

**New helper `acaoEhClashavel(Personagem $p, array $acao): bool`**  
Returns true if action is `skill` type and the skill has both `clashable: true` and `priority: true` (or just `clashable: true` for the weak-vs-strong case).  
Actually: returns true if skill has `clashable: true` (priority is checked separately for outcome).

**`executarTurnoSimultaneo()` — new branch at the top:**
```php
if (self::acaoEhClashavel($game['p1'], $a1) && self::acaoEhClashavel($game['p2'], $a2)) {
    return self::resolverClash($game, 'p1', $a1, 'p2', $a2);
}
```

**New method `resolverClash(array &$game, ...): array`**
1. Determine winner:
   - Both have `priority: true` → `random_int(0, 1) === 0 ? 'p1' : 'p2'`
   - Only one has `priority: true` → that one wins
2. Execute only winner's action via `executarAcaoPendente($game, $winnerKey)`
3. Clear loser's pending action without executing
4. Advance turn normally (turno++, regenerate energy, continuous effects)
5. Return standard result shape plus:
```php
'clash' => [
    'occurred'   => true,
    'winner'     => $winnerKey,   // 'p1' or 'p2'
    'durationMs' => 3000 | 1000,
]
```

**`exportarEstado()` and `submeterAcao()`:** pass `clash` key through to the JSON response unchanged.

---

## 3. Frontend Architecture

### 3a. `battle-animations.js` — `criarProjetil()` rewrite

Switch from CSS `transition` to Web Animations API:

```js
function criarProjetil(overlay, pos) {
    const el = document.createElement("img");
    // ... same setup (class, src, initial inline style for size/flip/rotate) ...
    // Set initial position via inline style (not transition target)
    el.style.cssText = `width:${sizePx}px; left:${pos.origemX}px; top:${pos.origemY}px;
        transform: translate(-50%,-50%) scaleX(${pos.escalaHorizontal}) scale(${overlay.scale ?? 1}) rotate(${pos.anguloProjetil}deg);`;
    els.arena.appendChild(el);
    void el.getBoundingClientRect();

    const animation = el.animate(
        [
            { left: `${pos.origemX}px`, top: `${pos.origemY}px` },
            { left: `${pos.alvoX}px`,   top: `${pos.alvoY}px`   }
        ],
        { duration: overlay.durationMs, fill: 'forwards', easing: 'linear' }
    );
    // Default: remove on finish (non-clash path)
    animation.onfinish = () => el.remove();

    return { el, animation };
}
```

`criarOverlay()` updated to return `{ el, animation? }` — only `projectile` mode returns `animation`.

### 3b. Timeline splitting for clash support

`montarAnimacao()` gains a second return value: `projectileRef` — the `{ el, animation }` of the first `projectile`-mode overlay found for this attacker.

Also splits events into:
- `preEvents`: all events with `at < projectile.startMs` (character frames, pre-impact audio)
- `postEvents`: all events with `at >= projectile.startMs + projectile.durationMs` (explosion overlay, post-impact audio)

For normal (non-clash) turns, all events run as before. For clash turns, `postEvents` are withheld and re-fired by the clash system after resolution.

### 3c. New file `frontend/clash-system.js`

```js
export function createClashSystem({ els }) {
    return { runClash };

    async function runClash(ref1, ref2, clashMeta, postEvents1, postEvents2) {
        // ref1/ref2: { el, animation } for p1/p2 projectiles
        // clashMeta: { winner, durationMs }
        // postEvents1/2: arrays of { at, run } to fire after winner reaches target

        // 1. Poll for 20% overlap
        await waitForOverlap(ref1.el, ref2.el, 0.20);

        // 2. Freeze both at contact point
        freezeAtCurrentPosition(ref1);
        freezeAtCurrentPosition(ref2);

        // 3. Shake both
        ref1.el.classList.add('clash-shaking');
        ref2.el.classList.add('clash-shaking');

        // 4. Wait clash duration
        await wait(clashMeta.durationMs);

        // 5. Remove loser
        const loserRef  = clashMeta.winner === 'p1' ? ref2 : ref1;
        const winnerRef = clashMeta.winner === 'p1' ? ref1 : ref2;
        const winnerPostEvents = clashMeta.winner === 'p1' ? postEvents1 : postEvents2;

        loserRef.el.remove();
        loserRef.animation.cancel();

        // 6. Resume winner
        winnerRef.el.classList.remove('clash-shaking');
        winnerRef.animation.play();

        // 7. After winner animation finishes, fire post-impact events
        await new Promise(resolve => { winnerRef.animation.onfinish = resolve; });
        rodarTimeline(winnerPostEvents); // re-use existing timeline runner
    }

    function freezeAtCurrentPosition(ref) {
        const computed = getComputedStyle(ref.el);
        ref.el.style.left = computed.left;
        ref.el.style.top  = computed.top;
        ref.animation.cancel();
        // Re-animate to same position (effectively frozen)
        ref.animation = ref.el.animate(
            [{ left: computed.left, top: computed.top }],
            { duration: 1, fill: 'forwards' }
        );
        ref.animation.pause();
    }

    function waitForOverlap(el1, el2, threshold) {
        return new Promise(resolve => {
            function check() {
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

### 3d. `app.js` — clash branch in `processarAcao()`

```js
if (resposta.clash?.occurred) {
    // Launch both character frame animations simultaneously
    const { preEvents: pre1, postEvents: post1, projectileRef: pRef1 } =
        animations.montarAnimacaoClash(key1, acao1, key2, defensor1Defending);
    const { preEvents: pre2, postEvents: post2, projectileRef: pRef2 } =
        animations.montarAnimacaoClash(key2, acao2, key1, defensor2Defending);

    animations.rodarTimeline([...pre1, ...pre2]); // both start at t=0

    await clashSystem.runClash(pRef1, pRef2, resposta.clash, post1, post2);

    // Apply final state (only winner's damage is in estadoFinal)
    atualizarEstado(estadoFinal, true);
    atualizarHUD();
} else {
    // existing sequential flow — unchanged
}
```

---

## 4. CSS (`batalha.css`)

```css
/* Clash shake — uses standalone `translate` to avoid conflicting with
   existing inline `transform` (scaleX flip + rotate on projectile el) */
.clash-shaking {
    animation: clash-shake 0.08s infinite alternate;
}

@keyframes clash-shake {
    from { translate: -4px 0; }
    to   { translate:  4px 0; }
}
```

---

## 5. File Change Summary

| File | Change |
|---|---|
| `backend/GameService.php` | `acaoEhClashavel()`, `resolverClash()`, clash branch in `executarTurnoSimultaneo()` |
| `backend/characters/sukuna/Sukuna.php` | Add `clashable: true` to Kamino Fuga |
| `backend/characters/gojo/Gojo.php` | Add `priority: true, clashable: true` to Vazio Roxo |
| `frontend/battle-animations.js` | `criarProjetil()` → Web Animations API; `montarAnimacaoClash()` with event split |
| `frontend/clash-system.js` | New file — full clash visual orchestration |
| `frontend/app.js` | Clash branch in `processarAcao()`; import clash system |
| `frontend/batalha.css` | `clash-shake` keyframe + `.clash-shaking` class |

---

## 6. Non-goals

- Clash between melee/domain priority skills — no visual clash, existing order logic applies
- Clash between 3+ simultaneous projectiles — not possible in 2-player game
- Networked sync — this is a local turn-based game, no sync needed
