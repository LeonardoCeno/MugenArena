/**
 * QTE (Quick Time Event) clash system.
 * P1 uses WASD, P2 uses Arrow keys.
 * Shows ONE key at a time — press it to advance. 10 keys total, first to finish wins.
 *
 * Displays two floating side panels leaving the center collision area fully visible.
 */

const P1_KEYS = ['w', 'a', 's', 'd']
const P2_KEYS = ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']

const KEY_LABELS = {
    w: 'W', a: 'A', s: 'S', d: 'D',
    ArrowUp: '↑', ArrowLeft: '←', ArrowDown: '↓', ArrowRight: '→',
}

const P2_KEY_SET = new Set(P2_KEYS)

const SEQUENCE_LENGTH = 10

function generateSequence(keys) {
    const seq = []
    for (let i = 0; i < SEQUENCE_LENGTH; i++) {
        let pick
        do { pick = keys[Math.floor(Math.random() * keys.length)] } while (pick === seq[i - 1])
        seq.push(pick)
    }
    return seq
}

export function createQTESystem() {
    return { runQTE }

    async function runQTE(arenaEl, timeoutMs = 7000) {
        const seq1 = generateSequence(P1_KEYS)
        const seq2 = generateSequence(P2_KEYS)

        return new Promise((resolve) => {
            let p1Progress = 0
            let p2Progress = 0
            let settled    = false

            const p1Panel = document.createElement('div')
            p1Panel.className = 'qte-side-panel qte-side-panel--p1'

            const p2Panel = document.createElement('div')
            p2Panel.className = 'qte-side-panel qte-side-panel--p2'

            const timerEl = document.createElement('div')
            timerEl.className = 'qte-top-bar'
            timerEl.innerHTML = `
                <span class="qte-top-bar__label">CLASH!</span>
                <div class="qte-top-bar__track"><div class="qte-top-bar__fill"></div></div>
            `

            arenaEl.appendChild(timerEl)
            arenaEl.appendChild(p1Panel)
            arenaEl.appendChild(p2Panel)

            renderPanel(p1Panel, 'p1', seq1, 0)
            renderPanel(p2Panel, 'p2', seq2, 0)

            requestAnimationFrame(() => {
                p1Panel.classList.add('is-active')
                p2Panel.classList.add('is-active')
                timerEl.classList.add('is-active')
            })

            const fillEl = timerEl.querySelector('.qte-top-bar__fill')
            if (fillEl) {
                requestAnimationFrame(() => {
                    fillEl.style.transition = `width ${timeoutMs}ms linear`
                    fillEl.style.width = '0%'
                })
            }

            function removeAll() {
                [p1Panel, p2Panel, timerEl].forEach(el => {
                    el.classList.add('is-leaving')
                    setTimeout(() => { if (el.isConnected) el.remove() }, 350)
                })
            }

            let pendingFinishWinner = null
            let pendingFinishTimer  = null

            function finish(winner) {
                if (settled) return
                settled = true
                clearTimeout(timeoutId)
                clearTimeout(pendingFinishTimer)
                document.removeEventListener('keydown', onKey)

                if (winner === 'tie') {
                    p1Panel.classList.add('qte-side-panel--lose')
                    p2Panel.classList.add('qte-side-panel--lose')
                } else {
                    const winPanel  = winner === 'p1' ? p1Panel : p2Panel
                    const losePanel = winner === 'p1' ? p2Panel : p1Panel
                    winPanel.classList.add('qte-side-panel--win')
                    losePanel.classList.add('qte-side-panel--lose')
                }

                setTimeout(removeAll, 500)
                resolve(winner)
            }

            function tryFinish(candidate) {
                if (settled) return
                if (pendingFinishWinner === null) {
                    pendingFinishWinner = candidate
                    pendingFinishTimer  = setTimeout(() => finish(pendingFinishWinner), 180)
                } else {
                    // Both finished within 180ms window → tie
                    finish('tie')
                }
            }

            const timeoutId = setTimeout(() => {
                if (p1Progress > p2Progress) finish('p1')
                else if (p2Progress > p1Progress) finish('p2')
                else finish('tie')
            }, timeoutMs)

            function onKey(e) {
                if (settled) return

                const lk = e.key.toLowerCase()

                if (P1_KEYS.includes(lk) && p1Progress < seq1.length) {
                    e.preventDefault()
                    if (lk === seq1[p1Progress]) {
                        p1Progress++
                        flashHit(p1Panel, () => {
                            renderPanel(p1Panel, 'p1', seq1, p1Progress)
                            if (p1Progress >= seq1.length) tryFinish('p1')
                        })
                    } else {
                        p1Progress = Math.max(0, p1Progress - 1)
                        flashError(p1Panel)
                        renderPanel(p1Panel, 'p1', seq1, p1Progress)
                    }
                }

                if (P2_KEY_SET.has(e.key) && p2Progress < seq2.length) {
                    e.preventDefault()
                    if (e.key === seq2[p2Progress]) {
                        p2Progress++
                        flashHit(p2Panel, () => {
                            renderPanel(p2Panel, 'p2', seq2, p2Progress)
                            if (p2Progress >= seq2.length) tryFinish('p2')
                        })
                    } else {
                        p2Progress = Math.max(0, p2Progress - 1)
                        flashError(p2Panel)
                        renderPanel(p2Panel, 'p2', seq2, p2Progress)
                    }
                }
            }

            document.addEventListener('keydown', onKey)
        })
    }

    function renderPanel(panelEl, player, sequence, progress) {
        if (!panelEl) return

        const isP2    = player === 'p2'
        const title   = isP2 ? 'JOGADOR 2' : 'JOGADOR 1'
        const hint    = isP2 ? '← ↑ ↓ →' : 'W A S D'
        const done    = progress >= sequence.length

        const currentKey   = !done ? sequence[progress] : null
        const nextKey      = !done && progress + 1 < sequence.length ? sequence[progress + 1] : null
        const currentLabel = currentKey ? (KEY_LABELS[currentKey] || currentKey.toUpperCase()) : '✓'
        const nextLabel    = nextKey    ? (KEY_LABELS[nextKey]    || nextKey.toUpperCase())    : null

        panelEl.innerHTML = `
            <div class="qte-side-panel__label">${title}</div>
            <div class="qte-side-panel__hint">${hint}</div>
            <div class="qte-side-panel__key-row">
                <div class="qte-side-panel__current-key ${done ? 'qte-side-panel__current-key--done' : ''}">
                    ${currentLabel}
                </div>
                ${nextLabel ? `<div class="qte-side-panel__next-key">${nextLabel}</div>` : ''}
            </div>
            <div class="qte-side-panel__dots">
                ${sequence.map((_, i) => `<span class="qte-dot${i < progress ? ' done' : i === progress ? ' active' : ''}"></span>`).join('')}
            </div>
        `
    }

    function flashHit(panelEl, cb) {
        if (!panelEl) { cb?.(); return }
        const currentEl = panelEl.querySelector('.qte-side-panel__current-key')
        const nextEl    = panelEl.querySelector('.qte-side-panel__next-key')
        const DURATION  = 160

        if (currentEl) {
            currentEl.animate([
                { transform: 'translateX(0) scale(1)', opacity: 1 },
                { transform: 'translateX(-52px) scale(0.55)', opacity: 0 },
            ], { duration: DURATION, easing: 'ease-in', fill: 'forwards' })
        }

        if (currentEl && nextEl) {
            const curRect = currentEl.getBoundingClientRect()
            const nxtRect = nextEl.getBoundingClientRect()
            const dx      = (curRect.left + curRect.width  / 2) - (nxtRect.left + nxtRect.width  / 2)
            const scaleTo = curRect.width / nxtRect.width

            nextEl.animate([
                { transform: 'translateX(0) scale(1)',          opacity: 0.45 },
                { transform: `translateX(${dx}px) scale(${scaleTo})`, opacity: 1   },
            ], { duration: DURATION, easing: 'ease-out', fill: 'forwards' })
        }

        setTimeout(() => cb?.(), DURATION)
    }

    function flashError(panelEl) {
        if (!panelEl) return
        panelEl.classList.remove('qte-side-panel--error')
        void panelEl.offsetWidth
        panelEl.classList.add('qte-side-panel--error')
        setTimeout(() => panelEl.classList.remove('qte-side-panel--error'), 300)
    }
}
