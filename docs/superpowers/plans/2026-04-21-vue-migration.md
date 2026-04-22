# Vue 3 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate MugenArena's vanilla JS frontend to Vue 3 + Vite without breaking any gameplay, animation, clash, audio, or domain system.

**Architecture:** Vue 3 (Composition API) acts purely as the UI layer — all animation, clash, and audio libs remain as-is vanilla JS. `useGame.js` composable holds reactive state and the full `processarAcao` orchestration; components expose DOM refs to the libs via `onMounted`. Vite builds to `frontend/` directly so `./assets/` paths and `../backend/web_api.php` stay valid.

**Tech Stack:** Vue 3, Vite 5, PHP 8.4 + Apache (unchanged), multi-stage Docker build

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `frontend/package.json` | npm/Vite dependencies |
| Create | `frontend/vite.config.js` | Vite config, outDir to `frontend/` root |
| Create | `frontend/index.html` | Vite HTML entry (replaces batalha.html) |
| Create | `frontend/src/main.js` | Mount Vue app, import batalha.css |
| Create | `frontend/src/App.vue` | Root container, phase routing (intro/setup/battle), topbar, tutorial modal, black-hole overlay |
| Create | `frontend/src/composables/useGame.js` | All reactive state + API calls + `processarAcao` orchestration + animation lib init |
| Create | `frontend/src/components/IntroScreen.vue` | Intro hero + showcase panels |
| Create | `frontend/src/components/GameSetup.vue` | Character picker + start button (`.setup-screen` class preserved for black-hole animation) |
| Create | `frontend/src/components/BattleArena.vue` | Arena + HUD layout, collects DOM refs, initializes libs, drives turn animation |
| Create | `frontend/src/components/CharacterCard.vue` | HP/energy card for one fighter (enemy or player side) |
| Create | `frontend/src/components/ActionPanel.vue` | Action button grid with pagination |
| Create | `frontend/src/components/VictoryScreen.vue` | Winner overlay |
| Modify | `Dockerfile` | Multi-stage: Node builds Vue, PHP serves |
| Keep | `frontend/batalla.css` | Unchanged |
| Keep | `frontend/battle-animations.js` | Unchanged vanilla lib |
| Keep | `frontend/clash-system.js` | Unchanged vanilla lib |
| Keep | `frontend/audio-controller.js` | Unchanged vanilla lib |
| Keep | `frontend/black-hole-animation.js` | Unchanged vanilla lib (uses `document.getElementById` internally — IDs preserved in templates) |
| Keep | `frontend/ui-status.js` | No longer imported (logic split into Vue components) |
| Keep | All `backend/` | Completely unchanged |

---

## Task 1: Vite + Vue scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "mugen-arena",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create `frontend/vite.config.js`**

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  root: '.',
  plugins: [vue()],
  build: {
    outDir: '.',
    emptyOutDir: false,
    assetsDir: 'src/assets-built',
    rollupOptions: {
      input: './index.html',
    },
  },
})
```

- [ ] **Step 3: Create `frontend/index.html`**

This replaces `batalha.html`. Keep the `<video>` bg, the black-hole overlay, and the `#app` mount point. Remove the old `<script type="module" src="./app.js">`. Remove twind CDN (not used in Vue build).

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Arena Mugen</title>
</head>
<body>
  <video id="bg-video" autoplay muted loop playsinline preload="auto" style="position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;pointer-events:none">
    <source src="./assets/fundos/Aura Infinito do Buraco Negro_720p-ezremove.mp4" type="video/mp4" />
  </video>
  <script>
    const v = document.getElementById('bg-video');
    if (v) v.playbackRate = 1.5;
  </script>
  <div id="app"></div>
  <script type="module" src="./src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Install dependencies**

```bash
cd /home/leonardo/MugenArena/frontend && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Commit**

```bash
cd /home/leonardo/MugenArena
git add frontend/package.json frontend/vite.config.js frontend/index.html frontend/package-lock.json
git commit -m "feat: add Vite + Vue 3 scaffold"
```

---

## Task 2: main.js entry point

**Files:**
- Create: `frontend/src/main.js`

- [ ] **Step 1: Create `frontend/src/main.js`**

```js
import { createApp } from 'vue'
import App from './App.vue'
import '../batalha.css'

createApp(App).mount('#app')
```

- [ ] **Step 2: Verify Vite can parse it (no App.vue yet — error is expected)**

```bash
cd /home/leonardo/MugenArena/frontend && npm run build 2>&1 | head -20
```

Expected: error about missing `./App.vue` — that's fine, confirms Vite found main.js.

- [ ] **Step 3: Commit**

```bash
cd /home/leonardo/MugenArena
git add frontend/src/main.js
git commit -m "feat: add Vue app entry point"
```

---

## Task 3: useGame.js composable

**Files:**
- Create: `frontend/src/composables/useGame.js`

This is the central module. It holds all reactive state and game logic. Animation libs are initialized via `initLibs()` after BattleArena mounts.

- [ ] **Step 1: Create `frontend/src/composables/useGame.js`**

```js
import { reactive } from 'vue'
import { createAnimationController } from '../../battle-animations.js'
import { createClashSystem } from '../../clash-system.js'
import { createAudioController, AUDIO_DOMAIN_BREAK } from '../../audio-controller.js'
import { startBlackHoleAnimation } from '../../black-hole-animation.js'

const API_URL = '../backend/web_api.php'

const FUNDOS_ARENA = [
  'BEACH 2.png','BEACH NIGHT.png','BEACH.png','CAVE 2.png','CAVE NIGHT.png','CAVE.png',
  'DESERT NIGHT.png','DESERT.png','LAKE NIGHT.png','LAKE.png','MOUNTAIN 2.png',
  'MOUNTAIN NIGHT.png','MOUNTAIN.png','OCEAN NIGHT.png','OCEAN.png','PATH 2.png',
  'PATH NIGHT.png','PATH.png','SNOW NIGHT.png','SNOW.png','TALL GRASS NIGHT.png',
  'TALL GRASS.png','UNDERWATER.png'
]

export const state = reactive({
  serverState: null,
  resolvendoAcao: false,
  actionPage: 0,
  sprites: { p1: null, p2: null },
  frameScale: { p1: null, p2: null },
  pendingSprites: { p1: null, p2: null },
  pendingFrameScale: { p1: null, p2: null },
  domainImage: null,
  domainImageVersion: 0,
  arenaFundo: null,
  acaoPendente: null,
})

let animations = null
let clashSystem = null
let audio = null
let _atualizarHUDCallback = null

export function initLibs({ els, atualizarHUD }) {
  _atualizarHUDCallback = atualizarHUD
  animations = createAnimationController({ state, els, atualizarHUD })
  clashSystem = createClashSystem()
  audio = createAudioController({ els })
  audio.setVolume(1)
  audio.updateMuteButton()
}

export function getAnimations() { return animations }
export function getAudio() { return audio }

function oposto(chave) { return chave === 'p1' ? 'p2' : 'p1' }
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

async function chamarApi(action, payload = {}) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  if (!response.ok) {
    let msg = `Falha na API (${response.status}).`
    try { const b = await response.json(); if (b?.message) msg = b.message } catch (_) {}
    throw new Error(msg)
  }
  return response.json()
}

export async function carregarCatalogo() {
  const data = await chamarApi('catalog')
  return data.catalog ?? []
}

export function atualizarEstado(novoEstado, mostrarDano = false) {
  const anterior = state.serverState
  state.serverState = novoEstado
  if (!mostrarDano || !anterior?.started || !novoEstado?.started) return
  animations?.feedbackDano(anterior, novoEstado)
}

