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
    return { runClash };

    async function runClash(ref1, ref2, clashMeta, postEvents1, postEvents2, anim) {
        // 1. Poll until projectiles overlap by ≥20% of the smaller sprite width
        await waitForOverlap(ref1.el, ref2.el, 0.20);

        // Guard: if either element was removed during the overlap wait, abort cleanly
        if (!ref1.el.isConnected || !ref2.el.isConnected) return;

        // 2. Freeze both at current animated position
        freezeAtCurrentPosition(ref1);
        freezeAtCurrentPosition(ref2);

        // 3. Shake both
        ref1.el.classList.add("clash-shaking");
        ref2.el.classList.add("clash-shaking");

        // 4. Hold for clash duration
        await anim.wait(clashMeta.durationMs);

        // 5. Identify winner and loser
        const winnerRef  = clashMeta.winner === "p1" ? ref1 : ref2;
        const loserRef   = clashMeta.winner === "p1" ? ref2 : ref1;
        const winnerPost = clashMeta.winner === "p1" ? postEvents1 : postEvents2;

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
     * Pauses the Web Animations API animation at its current frame.
     * WAAPI fill:"forwards" with composite:"replace" holds the animated
     * position regardless of inline style — animation.pause() alone is
     * sufficient. animation.play() will resume from this exact frame.
     */
    function freezeAtCurrentPosition(ref) {
        ref.animation.pause();
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
                const overlapW = Math.max(0,
                    Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left)
                );
                const smaller = Math.min(r1.width, r2.width);
                if (smaller > 0 && overlapW / smaller >= threshold) { resolve(); return; }
                requestAnimationFrame(check);
            }
            requestAnimationFrame(check);
        });
    }
}
