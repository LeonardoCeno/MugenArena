/**
 * Clash system — orchestrates the visual projectile clash sequence.
 *
 * runClash(ref1, ref2, clashMeta, postEvents1, postEvents2, anim):
 *   ref1/ref2      — { el, animation } for p1/p2 projectiles
 *   clashMeta      — { winner: 'p1'|'p2', durationMs: number }
 *   postEvents1/2  — timeline events to fire after each projectile reaches target
 *                    (timing relative to projectile arrival, i.e. at=0 = on impact)
 *   anim           — animation controller ({ wait, rodarTimeline })
 */
export function createClashSystem() {
    const BEAM_TOUCH_EARLY_MULTIPLIER = 1.35;
    const BEAM_FRONT_REACH_RATIO = 0.82;

    return { runClash };

    async function runClash(ref1, ref2, clashMeta, postEvents1, postEvents2, anim, refs1 = [], refs2 = []) {
        const overlapResult = await waitForOverlap(ref1, ref2, 0.45, calcularTimeoutDeClash(ref1, ref2));

        if (!ref1.el.isConnected || !ref2.el.isConnected) return;
        if (overlapResult !== "overlap" && overlapResult !== "timeout") return;

        await executarClashSincronizado(ref1, ref2, clashMeta, postEvents1, postEvents2, anim, refs1, refs2);
    }

    async function executarClashSincronizado(ref1, ref2, clashMeta, postEvents1, postEvents2, anim, refs1, refs2) {
        const winnerRef  = clashMeta.winner === "p1" ? ref1 : ref2;
        const loserRef   = clashMeta.winner === "p1" ? ref2 : ref1;
        const winnerPost = clashMeta.winner === "p1" ? postEvents1 : postEvents2;
        const winnerRefs = clashMeta.winner === "p1" ? refs1 : refs2;
        const loserRefs  = clashMeta.winner === "p1" ? refs2 : refs1;

        if (ref1.el.isConnected) freezeAtCurrentPosition(ref1);
        if (ref2.el.isConnected) freezeAtCurrentPosition(ref2);

        const ref1Anchor = ref1.el.isConnected ? getCenterInArena(ref1) : null;
        const ref2Anchor = ref2.el.isConnected ? getCenterInArena(ref2) : null;
        const stopSync1 = monitorarProjeteisSecundarios(refs1, ref1, ref1Anchor, anim);
        const stopSync2 = monitorarProjeteisSecundarios(refs2, ref2, ref2Anchor, anim);

        const arena    = getArenaElement(ref1) ?? getArenaElement(ref2);
        const midpoint = (ref1Anchor && ref2Anchor)
            ? { x: (ref1Anchor.x + ref2Anchor.x) / 2, y: (ref1Anchor.y + ref2Anchor.y) / 2 }
            : ref1Anchor ?? ref2Anchor;

        const cleanupLight      = criarLuzDeClash(ref1, ref2, clashMeta.durationMs);
        const cleanupArenaShake = aplicarShakeArena(arena);

        if (midpoint) {
            criarFlashDeImpacto(arena, midpoint);
            criarAnelDeChoque(arena, midpoint);
            setTimeout(() => criarAnelDeChoque(arena, midpoint, true), 160);
        }

        if (ref1.el.isConnected) ref1.el.classList.add("clash-shaking");
        if (ref2.el.isConnected) ref2.el.classList.add("clash-shaking");

        await anim.wait(clashMeta.durationMs);
        cleanupLight(true);
        cleanupArenaShake();
        stopSync1();
        stopSync2();

        removerProjeteisSecundarios(loserRefs, loserRef);

        if (loserRef.el.isConnected) {
            loserRef.el.classList.remove("clash-shaking");
            loserRef.el.remove();
        }
        loserRef.animation.cancel();
        loserRef.beamEl?.remove();

        if (winnerRef.el.isConnected) {
            await continuarFormacaoAteAlvo(winnerRefs, winnerRef, anim);
        }

        if (winnerPost.length > 0) {
            const handle = anim.rodarTimeline(winnerPost);
            await anim.wait(handle.duration);
        }
    }

    /**
     * Pauses the Web Animations API animation at its current frame.
     * WAAPI fill:"forwards" with composite:"replace" holds the animated
     * position regardless of inline style — animation.pause() alone is
     * sufficient. animation.play() will resume from this exact frame.
     */
    function freezeAtCurrentPosition(ref) {
        ref.animation.pause();
        if (ref.tipo === "beam" && ref.beamEl) {
            const w = parseFloat(getComputedStyle(ref.beamEl).width) || 0;
            ref.beamEl.style.transition = "none";
            ref.beamEl.style.width = `${w}px`;
            void ref.beamEl.getBoundingClientRect();
        }
    }

    function calcularTimeoutDeClash(ref1, ref2) {
        const timing1 = Number(ref1?.animation?.effect?.getTiming?.().duration ?? 0);
        const timing2 = Number(ref2?.animation?.effect?.getTiming?.().duration ?? 0);
        return Math.max(timing1, timing2) + 1200;
    }

    function getAnimationRemainingMs(ref) {
        const total = Number(ref?.animation?.effect?.getTiming?.().duration ?? 0);
        const current = Number(ref?.animation?.currentTime ?? 0);
        return Math.max(0, total - current);
    }

    function getArenaRect(ref) {
        return ref.el.parentElement?.getBoundingClientRect() ?? null;
    }

    function getArenaElement(ref) {
        return ref.el.parentElement ?? null;
    }

    function getCenterInArena(ref) {
        const arenaRect = getArenaRect(ref);
        const rect = ref.el.getBoundingClientRect();
        if (!arenaRect) {
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
            };
        }

        return {
            x: rect.left - arenaRect.left + rect.width / 2,
            y: rect.top - arenaRect.top + rect.height / 2,
        };
    }

    function setProjectilePosition(ref, point) {
        ref.el.style.left = `${point.x}px`;
        ref.el.style.top = `${point.y}px`;
    }

    function aplicarShakeArena(arena) {
        if (!arena) return () => {};
        arena.classList.add("clash-arena-shaking");
        return () => arena.classList.remove("clash-arena-shaking");
    }

    function criarFlashDeImpacto(arena, midpoint) {
        if (!arena) return;
        const flash = document.createElement("div");
        flash.className = "clash-impact-flash";
        flash.style.left = `${midpoint.x}px`;
        flash.style.top  = `${midpoint.y}px`;
        arena.appendChild(flash);
        flash.addEventListener("animationend", () => flash.remove(), { once: true });
    }

    function criarAnelDeChoque(arena, midpoint, secondary = false) {
        if (!arena) return;
        const ring = document.createElement("div");
        ring.className = "clash-shockwave-ring";
        if (secondary) ring.classList.add("is-secondary");
        ring.style.left = `${midpoint.x}px`;
        ring.style.top  = `${midpoint.y}px`;
        arena.appendChild(ring);
        ring.addEventListener("animationend", () => ring.remove(), { once: true });
    }

    function criarLuzDeClash(ref1, ref2, durationMs) {
        const arena = getArenaElement(ref1) ?? getArenaElement(ref2);
        if (!arena) {
            return () => {};
        }

        const luz = document.createElement("div");
        luz.className = "clash-light-core";
        arena.appendChild(luz);

        const startedAt = performance.now();
        let frameId = 0;
        let active = true;

        const render = (now) => {
            if (!active) return;

            if (!ref1.el.isConnected || !ref2.el.isConnected) {
                cleanup();
                return;
            }

            const center1 = getCenterInArena(ref1);
            const center2 = getCenterInArena(ref2);
            const midpoint = {
                x: (center1.x + center2.x) / 2,
                y: (center1.y + center2.y) / 2,
            };
            const progress = clamp(0, (now - startedAt) / Math.max(1, durationMs), 1);
            const size = 60 + (progress * 152);
            const glow = 24 + (progress * 64);
            const alpha = 0.68 + (progress * 0.3);

            luz.style.left = `${midpoint.x}px`;
            luz.style.top = `${midpoint.y}px`;
            luz.style.width = `${size}px`;
            luz.style.height = `${size}px`;
            luz.style.opacity = `${alpha}`;
            luz.style.setProperty("--clash-glow", `${glow}px`);
            luz.style.setProperty("--clash-progress", `${progress}`);

            frameId = requestAnimationFrame(render);
        };

        const cleanup = (immediate = false) => {
            if (!active) return;
            active = false;
            cancelAnimationFrame(frameId);

            if (immediate) {
                luz.remove();
                return;
            }

            luz.classList.add("is-fading");
            setTimeout(() => luz.remove(), 220);
        };

        frameId = requestAnimationFrame(render);
        return cleanup;
    }

    function clamp(min, value, max) {
        return Math.max(min, Math.min(max, value));
    }

    function removerProjeteisSecundarios(refs, primaryRef) {
        for (const ref of refs) {
            if (!ref || ref === primaryRef) continue;
            ref.animation.cancel();
            ref.el.classList.remove("clash-shaking");
            if (ref.el.isConnected) ref.el.remove();
            ref.beamEl?.remove();
        }
    }

    function monitorarProjeteisSecundarios(refs, primaryRef, anchorPoint, anim) {
        if (!anchorPoint || !Array.isArray(refs)) {
            return () => {};
        }

        const control = { active: true };
        const processed = new WeakSet();

        const tick = () => {
            if (!control.active) return;

            for (const ref of refs) {
                if (!ref || ref === primaryRef || processed.has(ref) || !ref.el.isConnected) continue;
                processed.add(ref);
                const queuePoint = calcularPosicaoNaFilaDeClash(refs, primaryRef, ref, anchorPoint);
                void ancorarProjetilSecundario(ref, queuePoint, anim, control);
            }

            requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);

        return () => {
            control.active = false;
        };
    }

    async function ancorarProjetilSecundario(ref, anchorPoint, anim, control) {
        if (!ref.el.isConnected) return;

        const current = getCenterInArena(ref);
        const target = ref?.pos ? { x: ref.pos.alvoX, y: ref.pos.alvoY } : null;
        const remainingMs = Math.max(0, getAnimationRemainingMs(ref));
        const distanceToAnchor = Math.hypot(anchorPoint.x - current.x, anchorPoint.y - current.y);
        const distanceToTarget = target
            ? Math.max(1, Math.hypot(target.x - current.x, target.y - current.y))
            : Math.max(1, distanceToAnchor);
        const travelMs = Math.max(80, Math.round(remainingMs * (distanceToAnchor / distanceToTarget)));

        ref.animation.cancel();
        ref.el.style.transition = `left ${travelMs}ms linear, top ${travelMs}ms linear`;
        setProjectilePosition(ref, current);
        void ref.el.getBoundingClientRect();
        setProjectilePosition(ref, anchorPoint);
        await anim.wait(travelMs);

        if (!control?.active) return;
        if (!ref.el.isConnected) return;
        ref.el.style.transition = "none";
        setProjectilePosition(ref, anchorPoint);
        ref.el.classList.add("clash-shaking");
    }

    function calcularPosicaoNaFilaDeClash(refs, primaryRef, ref, anchorPoint) {
        const secondaries = refs.filter(candidate => candidate && candidate !== primaryRef);
        const targetIndex = secondaries.indexOf(ref);
        if (targetIndex < 0) return anchorPoint;

        const direction = getDirecaoDoProjetil(primaryRef);
        let distance = 0;
        let previousRef = primaryRef;

        for (let index = 0; index <= targetIndex; index += 1) {
            const currentRef = secondaries[index];
            distance += calcularEspacamentoEntreProjeteis(previousRef, currentRef);
            previousRef = currentRef;
        }

        return {
            x: anchorPoint.x - (direction.x * distance),
            y: anchorPoint.y - (direction.y * distance),
        };
    }

    function getDirecaoDoProjetil(ref) {
        const deltaX = Number(ref?.pos?.alvoX ?? 0) - Number(ref?.pos?.origemX ?? 0);
        const deltaY = Number(ref?.pos?.alvoY ?? 0) - Number(ref?.pos?.origemY ?? 0);
        const magnitude = Math.hypot(deltaX, deltaY);

        if (magnitude <= 0.001) {
            return { x: ref?.atacanteKey === "p2" ? -1 : 1, y: 0 };
        }

        return {
            x: deltaX / magnitude,
            y: deltaY / magnitude,
        };
    }

    function calcularEspacamentoEntreProjeteis(previousRef, currentRef) {
        const previousWidth = getProjectileWidth(previousRef);
        const currentWidth = getProjectileWidth(currentRef);
        const maxOverlap = Math.min(currentWidth, previousWidth * 0.85);
        const centerDistance = ((previousWidth + currentWidth) / 2) - maxOverlap;
        return Math.max(12, centerDistance);
    }

    function getProjectileWidth(ref) {
        if (ref?.el?.isConnected) {
            return Math.max(1, ref.el.getBoundingClientRect().width);
        }

        if (ref?.overlay?.sizePx && ref?.pos?.arenaW) {
            return Math.max(1, ref.overlay.sizePx * (ref.pos.arenaW / 1000));
        }

        return 1;
    }

    async function continuarFormacaoAteAlvo(refs, primaryRef, anim) {
        const group = Array.isArray(refs) && refs.length > 0 ? refs.filter(Boolean) : [primaryRef];
        const remainingMs = Math.max(0, Number(primaryRef.remainingMs ?? getAnimationRemainingMs(primaryRef)));
        const primaryTarget = primaryRef?.pos ? { x: primaryRef.pos.alvoX, y: primaryRef.pos.alvoY } : null;

        if (!primaryTarget) {
            removerGrupoDeProjeteis(group);
            return;
        }

        if (remainingMs <= 16) {
            removerGrupoDeProjeteis(group);
            return;
        }

        for (const ref of group) {
            if (!ref?.el?.isConnected) continue;

            const targetPoint = ref === primaryRef
                ? primaryTarget
                : calcularPosicaoNaFilaDeClash(group, primaryRef, ref, primaryTarget);

            const currentPoint = getCenterInArena(ref);

            if (ref === primaryRef && ref.tipo === "beam" && ref.animation?.playState === "paused") {
                ref.el.classList.remove("clash-shaking");
                if (ref.beamEl?.isConnected) {
                    ref.beamEl.style.transition = `width ${remainingMs}ms ease-out`;
                    void ref.beamEl.getBoundingClientRect();
                    ref.beamEl.style.width = `${ref.targetWidth}px`;
                }
                ref.animation.play();
                continue;
            }

            ref.animation.cancel();
            ref.el.classList.remove("clash-shaking");
            ref.el.style.transition = `left ${remainingMs}ms linear, top ${remainingMs}ms linear`;
            setProjectilePosition(ref, currentPoint);
            void ref.el.getBoundingClientRect();
            setProjectilePosition(ref, targetPoint);

            if (ref.tipo === "beam" && ref.beamEl?.isConnected) {
                ref.beamEl.style.transition = `width ${remainingMs}ms linear`;
                void ref.beamEl.getBoundingClientRect();
                ref.beamEl.style.width = `${ref.targetWidth}px`;
            }
        }

        await anim.wait(remainingMs);
        removerGrupoDeProjeteis(group);
    }

    function removerGrupoDeProjeteis(refs) {
        for (const ref of refs) {
            if (!ref) continue;
            ref.animation.cancel();
            ref.el.classList.remove("clash-shaking");
            if (ref.el.isConnected) ref.el.remove();
            ref.beamEl?.remove();
        }
    }

    async function continuarProjetilAteAlvo(ref, anim) {
        const remainingMs = Math.max(0, Number(ref.remainingMs ?? getAnimationRemainingMs(ref)));
        const target = ref?.pos ? { x: ref.pos.alvoX, y: ref.pos.alvoY } : null;

        if (!target) {
            ref.el.remove();
            return;
        }

        if (remainingMs <= 16) {
            ref.el.remove();
            return;
        }

        const current = getCenterInArena(ref);
        ref.animation.cancel();
        ref.el.style.transition = `left ${remainingMs}ms linear, top ${remainingMs}ms linear`;
        setProjectilePosition(ref, current);
        void ref.el.getBoundingClientRect();
        setProjectilePosition(ref, target);
        await anim.wait(remainingMs);
        ref.el.remove();
    }

    /**
     * Polls via requestAnimationFrame until the horizontal overlap between
     * the two projectile elements is >= threshold fraction of the smaller width.
     * Resolves with overlap, timeout, or disconnected.
     */
    function waitForOverlap(ref1, ref2, threshold, timeoutMs) {
        return new Promise(resolve => {
            const startedAt = performance.now();

            function check() {
                const el1 = ref1.el;
                const el2 = ref2.el;

                if ((performance.now() - startedAt) >= timeoutMs) {
                    resolve("timeout");
                    return;
                }

                if (!el1.isConnected || !el2.isConnected) { resolve(); return; }

                if (isBeamRef(ref1) && isBeamRef(ref2)) {
                    if (beamPairTouched(ref1, ref2) || beamFrontsReached(ref1, ref2)) {
                        resolve("overlap");
                        return;
                    }
                    requestAnimationFrame(check);
                    return;
                }

                const r1 = el1.getBoundingClientRect();
                const r2 = el2.getBoundingClientRect();
                const overlapW = Math.max(0,
                    Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left)
                );
                const smaller = Math.min(r1.width, r2.width);
                if (smaller > 0 && overlapW / smaller >= threshold) {
                    resolve("overlap");
                    return;
                }
                requestAnimationFrame(check);
            }
            requestAnimationFrame(check);
        });
    }

    function isBeamRef(ref) {
        return ref?.tipo === "beam" || ref?.overlay?.mode === "beam" || !!ref?.beamEl;
    }

    function beamPairTouched(ref1, ref2) {
        const seg1 = getBeamSegmentFromTip(ref1);
        const seg2 = getBeamSegmentFromTip(ref2);
        if (!seg1 || !seg2) return false;

        const tolerance = (getBeamHalfThickness(ref1) + getBeamHalfThickness(ref2)) * BEAM_TOUCH_EARLY_MULTIPLIER;
        return segmentsDistance(seg1.start, seg1.end, seg2.start, seg2.end) <= tolerance;
    }

    function beamFrontsReached(ref1, ref2) {
        const seg1 = getBeamSegmentFromTip(ref1);
        const seg2 = getBeamSegmentFromTip(ref2);
        if (!seg1 || !seg2) return false;

        const tipDist1 = Math.hypot(seg1.end.x - seg1.start.x, seg1.end.y - seg1.start.y);
        const tipDist2 = Math.hypot(seg2.end.x - seg2.start.x, seg2.end.y - seg2.start.y);
        const originDist = Math.hypot(seg2.start.x - seg1.start.x, seg2.start.y - seg1.start.y);

        if (originDist <= 1) return true;

        // Safety trigger: if both beam fronts already advanced to meeting distance,
        // force clash immediately to avoid pass-through until opponent side.
        return (tipDist1 + tipDist2) >= (originDist * BEAM_FRONT_REACH_RATIO);
    }

    function getBeamSegmentFromTip(ref) {
        const pos = ref?.pos;
        if (!pos || !ref?.el?.isConnected) return null;

        const tip = getCenterInArena(ref);
        return {
            start: {
                x: Number(pos.origemX ?? 0),
                y: Number(pos.origemY ?? 0),
            },
            end: tip,
        };
    }

    function getBeamHalfThickness(ref) {
        return Math.max(8, Number(ref?.overlay?.thicknessPx ?? 26) / 2);
    }

    function pointToSegmentDistance(point, start, end) {
        const segX = end.x - start.x;
        const segY = end.y - start.y;
        const ptX = point.x - start.x;
        const ptY = point.y - start.y;
        const len2 = (segX * segX) + (segY * segY);

        if (len2 <= 1e-9) {
            return Math.hypot(ptX, ptY);
        }

        const t = clamp(0, ((ptX * segX) + (ptY * segY)) / len2, 1);
        const projX = start.x + (segX * t);
        const projY = start.y + (segY * t);
        return Math.hypot(point.x - projX, point.y - projY);
    }

    function segmentsDistance(a1, a2, b1, b2) {
        if (segmentsIntersect(a1, a2, b1, b2)) {
            return 0;
        }

        return Math.min(
            pointToSegmentDistance(a1, b1, b2),
            pointToSegmentDistance(a2, b1, b2),
            pointToSegmentDistance(b1, a1, a2),
            pointToSegmentDistance(b2, a1, a2)
        );
    }

    function segmentsIntersect(a1, a2, b1, b2) {
        const o1 = orientation(a1, a2, b1);
        const o2 = orientation(a1, a2, b2);
        const o3 = orientation(b1, b2, a1);
        const o4 = orientation(b1, b2, a2);

        if (o1 === 0 && onSegment(a1, b1, a2)) return true;
        if (o2 === 0 && onSegment(a1, b2, a2)) return true;
        if (o3 === 0 && onSegment(b1, a1, b2)) return true;
        if (o4 === 0 && onSegment(b1, a2, b2)) return true;

        return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
    }

    function orientation(a, b, c) {
        const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
        if (Math.abs(value) < 1e-6) return 0;
        return value > 0 ? 1 : -1;
    }

    function onSegment(a, b, c) {
        return b.x <= Math.max(a.x, c.x) + 1e-6
            && b.x + 1e-6 >= Math.min(a.x, c.x)
            && b.y <= Math.max(a.y, c.y) + 1e-6
            && b.y + 1e-6 >= Math.min(a.y, c.y);
    }
}