function limparPosePendente(chave = null) {
  if (chave) {
    state.pendingSprites[chave] = null
    state.pendingFrameScale[chave] = null
    return
  }
  state.pendingSprites.p1 = null
  state.pendingSprites.p2 = null
  state.pendingFrameScale.p1 = null
  state.pendingFrameScale.p2 = null
}

function aplicarPosePendenteDeDomain(chave, acao) {
  if (!acao?.activatesDomain || !acao?.domainClash) { limparPosePendente(chave); return }
  const frame = animations?.obterPrimeiroFrameDaAcao(chave, acao)
  if (!frame?.sprite) { limparPosePendente(chave); return }
  state.pendingSprites[chave] = frame.sprite
  state.pendingFrameScale[chave] = frame.scale ?? null
}

async function animarEsquivaEmTempoReal(mensagemEtapa, estadoAtual) {
  if (!mensagemEtapa?.includes('desviou!')) return false
  for (const key of ['p1', 'p2']) {
    const nome = estadoAtual?.[key]?.nome ?? ''
    if (nome && mensagemEtapa.includes(`${nome} desviou`)) {
      animations.animarEsquiva(key)
      await animations.wait(800)
      return true
    }
  }
  return false
}

async function tocarAnimacao(atacanteKey, acao, defensorKey, defensorEstaDefendendo) {
  const timeline = animations.montarAnimacao(atacanteKey, acao, defensorKey, defensorEstaDefendendo)
  const handle   = animations.rodarTimeline(timeline)
  state.anim     = handle
  await animations.wait(handle.duration)
  animations.cancelarAnimacao()
}

function deslocarEventos(events, delayMs) {
  if (delayMs <= 0) return events
  return events.map(e => ({ ...e, at: e.at + delayMs }))
}

function sincronizarLancamentoDeProjeteis(d1, d2) {
  const syncMs = Math.max(d1.projectileStartMs, d2.projectileStartMs)
  const sync = (d) => {
    const delay = Math.max(0, syncMs - d.projectileStartMs)
    return {
      ...d,
      preEvents: [...d.preLaunchEvents, ...deslocarEventos(d.launchEvents, delay)],
      projectileStartMs: syncMs,
    }
  }
  return [sync(d1), sync(d2)]
}

function sincronizarExpansaoDeDomains(d1, d2) {
  const syncMs = Math.max(d1.domainExpandMs, d2.domainExpandMs)
  return [{ ...d1, syncedExpandMs: syncMs }, { ...d2, syncedExpandMs: syncMs }]
}

async function executarTurnoClash(acoesMap, clashMeta) {
  const raw1 = animations.montarAnimacaoClash('p1', acoesMap['p1'], 'p2')
  const raw2 = animations.montarAnimacaoClash('p2', acoesMap['p2'], 'p1')
  const src1 = raw1.getPrimaryBeamSourcePoint?.()
  const src2 = raw2.getPrimaryBeamSourcePoint?.()
  if (src1 && src2) { raw1.setBeamAimOverride?.(src2); raw2.setBeamAimOverride?.(src1) }

  const [d1, d2] = sincronizarLancamentoDeProjeteis(raw1, raw2)
  const allPre = [...d1.preEvents, ...d2.preEvents]
  const handle = animations.rodarTimeline(allPre)
  state.anim = handle

  const bothLaunchedMs = Math.max(d1.projectileStartMs, d2.projectileStartMs) + 80
  await animations.wait(bothLaunchedMs)

  const ref1 = d1.getProjectileRef()
  const ref2 = d2.getProjectileRef()
  const refs1 = d1.getProjectileRefs?.() ?? (ref1 ? [ref1] : [])
  const refs2 = d2.getProjectileRefs?.() ?? (ref2 ? [ref2] : [])

  if (ref1 && ref2) {
    await clashSystem.runClash(ref1, ref2, clashMeta, d1.postEvents, d2.postEvents, animations, refs1, refs2)
  } else {
    await animations.wait(clashMeta.durationMs)
    const winnerPost = clashMeta.winner === 'p1' ? d1.postEvents : d2.postEvents
    if (winnerPost.length > 0) {
      const h = animations.rodarTimeline(winnerPost)
      await animations.wait(h.duration)
    }
  }
  animations.cancelarAnimacao()
}

async function prepararDomainClash(acoesMap) {
  animations.mostrarAnelClashDeDomain()
  const raw1 = animations.montarAnimacaoDomainClash('p1', acoesMap['p1'], 'p2')
  const raw2 = animations.montarAnimacaoDomainClash('p2', acoesMap['p2'], 'p1')
  const [d1, d2] = sincronizarExpansaoDeDomains(raw1, raw2)
  const preEvents = [...d1.preExpandEvents, ...d2.preExpandEvents]
  state.anim = animations.rodarTimeline(preEvents)
  await animations.wait(Math.max(d1.syncedExpandMs, d2.syncedExpandMs))
  const cleanupSplit = animations.mostrarPainelClashDeDomain(d1.domainImage, d2.domainImage, 7000)
  audio.playClashDomain()
  return { d1, d2, cleanupSplit }
}

async function executarTurnoDomainClash(acoesMap, clashMeta) {
  const { d1, d2, cleanupSplit } = await prepararDomainClash(acoesMap)

  if (clashMeta?.bothFailed) {
    await animations.wait(6000)
    await audio.fadeOutClashDomain(1000)
    cleanupSplit()
    state.sprites.p1 = null; state.sprites.p2 = null
    state.frameScale.p1 = null; state.frameScale.p2 = null
    limparPosePendente()
    _atualizarHUDCallback?.()
    animations.textoFlutuante('p1', 'domain break')
    animations.textoFlutuante('p2', 'domain break')

    const breakAudio = new Audio(AUDIO_DOMAIN_BREAK)
    breakAudio.volume = audio.getVolume()
    breakAudio.muted = false
    breakAudio.play().catch(() => {})
    try {
      await animations.mostrarFundoDomainBreak(clashMeta.effectGif || './assets/efeitos/domainbreak.gif', 2200)
      await animations.wait(200)
      await audio.fadeAudioOut(breakAudio, 1000)
    } finally {
      breakAudio.pause(); breakAudio.currentTime = 0
    }
    animations.cancelarAnimacao()
    return { bothFailed: true }
  }

  const winnerKey = clashMeta.winner
  const loserKey  = oposto(winnerKey)
  const winnerD   = winnerKey === 'p1' ? d1 : d2
  const fadeOutMs = 1400; const fadeInMs = 1400
  await animations.wait(7000 - fadeOutMs)

  const blackoutPromise = animations.mostrarTransicaoPosClashDeDomain(fadeOutMs, fadeInMs)
  await animations.wait(Math.max(0, fadeOutMs - 1000))
  const fadeAudioPromise = audio.fadeOutClashDomain(1000)
  await animations.wait(1000)
  await fadeAudioPromise
  cleanupSplit()
  state.sprites[loserKey] = null; state.frameScale[loserKey] = null
  limparPosePendente(loserKey)
  state.domainImageVersion += 1
  state.domainImage = winnerD.domainImage ?? null
  _atualizarHUDCallback?.()

  const winnerPostHandle = winnerD.winnerDeferredEvents.length > 0
    ? animations.rodarTimeline(winnerD.winnerDeferredEvents)
    : { duration: 0, cancel() {} }
  await blackoutPromise

  const restanteMs = Math.max(0, Math.max(clashMeta.durationMs ?? 0, winnerPostHandle.duration) - fadeOutMs)
  await animations.wait(restanteMs)
  animations.cancelarAnimacao()
  return { bothFailed: false }
}

