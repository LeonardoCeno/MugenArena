<template>
  <main class="battle-app" :class="appClass">
    <header class="topbar">
      <p id="turn-info">{{ turnInfo }}</p>
      <div class="topbar-audio">
        <button
          id="bgm-toggle-btn"
          type="button"
          class="bgm-toggle-btn"
          :aria-pressed="String(audioMuted)"
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

    <div
      id="tutorial-modal"
      class="tutorial-modal"
      :class="{ 'is-hidden': !tutorialOpen }"
      :aria-hidden="String(!tutorialOpen)"
    >
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
      :pending-start-args="pendingStartArgs"
      @ready="pendingStartArgs = null"
      @reset="onReset"
    />
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { state, carregarCatalogo, resetarEstado, FUNDOS_ARENA } from './composables/useGame.js'
import IntroScreen from './components/IntroScreen.vue'
import GameSetup from './components/GameSetup.vue'
import BattleArena from './components/BattleArena.vue'

const phase = ref('intro')
const appClass = ref('is-intro')
const catalog = ref([])
const pendingStartArgs = ref(null)
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
    .catch(() => {
      tutorialHtml.value = '<div class="tutorial-modal__loading">Nao foi possivel carregar o tutorial.</div>'
    })
    .finally(() => { tutorialLoadingPromise.value = null })
  await tutorialLoadingPromise.value
}

async function abrirTutorial() {
  try { await carregarTutorial() } catch (_) {}
  tutorialOpen.value = true
}

function fecharTutorial() { tutorialOpen.value = false }

function onToggleMute() {
  audioMuted.value = !audioMuted.value
  const audioLib = window.__mugenAudio
  if (audioLib) audioLib.toggleMute()
}

function onVolume(e) {
  volume.value = e.target.value
  const audioLib = window.__mugenAudio
  if (audioLib) audioLib.setVolume(e.target.value)
}

async function onStartGame({ p1Name, p2Name, p1Class, p2Class }) {
  state.arenaFundo = `./assets/fundosdojogo/${encodeURIComponent(
    FUNDOS_ARENA[Math.floor(Math.random() * FUNDOS_ARENA.length)]
  )}`
  pendingStartArgs.value = { p1Name, p2Name, p1Class, p2Class }
  phase.value = 'battle'
  appClass.value = 'is-playing'
}

function onReset() {
  resetarEstado()
  phase.value = 'setup'
  appClass.value = ''
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