export async function processarAcao(acao, { adicionarLog, esconderPreview, habilitarBotoes, montarAcoes }) {
  if (state.resolvendoAcao || !state.serverState?.started || state.serverState.winner) return

  esconderPreview()
  state.resolvendoAcao = true
  habilitarBotoes(false)

  const atacanteKey = state.serverState.currentKey
  const errorSplash = state.serverState[atacanteKey]?.visual?.errorSplash ?? null
  animations.cancelarAnimacao()

  try {
    const resposta = await chamarApi('action', {
      playerKey:  atacanteKey,
      actionType: acao.type,
      skillIndex: typeof acao.skillIndex === 'number' ? acao.skillIndex : null,
    })

    const mensagem = resposta.message || null

    if (resposta.state?.started === false) {
      limparPosePendente()
      if (errorSplash) await animations.mostrarSplashErroInsano(errorSplash, 3000)
      // signal reset
      if (mensagem) adicionarLog(mensagem)
      return { reset: true }
    }

    if (!resposta.resolved) {
      state.acaoPendente = { playerKey: atacanteKey, acao }
      aplicarPosePendenteDeDomain(atacanteKey, acao)
      if (resposta.state) atualizarEstado(resposta.state, false)
      _atualizarHUDCallback?.()
      const proximo = resposta.state?.currentKey
      const nomeProximo = proximo ? (proximo === 'p1' ? 'Jogador 1' : 'Jogador 2') : 'outro jogador'
      adicionarLog(`Aguardando ${nomeProximo} escolher...`)
      return {}
    }

    const ordem = resposta.resolucaoOrdem ?? [atacanteKey, oposto(atacanteKey)]
    const mensagensResolucao = Array.isArray(resposta.mensagensResolucao) ? resposta.mensagensResolucao : []
    const domainCancel = resposta.domainCancel?.cancelled ? resposta.domainCancel : null
    const acoesMap = { [atacanteKey]: acao }
    aplicarPosePendenteDeDomain(atacanteKey, acao)
    if (state.acaoPendente) acoesMap[state.acaoPendente.playerKey] = state.acaoPendente.acao
    state.acaoPendente = null
    _atualizarHUDCallback?.()

    const estadoIntermediario = resposta.estadoIntermediario ?? null
    const estadoFinal         = resposta.state ?? null

    if (resposta.clash?.occurred) {
      if (resposta.clash.kind === 'domain') {
        await executarTurnoDomainClash(acoesMap, resposta.clash)
      } else {
        await executarTurnoClash(acoesMap, resposta.clash)
      }
      limparPosePendente()
      atualizarEstado(estadoFinal, true)
      _atualizarHUDCallback?.()
      if (mensagem) adicionarLog(mensagem)
      if (resposta.state?.winner) await animations.animarMorte(oposto(resposta.state.winner))
      _atualizarHUDCallback?.()
      return {}
    }

    const ordemAnimada = ordem.filter(k => acoesMap[k] && acoesMap[k].type !== 'skip')

    for (let i = 0; i < ordemAnimada.length; i++) {
      const keyA   = ordemAnimada[i]
      const acaoA  = acoesMap[keyA]
      const keyD   = oposto(keyA)
      const defend = acoesMap[keyD]?.type === 'defend'
      const msgEtapa = mensagensResolucao[i] ?? null

      limparPosePendente(keyA)
      await tocarAnimacao(keyA, acaoA, keyD, defend)

      const isUltimo = i === ordemAnimada.length - 1
      const estadoAplicar = (!isUltimo && estadoIntermediario) ? estadoIntermediario : estadoFinal
      if (estadoAplicar) {
        atualizarEstado(estadoAplicar, true)
        _atualizarHUDCallback?.()
        await animarEsquivaEmTempoReal(msgEtapa, estadoAplicar)
        if (estadoAplicar.winner) break
      }
      if (!isUltimo) await wait(500)
    }

    if (ordemAnimada.length === 0 && estadoFinal) {
      limparPosePendente()
      atualizarEstado(estadoFinal, true)
      await animarEsquivaEmTempoReal(mensagensResolucao[0] ?? null, estadoFinal)
    }

    limparPosePendente()

    if (domainCancel?.playerKey) {
      animations.textoFlutuante(domainCancel.playerKey, String(domainCancel.text || 'domain failed'))
    }
    if (mensagem) adicionarLog(mensagem)
    if (resposta.state?.winner) await animations.animarMorte(oposto(resposta.state.winner))
    _atualizarHUDCallback?.()
  } catch (erro) {
    state.acaoPendente = null
    limparPosePendente()
    audio.stopClashDomain()
    animations.cancelarAnimacao()
    _atualizarHUDCallback?.()
    adicionarLog(`Erro ao executar ação: ${erro.message || 'falha desconhecida.'}`)
  } finally {
    state.actionPage = 0
    montarAcoes()
    state.resolvendoAcao = false
    habilitarBotoes(true)
  }
  return {}
}

export async function iniciarPartida({ p1Name, p2Name, p1Class, p2Class, onBattleSetup }) {
  const resposta = await chamarApi('start', {
    p1Name: p1Name || 'Jogador 1',
    p1Class,
    p2Name: p2Name || 'Jogador 2',
    p2Class,
  })
  if (!resposta.ok) throw new Error(resposta.message || 'Não foi possível iniciar a partida.')

  atualizarEstado(resposta.state, false)
  state.resolvendoAcao = false
  state.actionPage = 0
  limparPosePendente()
  animations.cancelarAnimacao()
  audio.playRandomBgm()

  await startBlackHoleAnimation({ onBattleSetup })

  return resposta
}

export function resetarEstado() {
  audio?.stopClashDomain()
  audio?.stopBgm()
  limparPosePendente()
  animations?.cancelarAnimacao()
  state.serverState = null
  state.resolvendoAcao = false
  state.actionPage = 0
  state.arenaFundo = null
  state.domainImage = null
  state.domainImageVersion = 0
  state.acaoPendente = null
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/leonardo/MugenArena
git add frontend/src/composables/useGame.js
git commit -m "feat: add useGame composable with all game state and API logic"
```

---

## Task 4: App.vue

**Files:**
- Create: `frontend/src/App.vue`

App.vue manages the `.battle-app` container, topbar, tutorial modal, black-hole overlay, and routes between intro/setup/battle phases.

- [ ] **Step 1: Create `frontend/src/App.vue`**

```vue
<template>
  <main class="battle-app" :class="appClass">
    <header class="topbar">
      <p id="turn-info">{{ turnInfo }}</p>
      <div class="topbar-audio">
        <button
          id="bgm-toggle-btn"
          type="button"
          class="bgm-toggle-btn"
          :aria-pressed="String(!audioMuted)"
          @click="onToggleMute"
        >{{ audioMuted ? 'MUSICA: OFF' : 'MUSICA: ON' }}</button>
        <label class="bgm-volume-wrap" for="bgm-volume-input">
          VOL
          <input
            id="bgm-volume-input"
            class="bgm-volume-input"
            type="number"
            min="1" max="10" step="1"
            :value="volume"
            @input="onVolume"
            @change="onVolume"
          />
        </label>
      </div>
      <button
        id="tutorial-open-btn"
        type="button"
        class="tutorial-toggle-btn"
        @click="abrirTutorial"
      >Tutorial</button>
    </header>

    <div id="tutorial-modal" class="tutorial-modal" :class="{ 'is-hidden': !tutorialOpen }" :aria-hidden="String(!tutorialOpen)">
      <div id="tutorial-overlay" class="tutorial-modal__overlay" @click="fecharTutorial"></div>
      <section class="tutorial-modal__panel" role="dialog" aria-modal="true" aria-label="Tutorial Arena Mugen">
        <div id="tutorial-content-host" class="tutorial-modal__host" v-html="tutorialHtml"></div>
      </section>
    </div>

    <div id="black-hole-overlay" class="black-hole-overlay" style="display:none">
      <canvas id="black-hole-canvas"></canvas>
    </div>

    <IntroScreen
      v-if="phase === 'intro'"
      @start="abrirSetup"
      @tutorial="abrirTutorial"
    />

    <GameSetup
      v-else-if="phase === 'setup'"
      :catalog="catalog"
      @start-game="onStartGame"
    />

    <BattleArena
      v-else-if="phase === 'battle'"
      :server-state="state.serverState"
      :action-page="state.actionPage"
      :resolving="state.resolvendoAcao"
      :arena-fundo="state.arenaFundo"
      :domain-image="state.domainImage"
      :domain-image-version="state.domainImageVersion"
      @reset="onReset"
      @log="onLog"
    />
  </main>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { state, carregarCatalogo, resetarEstado } from './composables/useGame.js'
import IntroScreen from './components/IntroScreen.vue'
import GameSetup from './components/GameSetup.vue'
import BattleArena from './components/BattleArena.vue'

const phase = ref('intro')
const appClass = ref('is-intro')
const catalog = ref([])
const tutorialOpen = ref(false)
const tutorialHtml = ref('')
const tutorialLoaded = ref(false)
const tutorialLoadingPromise = ref(null)
const audioMuted = ref(false)
const volume = ref(3)

const turnInfo = computed(() => {
  const s = state.serverState
  if (!s?.started) return 'Prepare a partida'
  if (s.winner) return `${s.winner === 'p1' ? 'Jogador 1' : 'Jogador 2'} venceu!`
  if (s.currentKey) {
    const label = s.currentKey === 'p1' ? 'Jogador 1' : 'Jogador 2'
    const nome  = s[s.currentKey]?.nome ?? ''
    const p1s   = s.p1Submeteu ? '✓' : '?'
    const p2s   = s.p2Submeteu ? '✓' : '?'
    return `Turno ${s.turno} • P1[${p1s}] P2[${p2s}] — ${label} (${nome}) escolhe`
  }
  return `Turno ${s.turno} • Resolvendo...`
})

function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

async function abrirSetup() {
  const setupEl = document.querySelector('.setup-screen')
  if (setupEl) { setupEl.classList.remove('is-hidden'); setupEl.classList.add('is-transition-ready') }
  requestAnimationFrame(() => {
    appClass.value = 'is-entering-setup'
    const introEl = document.querySelector('.intro-screen')
    if (introEl) introEl.classList.add('is-leaving')
  })
  await wait(820)
  phase.value = 'setup'
  appClass.value = ''
}

async function carregarTutorial() {
  if (tutorialLoaded.value) return
  if (tutorialLoadingPromise.value) { await tutorialLoadingPromise.value; return }
  tutorialHtml.value = '<div class="tutorial-modal__loading">CARREGANDO TUTORIAL...</div>'
  tutorialLoadingPromise.value = fetch('./tutorial-content.html')
    .then(async r => {
      if (!r.ok) throw new Error(`Falha ao carregar tutorial (${r.status}).`)
      tutorialHtml.value = await r.text()
      tutorialLoaded.value = true
    })
    .catch(() => { tutorialHtml.value = '<div class="tutorial-modal__loading">Nao foi possivel carregar o tutorial.</div>' })
    .finally(() => { tutorialLoadingPromise.value = null })
  await tutorialLoadingPromise.value
}

async function abrirTutorial() {
  try { await carregarTutorial() } catch (_) {}
  tutorialOpen.value = true
}

function fecharTutorial() { tutorialOpen.value = false }

function onToggleMute() {
  const a = document.getElementById('bgm-toggle-btn')
  audioMuted.value = !audioMuted.value
  // audio controller is initialized in BattleArena; use its toggle when available
  const audioLib = window.__mugenAudio
  if (audioLib) audioLib.toggleMute()
}

function onVolume(e) {
  volume.value = e.target.value
  const audioLib = window.__mugenAudio
  if (audioLib) audioLib.setVolume(e.target.value)
}

async function onStartGame({ p1Name, p2Name, p1Class, p2Class }) {
  phase.value = 'battle'
  appClass.value = 'is-playing'
  state.arenaFundo = `./assets/fundosdojogo/${encodeURIComponent(
    ['BEACH 2.png','BEACH NIGHT.png','BEACH.png','CAVE 2.png','CAVE NIGHT.png','CAVE.png',
     'DESERT NIGHT.png','DESERT.png','LAKE NIGHT.png','LAKE.png','MOUNTAIN 2.png',
     'MOUNTAIN NIGHT.png','MOUNTAIN.png','OCEAN NIGHT.png','OCEAN.png','PATH 2.png',
     'PATH NIGHT.png','PATH.png','SNOW NIGHT.png','SNOW.png','TALL GRASS NIGHT.png',
     'TALL GRASS.png','UNDERWATER.png'][Math.floor(Math.random() * 23)]
  )}`
  // BattleArena handles the actual start via its own ref
  window.__mugenStartArgs = { p1Name, p2Name, p1Class, p2Class }
}

function onReset() {
  resetarEstado()
  phase.value = 'setup'
  appClass.value = ''
}

function onLog(msg) {
  // BattleArena manages its own log; this is a passthrough for errors before battle
  console.warn('[App log]', msg)
}

onMounted(async () => {
  try { catalog.value = await carregarCatalogo() } catch (_) {}

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tutorialOpen.value) fecharTutorial()
  })

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#tutorial-content-host')) return
    if (e.target.closest('[data-tutorial-close]')) { fecharTutorial(); return }
    const btn = e.target.closest('.tutorial-modal__topic-btn')
    if (!btn) return
    const id = btn.dataset.topicId
    document.querySelectorAll('.tutorial-modal__topic-btn').forEach(b =>
      b.classList.toggle('is-active', b.dataset.topicId === id))
    document.querySelectorAll('.tutorial-modal__topic-panel').forEach(p =>
      p.classList.toggle('is-active', p.dataset.topicPanel === id))
  })
})
</script>
```

- [ ] **Step 2: Commit**

```bash
cd /home/leonardo/MugenArena
git add frontend/src/App.vue
git commit -m "feat: add App.vue with phase routing and topbar"
```

---

## Task 5: IntroScreen.vue

**Files:**
- Create: `frontend/src/components/IntroScreen.vue`

- [ ] **Step 1: Create `frontend/src/components/IntroScreen.vue`**

```vue
<template>
  <section class="intro-screen" id="intro-screen" aria-label="Menu inicial">
    <div class="intro-shell">
      <div class="intro-hero">
        <h2 class="intro-title">ARENA<br />MUGEN</h2>
        <p class="intro-copy">
          Entre em uma arena de duelos exagerados, escolha os lutadores e prepare confrontos com domains, beams, projeteis e impacto visual forte.
        </p>
        <div class="intro-actions">
          <button id="intro-start-btn" class="intro-start-btn" type="button" @click="$emit('start')">INICIAR JOGO</button>
          <button id="intro-tutorial-btn" class="intro-secondary-btn" type="button" @click="$emit('tutorial')">VER TUTORIAL</button>
        </div>
      </div>

      <div class="intro-showcase" aria-hidden="true">
        <article class="intro-panel intro-panel--spotlight">
          <img class="intro-panel__image" src="../../../assets/fundos/market1.jpg" alt="Confronto de dominios" />
          <div class="intro-panel__content">
            <strong class="intro-panel__title">Confronto de Egos.</strong>
            <p class="intro-panel__text">Que sobreviva a mais forte</p>
          </div>
        </article>

        <div class="intro-panel-grid">
          <article class="intro-panel intro-panel--spotlight intro-panel--characters">
            <img class="intro-panel__image" src="../../../assets/fundos/market3.jpg" alt="Todos os personagens" />
            <div class="intro-panel__content intro-panel__content--top">
              <strong class="intro-panel__title">Todos os personagens</strong>
            </div>
          </article>

          <article class="intro-panel intro-panel--image-only" aria-label="Painel ilustrativo">
            <img class="intro-panel__image intro-panel__image--plain" src="../../../assets/fundos/market2.jpg" alt="Arena ilustrativa" />
            <div class="intro-panel__content intro-panel__content--top intro-panel__content--light">
              <strong class="intro-panel__title">MIKU Update! 1.2</strong>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
defineEmits(['start', 'tutorial'])
</script>
```

**Note on image paths:** Vite resolves relative `src` attributes in Vue SFC templates. Since `vite.config.js` has `root: '.'` (i.e. `frontend/`), the path `../../../assets/fundos/market1.jpg` resolves from `frontend/src/components/` up to `frontend/assets/fundos/market1.jpg`. Alternatively use `/assets/fundos/market1.jpg` (absolute from root). Use absolute paths for reliability:

Replace all three `src` values with:
- `src="/assets/fundos/market1.jpg"`
- `src="/assets/fundos/market3.jpg"`
- `src="/assets/fundos/market2.jpg"`

- [ ] **Step 2: Commit**

```bash
cd /home/leonardo/MugenArena
git add frontend/src/components/IntroScreen.vue
git commit -m "feat: add IntroScreen Vue component"
```

---

## Task 6: GameSetup.vue

**Files:**
- Create: `frontend/src/components/GameSetup.vue`

The root element MUST have class `setup-screen` — `black-hole-animation.js` uses `document.querySelector('.setup-screen')` for the suck-in animation.

- [ ] **Step 1: Create `frontend/src/components/GameSetup.vue`**

```vue
<template>
  <section class="setup-screen" id="setup-panel" aria-label="Seleção de personagens">
    <div class="setup-stage">
      <p class="setup-subtitle">Escolha os lutadores e inicie o duelo</p>

      <div class="setup-arena">
        <div class="setup-player setup-player--p1">
          <span class="setup-player-label">JOGADOR 1</span>
          <input v-model="p1Name" type="text" id="p1-name" maxlength="20" />
          <div class="char-picker" data-for="p1-class">
            <button
              v-for="char in catalog"
              :key="char.key"
              type="button"
              class="char-option"
              :class="{ 'is-selected': p1Class === char.key }"
              @click="selectChar('p1', char)"
            >
              <img :src="char.selectSprite" :alt="char.label" />
              <span>{{ char.label }}</span>
            </button>
          </div>
        </div>

        <div class="char-preview char-preview--p1">
          <img class="preview-sprite" id="p1-preview-sprite" :src="p1Preview.sprite" :alt="p1Preview.label" />
          <span class="preview-name" id="p1-preview-name">{{ p1Preview.label }}</span>
        </div>

        <div class="setup-vs">
          <span class="setup-vs-line"></span>
          <span class="setup-vs-badge">VS</span>
          <span class="setup-vs-line"></span>
        </div>

        <div class="char-preview char-preview--p2">
          <img class="preview-sprite" id="p2-preview-sprite" :src="p2Preview.sprite" :alt="p2Preview.label" />
          <span class="preview-name" id="p2-preview-name">{{ p2Preview.label }}</span>
        </div>

        <div class="setup-player setup-player--p2">
          <span class="setup-player-label">JOGADOR 2</span>
          <input v-model="p2Name" type="text" id="p2-name" maxlength="20" />
          <div class="char-picker" data-for="p2-class">
            <button
              v-for="char in catalog"
              :key="char.key"
              type="button"
              class="char-option"
              :class="{ 'is-selected': p2Class === char.key }"
              @click="selectChar('p2', char)"
            >
              <img :src="char.selectSprite" :alt="char.label" />
              <span>{{ char.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <button id="start-btn" class="start-btn" :disabled="starting" @click="onStart">INICIAR BATALHA</button>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  catalog: { type: Array, default: () => [] },
})
const emit = defineEmits(['start-game'])

const p1Name  = ref('Jogador 1')
const p2Name  = ref('Jogador 2')
const p1Class = ref('')
const p2Class = ref('')
const starting = ref(false)

const p1Preview = ref({ sprite: '', label: '' })
const p2Preview = ref({ sprite: '', label: '' })

watch(() => props.catalog, (cats) => {
  if (!cats.length) return
  if (!p1Class.value) { p1Class.value = cats[0].key; p1Preview.value = { sprite: cats[0].selectSprite, label: cats[0].label } }
  if (!p2Class.value && cats.length > 1) { p2Class.value = cats[1].key; p2Preview.value = { sprite: cats[1].selectSprite, label: cats[1].label } }
  else if (!p2Class.value) { p2Class.value = cats[0].key; p2Preview.value = { sprite: cats[0].selectSprite, label: cats[0].label } }
}, { immediate: true })

function selectChar(side, char) {
  if (side === 'p1') { p1Class.value = char.key; p1Preview.value = { sprite: char.selectSprite, label: char.label } }
  else               { p2Class.value = char.key; p2Preview.value = { sprite: char.selectSprite, label: char.label } }
}

async function onStart() {
  if (starting.value) return
  starting.value = true
  try {
    emit('start-game', {
      p1Name: p1Name.value.trim(),
      p2Name: p2Name.value.trim(),
      p1Class: p1Class.value,
      p2Class: p2Class.value,
    })
  } finally {
    starting.value = false
  }
}
</script>
```

- [ ] **Step 2: Commit**

```bash
cd /home/leonardo/MugenArena
git add frontend/src/components/GameSetup.vue
git commit -m "feat: add GameSetup Vue component"
```

---

## Task 7: CharacterCard.vue

**Files:**
- Create: `frontend/src/components/CharacterCard.vue`

Renders one HP/energy card. Replaces `atualizarCard()` from ui-status.js with reactive props.

- [ ] **Step 1: Create `frontend/src/components/CharacterCard.vue`**

```vue
<template>
  <article class="card" :class="side === 'enemy' ? 'card-enemy' : 'card-player'" :id="side === 'enemy' ? 'card-enemy' : 'card-player'">
    <div class="card-head">
      <h2 :id="side === 'enemy' ? 'enemy-name' : 'player-name'">{{ classeNome }}</h2>
      <span :id="side === 'enemy' ? 'enemy-tag' : 'player-tag'">{{ nome }}</span>
    </div>

    <div class="meter">
      <label>HP</label>
      <div class="track">
        <div
          class="value hp"
          :id="side === 'enemy' ? 'enemy-hp-bar' : 'player-hp-bar'"
          :class="{ danger: hpDanger }"
          :style="{ width: hpPercent }"
        ></div>
      </div>
      <strong :id="side === 'enemy' ? 'enemy-hp-text' : 'player-hp-text'">{{ hpAtual }} / {{ hpMaximo }}</strong>
    </div>

    <div class="meter">
      <label>ENERGIA</label>
      <div class="track">
        <div
          class="value energy"
          :id="side === 'enemy' ? 'enemy-energy-bar' : 'player-energy-bar'"
          :style="{ width: energyPercent }"
        ></div>
      </div>
      <strong :id="side === 'enemy' ? 'enemy-energy-text' : 'player-energy-text'">{{ energiaAtual }} / {{ energiaMaxima }}</strong>
    </div>

    <div class="status-icons" :id="side === 'enemy' ? 'enemy-status-icons' : 'player-status-icons'">
      <img v-if="bleedTurnos > 0" src="/assets/efeitos/sangrar.png" alt="Sangramento" :title="`Sangramento: ${bleedTurnos} turno(s)`" />
      <img v-if="burnTurnos > 0"  src="/assets/efeitos/queimar.png"  alt="Queimadura"  :title="`Queimadura: ${burnTurnos} turno(s)`" />
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  side:          { type: String, required: true },  // 'enemy' | 'player'
  classeNome:    { type: String, default: '-' },
  nome:          { type: String, default: '' },
  hpAtual:       { type: Number, default: 0 },
  hpMaximo:      { type: Number, default: 1 },
  energiaAtual:  { type: Number, default: 0 },
  energiaMaxima: { type: Number, default: 1 },
  bleedTurnos:   { type: Number, default: 0 },
  burnTurnos:    { type: Number, default: 0 },
})

function pct(cur, max) {
  if (max <= 0) return '0%'
  return `${Math.max(0, Math.min(100, (cur / max) * 100))}%`
}

const hpPercent     = computed(() => pct(props.hpAtual, props.hpMaximo))
const energyPercent = computed(() => pct(props.energiaAtual, props.energiaMaxima))
const hpDanger      = computed(() => props.hpMaximo > 0 && props.hpAtual / props.hpMaximo <= 0.3)
</script>
```

- [ ] **Step 2: Commit**

```bash
cd /home/leonardo/MugenArena
git add frontend/src/components/CharacterCard.vue
git commit -m "feat: add CharacterCard Vue component"
```

---

## Task 8: ActionPanel.vue

**Files:**
- Create: `frontend/src/components/ActionPanel.vue`

Replicates `montarAcoes()` and `habilitarBotoes()` from ui-status.js.

- [ ] **Step 1: Create `frontend/src/components/ActionPanel.vue`**

```vue
<template>
  <aside class="controls" aria-label="Ações disponíveis">
    <h3>AÇÕES</h3>
    <div class="grid-actions" id="action-menu">
      <template v-for="(slot, idx) in slots" :key="idx">
        <!-- Pagination arrow in slot 2 (index 2) -->
        <button
          v-if="idx === 2"
          class="pagination-btn"
          :disabled="resolving || totalPaginas <= 1"
          @click="nextPage"
        >→</button>

        <!-- Action button -->
        <button
          v-else-if="slot"
          :disabled="resolving || !slot.type"
          :class="{ 'is-disabled-by-energy': slot.semEnergia }"
          :tabindex="(slot.semEnergia || resolving) ? -1 : 0"
          @mouseenter="slot.type && $emit('preview', slot)"
          @mouseleave="$emit('hide-preview')"
          @focus="slot.type && $emit('preview', slot)"
          @blur="$emit('hide-preview')"
          @click="onAction(slot)"
        >{{ slot.nome }}</button>

        <!-- Empty slot placeholder -->
        <button v-else disabled>-</button>
      </template>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'

const ACOES_POR_PAGINA = 3

const props = defineProps({
  availableActions: { type: Array, default: () => [] },
  energiaAtual:     { type: Number, default: 0 },
  page:             { type: Number, default: 0 },
  resolving:        { type: Boolean, default: false },
})

const emit = defineEmits(['action', 'page-change', 'preview', 'hide-preview'])

const acoes = computed(() =>
  props.availableActions.map(a => ({
    ...a,
    nome: a.label,
    nomeSprite: a.skillName || a.label,
    semEnergia: Boolean(a.disabled) || (Number(a.energyCost) || 0) > props.energiaAtual,
  }))
)

const totalPaginas = computed(() => Math.max(1, Math.ceil(acoes.value.length / ACOES_POR_PAGINA)))

const slots = computed(() => {
  const page = props.page % totalPaginas.value
  const start = page * ACOES_POR_PAGINA
  const pagina = acoes.value.slice(start, start + ACOES_POR_PAGINA)
  while (pagina.length < ACOES_POR_PAGINA) pagina.push(null)
  // layout: slot0, slot1, ARROW(idx2), slot2
  return [pagina[0], pagina[1], null, pagina[2]]
})

function nextPage() {
  if (props.resolving) return
  emit('page-change', (props.page + 1) % totalPaginas.value)
}

function onAction(slot) {
  if (!slot?.type || slot.semEnergia || props.resolving) return
  emit('action', slot)
}
</script>
```

- [ ] **Step 2: Commit**

```bash
cd /home/leonardo/MugenArena
git add frontend/src/components/ActionPanel.vue
git commit -m "feat: add ActionPanel Vue component"
```

---

## Task 9: VictoryScreen.vue

**Files:**
- Create: `frontend/src/components/VictoryScreen.vue`

- [ ] **Step 1: Create `frontend/src/components/VictoryScreen.vue`**

```vue
<template>
  <div class="winner-overlay" id="winner-overlay" :class="{ 'is-hidden': !winner }" aria-live="polite">
    <div class="winner-card">
      <img
        v-if="winSprite"
        id="winner-sprite"
        class="winner-sprite"
        :src="winSprite"
        alt="Vencedor"
      />
      <p id="winner-text" class="winner-text">{{ winText }}</p>
      <button id="play-again-btn" class="play-again-btn" @click="$emit('reset')">JOGAR NOVAMENTE</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  serverState: { type: Object, default: null },
})
defineEmits(['reset'])

const winner = computed(() => props.serverState?.winner ?? null)

const vencedor = computed(() => {
  if (!winner.value || !props.serverState) return null
  return props.serverState[winner.value]
})

const winSprite = computed(() => vencedor.value?.visual?.winImage || vencedor.value?.visual?.baseSprite || '')

const winText = computed(() => {
  if (!winner.value) return ''
  const label = winner.value === 'p1' ? 'Jogador 1' : 'Jogador 2'
  return vencedor.value?.visual?.winMessage ?? `${label} (${vencedor.value?.nome ?? ''}) venceu!`
})
</script>
```

- [ ] **Step 2: Commit**

```bash
cd /home/leonardo/MugenArena
git add frontend/src/components/VictoryScreen.vue
git commit -m "feat: add VictoryScreen Vue component"
```

---

## Task 10: BattleArena.vue

**Files:**
- Create: `frontend/src/components/BattleArena.vue`

This is the most complex component. It owns all DOM refs, initializes animation/clash/audio libs, runs `iniciarPartida`, and orchestrates turn animations. It also owns the battle log (replacing `adicionarLog`/`montarAcoes` callbacks used in `processarAcao`).

- [ ] **Step 1: Create `frontend/src/components/BattleArena.vue`**

```vue
<template>
  <section class="battle-view" id="battle-view">
    <div
      class="arena"
      ref="arenaEl"
      :style="arenaStyle"
      aria-label="Campo de batalha"
    >
      <div class="arena-glow"></div>

      <CharacterCard
        side="enemy"
        :classe-nome="p2?.classeNome?.toUpperCase() ?? '-'"
        :nome="p2?.nome ?? 'Jogador 2'"
        :hp-atual="p2?.vidaAtual ?? 0"
        :hp-maximo="p2?.vidaMaxima ?? 1"
        :energia-atual="p2?.energiaAtual ?? 0"
        :energia-maxima="p2?.energiaMaxima ?? 1"
        :bleed-turnos="p2?.bleedTurnos ?? 0"
        :burn-turnos="p2?.burnTurnos ?? 0"
      />

      <CharacterCard
        side="player"
        :classe-nome="p1?.classeNome?.toUpperCase() ?? '-'"
        :nome="p1?.nome ?? 'Jogador 1'"
        :hp-atual="p1?.vidaAtual ?? 0"
        :hp-maximo="p1?.vidaMaxima ?? 1"
        :energia-atual="p1?.energiaAtual ?? 0"
        :energia-maxima="p1?.energiaMaxima ?? 1"
        :bleed-turnos="p1?.bleedTurnos ?? 0"
        :burn-turnos="p1?.burnTurnos ?? 0"
      />

      <div class="fighter-shadow enemy" aria-hidden="true"></div>
      <div class="fighter enemy" id="fighter-enemy" ref="fighterEnemyEl" data-side="player2" aria-hidden="true">
        <img class="fighter-img" alt="Personagem do jogador 2" />
        <span>G</span>
      </div>

      <div class="fighter-shadow player" aria-hidden="true"></div>
      <div class="fighter player" id="fighter-player" ref="fighterPlayerEl" data-side="player1" aria-hidden="true">
        <img class="fighter-img" alt="Personagem do jogador 1" />
        <span>S</span>
      </div>

      <VictoryScreen :server-state="serverState" @reset="$emit('reset')" />
    </div>

    <section class="hud">
      <div class="feed" id="combat-feed" :class="{ 'previewing-skill': previewing }">
        <h3>LOG DE COMBATE</h3>
        <ul id="battle-log" ref="logEl">
          <li v-for="(entry, i) in logEntries" :key="i">{{ entry }}</li>
        </ul>
        <div class="skill-preview" id="skill-preview" aria-live="polite">
          <h4 id="skill-preview-title">{{ previewTitle }}</h4>
          <p id="skill-preview-text">{{ previewText }}</p>
        </div>
      </div>

      <ActionPanel
        :available-actions="availableActions"
        :energia-atual="currentPlayerEnergy"
        :page="actionPage"
        :resolving="resolving"
        @action="onActionSelected"
        @page-change="onPageChange"
        @preview="onPreview"
        @hide-preview="onHidePreview"
      />
    </section>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { state, initLibs, processarAcao, iniciarPartida, atualizarEstado, resetarEstado } from '../composables/useGame.js'
import CharacterCard from './CharacterCard.vue'
import ActionPanel from './ActionPanel.vue'
import VictoryScreen from './VictoryScreen.vue'

const props = defineProps({
  serverState:         { type: Object, default: null },
  actionPage:          { type: Number, default: 0 },
  resolving:           { type: Boolean, default: false },
  arenaFundo:          { type: String, default: null },
  domainImage:         { type: String, default: null },
  domainImageVersion:  { type: Number, default: 0 },
})
const emit = defineEmits(['reset', 'log'])

// DOM refs
const arenaEl        = ref(null)
const fighterPlayerEl = ref(null)
const fighterEnemyEl  = ref(null)
const logEl           = ref(null)

// Local state
const logEntries  = ref([])
const previewing  = ref(false)
const previewTitle = ref('Habilidade')
const previewText  = ref('Passe o mouse em uma habilidade para ver a descrição.')

const p1 = computed(() => props.serverState?.p1 ?? null)
const p2 = computed(() => props.serverState?.p2 ?? null)

const availableActions = computed(() =>
  Array.isArray(props.serverState?.availableActions) ? props.serverState.availableActions : []
)

const currentPlayerEnergy = computed(() => {
  const key = props.serverState?.currentKey ?? 'p1'
  return Number(props.serverState?.[key]?.energiaAtual ?? 0)
})

const arenaStyle = computed(() => {
  const domainImg = props.domainImage || props.arenaFundo
  if (!domainImg) return {}
  const overlay = props.domainImage
    ? 'linear-gradient(rgba(20,22,32,0.25),rgba(20,22,32,0.25)), '
    : ''
  const versioned = props.domainImage
    ? `${domainImg}${domainImg.includes('?') ? '&' : '?'}v=${props.domainImageVersion}`
    : domainImg
  return {
    backgroundImage: `${overlay}url('${versioned}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }
})

function adicionarLog(texto) {
  logEntries.value.unshift(texto)
  if (logEntries.value.length > 8) logEntries.value.pop()
}

function esconderPreview() { previewing.value = false }
function habilitarBotoes(_enabled) { /* ActionPanel handles disabled state via resolving prop */ }
function montarAcoes() { /* ActionPanel re-renders reactively */ }

function atualizarHUD() {
  const animations = window.__mugenAnimations
  if (!animations) return
  const s = state.serverState
  if (!s) return
  const makeRefs = (el) => ({
    root:    el,
    img:     el?.querySelector('.fighter-img') ?? null,
    initial: el?.querySelector('span') ?? null,
  })
  animations.visualPersonagem('p2', s.p2, makeRefs(fighterEnemyEl.value))
  animations.visualPersonagem('p1', s.p1, makeRefs(fighterPlayerEl.value))
}

function onActionSelected(acao) {
  processarAcao(acao, { adicionarLog, esconderPreview, habilitarBotoes, montarAcoes })
}

function onPageChange(newPage) { state.actionPage = newPage }

function onPreview(slot) {
  if (!slot?.type) return
  previewTitle.value = slot.nomeSprite || slot.nome
  previewText.value  = slot.description?.trim() || 'Ação de combate sem descrição detalhada.'
  previewing.value   = true
}

function onHidePreview() { esconderPreview() }

onMounted(async () => {
  const makeRefs = (el) => ({
    root:    el,
    img:     el?.querySelector('.fighter-img') ?? null,
    initial: el?.querySelector('span') ?? null,
  })

  const els = {
    arena:    arenaEl.value,
    log:      logEl.value,
    fighters: {
      p1: makeRefs(fighterPlayerEl.value),
      p2: makeRefs(fighterEnemyEl.value),
    },
    // Audio controller needs bgm-toggle-btn and bgm-volume-input — they're in App.vue DOM
    bgmToggleBtn:  document.getElementById('bgm-toggle-btn'),
    bgmVolumeInput: document.getElementById('bgm-volume-input'),
  }

  initLibs({ els, atualizarHUD })

  // Expose animation and audio libs globally so App.vue audio controls can reach them
  const { getAnimations, getAudio } = await import('../composables/useGame.js')
  window.__mugenAnimations = getAnimations()
  window.__mugenAudio      = getAudio()

  adicionarLog('Configure os jogadores e clique em INICIAR BATALHA.')

  // Trigger start if args were passed from App.vue
  const args = window.__mugenStartArgs
  if (args) {
    window.__mugenStartArgs = null
    try {
      const result = await iniciarPartida({
        ...args,
        onBattleSetup: () => {
          logEntries.value = []
          atualizarHUD()
          montarAcoes()
        },
      })
      adicionarLog(`Partida iniciada: ${result.state.p1.classeNome} vs ${result.state.p2.classeNome}.`)
      atualizarHUD()
    } catch (erro) {
      adicionarLog(`Erro ao iniciar: ${erro.message || 'falha de conexão com a API.'}`)
      adicionarLog('Confirme se o servidor está rodando em http://127.0.0.1:8080')
    }
  }
})
</script>
```

- [ ] **Step 2: Fix App.vue — BattleArena needs to start game after mounting**

The current `onStartGame` in App.vue sets `window.__mugenStartArgs` before BattleArena mounts. BattleArena picks up args in `onMounted`. This is correct but fragile if BattleArena is already mounted (play again). Refactor App.vue to use a ref for pending start args instead:

In `App.vue`, change:
```js
// Remove this line:
window.__mugenStartArgs = { p1Name, p2Name, p1Class, p2Class }
```

Replace with a proper event flow: emit `start-game` args to BattleArena via a prop. Add to App.vue:
```js
const pendingStartArgs = ref(null)

async function onStartGame({ p1Name, p2Name, p1Class, p2Class }) {
  pendingStartArgs.value = { p1Name, p2Name, p1Class, p2Class }
  phase.value = 'battle'
  appClass.value = 'is-playing'
  state.arenaFundo = `./assets/fundosdojogo/${encodeURIComponent(
    FUNDOS_ARENA[Math.floor(Math.random() * FUNDOS_ARENA.length)]
  )}`
}
```

Add `FUNDOS_ARENA` constant to App.vue:
```js
const FUNDOS_ARENA = [
  'BEACH 2.png','BEACH NIGHT.png','BEACH.png','CAVE 2.png','CAVE NIGHT.png','CAVE.png',
  'DESERT NIGHT.png','DESERT.png','LAKE NIGHT.png','LAKE.png','MOUNTAIN 2.png',
  'MOUNTAIN NIGHT.png','MOUNTAIN.png','OCEAN NIGHT.png','OCEAN.png','PATH 2.png',
  'PATH NIGHT.png','PATH.png','SNOW NIGHT.png','SNOW.png','TALL GRASS NIGHT.png',
  'TALL GRASS.png','UNDERWATER.png'
]
```

Pass `pending-start-args` prop to BattleArena in template:
```html
<BattleArena
  v-else-if="phase === 'battle'"
  :server-state="state.serverState"
  :action-page="state.actionPage"
  :resolving="state.resolvendoAcao"
  :arena-fundo="state.arenaFundo"
  :domain-image="state.domainImage"
  :domain-image-version="state.domainImageVersion"
  :pending-start-args="pendingStartArgs"
  @ready="pendingStartArgs = null"
  @reset="onReset"
/>
```

In `BattleArena.vue`, add the prop and watch it:
```js
const props = defineProps({
  // ... existing props ...
  pendingStartArgs: { type: Object, default: null },
})

watch(() => props.pendingStartArgs, async (args) => {
  if (!args) return
  emit('ready')
  try {
    const result = await iniciarPartida({
      ...args,
      onBattleSetup: () => {
        logEntries.value = []
        atualizarHUD()
        montarAcoes()
      },
    })
    adicionarLog(`Partida iniciada: ${result.state.p1.classeNome} vs ${result.state.p2.classeNome}.`)
    atualizarHUD()
  } catch (erro) {
    adicionarLog(`Erro ao iniciar: ${erro.message || 'falha de conexão com a API.'}`)
  }
})
```

Remove the `window.__mugenStartArgs` check from `onMounted` in BattleArena.vue.

- [ ] **Step 3: Commit**

```bash
cd /home/leonardo/MugenArena
git add frontend/src/components/BattleArena.vue frontend/src/App.vue
git commit -m "feat: add BattleArena component, wire DOM refs to animation libs"
```

---

## Task 11: Dockerfile multi-stage build

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Read current Dockerfile**

```bash
cat /home/leonardo/MugenArena/Dockerfile
```

- [ ] **Step 2: Replace Dockerfile with multi-stage build**

```dockerfile
# Stage 1 — build Vue app
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2 — PHP + Apache
FROM php:8.4-apache

COPY --from=builder /app/ /var/www/html/frontend/
COPY backend/ /var/www/html/backend/

RUN chown -R www-data:www-data /var/www/html
EXPOSE 80
```

- [ ] **Step 3: Commit**

```bash
cd /home/leonardo/MugenArena
git add Dockerfile
git commit -m "feat: multi-stage Dockerfile — Node builds Vue, PHP serves"
```

---

## Task 12: Local build verification

- [ ] **Step 1: Build the Vue app locally**

```bash
cd /home/leonardo/MugenArena/frontend && npm run build 2>&1
```

Expected: exits 0, `dist/` folder NOT created (emptyOutDir: false), `index.html` written to `frontend/`, `src/assets-built/` contains hashed bundles. If Vite errors, fix the reported file.

- [ ] **Step 2: Check for missing assets**

```bash
ls /home/leonardo/MugenArena/frontend/assets/fundos/ | head -5
ls /home/leonardo/MugenArena/frontend/assets/efeitos/ 2>/dev/null | head -5
```

Expected: `market1.jpg`, `market2.jpg`, `market3.jpg` present. `sangrar.png` and `queimar.png` present.

- [ ] **Step 3: Docker build test**

```bash
cd /home/leonardo/MugenArena && docker build -t mugen-arena-test . 2>&1 | tail -20
```

Expected: `Successfully built ...` with no errors.

- [ ] **Step 4: Smoke test in Docker**

```bash
docker run --rm -p 8081:80 mugen-arena-test &
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/frontend/
```

Expected: `200`. Kill test container after.

```bash
docker stop $(docker ps -q --filter ancestor=mugen-arena-test) 2>/dev/null || true
```

- [ ] **Step 5: Final commit**

```bash
cd /home/leonardo/MugenArena
git add -A
git commit -m "feat: complete Vue 3 migration — game fully functional"
```

---

## Self-Review Checklist

- [x] Task 1: Scaffold covered (package.json, vite.config.js, index.html)
- [x] Task 2: main.js entry
- [x] Task 3: useGame composable with full processarAcao logic (exact port from app.js)
- [x] Task 4: App.vue with intro→setup→battle routing and CSS class transitions
- [x] Task 5: IntroScreen.vue preserving all HTML structure
- [x] Task 6: GameSetup.vue with `.setup-screen` class (required by black-hole-animation.js)
- [x] Task 7: CharacterCard.vue with all IDs preserved (HP/energy bars)
- [x] Task 8: ActionPanel.vue replicating slot layout and pagination
- [x] Task 9: VictoryScreen.vue
- [x] Task 10: BattleArena.vue with DOM ref collection and lib init
- [x] Task 11: Dockerfile multi-stage
- [x] Task 12: Build verification
- [x] IDs preserved: `fighter-player`, `fighter-enemy`, `black-hole-overlay`, `black-hole-canvas`, `bgm-toggle-btn`, `bgm-volume-input`, `tutorial-modal`, `tutorial-overlay`, `tutorial-content-host`
- [x] CSS classes preserved: `.setup-screen`, `.topbar`, `.arena`, `.battle-app.is-intro/.is-playing`
- [x] Asset paths: all use absolute `/assets/...` paths → Vite resolves from `frontend/` root
- [x] `tutorial-content.html` stays in `frontend/` — accessible at `./tutorial-content.html`
- [x] Audio lib exposed via `window.__mugenAudio` for App.vue BGM controls
