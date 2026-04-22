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
        :classe-nome="(p2?.classeNome ?? '-').toUpperCase()"
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
        :classe-nome="(p1?.classeNome ?? '-').toUpperCase()"
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
        @hide-preview="esconderPreview"
      />
    </section>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { state, initLibs, processarAcao, iniciarPartida, getAnimations, getAudio } from '../composables/useGame.js'
import CharacterCard from './CharacterCard.vue'
import ActionPanel from './ActionPanel.vue'
import VictoryScreen from './VictoryScreen.vue'

const props = defineProps({
  serverState:        { type: Object,  default: null },
  actionPage:         { type: Number,  default: 0 },
  resolving:          { type: Boolean, default: false },
  arenaFundo:         { type: String,  default: null },
  domainImage:        { type: String,  default: null },
  domainImageVersion: { type: Number,  default: 0 },
  pendingStartArgs:   { type: Object,  default: null },
})
const emit = defineEmits(['reset', 'ready', 'battle-setup'])

const arenaEl        = ref(null)
const fighterPlayerEl = ref(null)
const fighterEnemyEl  = ref(null)
const logEl           = ref(null)

const logEntries   = ref([])
const previewing   = ref(false)
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
  if (props.domainImage) {
    const sep = props.domainImage.includes('?') ? '&' : '?'
    const versioned = `${props.domainImage}${sep}v=${props.domainImageVersion}`
    const overlay = 'linear-gradient(rgba(20,22,32,0.25),rgba(20,22,32,0.25))'
    return {
      backgroundImage: `${overlay}, url('${versioned}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
  }
  if (props.arenaFundo) {
    return {
      backgroundImage: `url('${props.arenaFundo}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
  }
  return {}
})

function adicionarLog(texto) {
  logEntries.value.unshift(texto)
  if (logEntries.value.length > 8) logEntries.value.pop()
}

function esconderPreview() { previewing.value = false }
function habilitarBotoes(_enabled) { /* ActionPanel reacts to resolving prop */ }
function montarAcoes() { /* ActionPanel re-renders reactively */ }

function makeRefs(el) {
  return {
    root:    el,
    img:     el?.querySelector('.fighter-img') ?? null,
    initial: el?.querySelector('span') ?? null,
  }
}

function atualizarHUD() {
  const animations = getAnimations()
  if (!animations) return
  const s = state.serverState
  if (!s) return
  animations.visualPersonagem('p1', s.p1, makeRefs(fighterPlayerEl.value))
  animations.visualPersonagem('p2', s.p2, makeRefs(fighterEnemyEl.value))
}

function onActionSelected(acao) {
  processarAcao(acao, { adicionarLog, esconderPreview, habilitarBotoes, montarAcoes })
    .then(result => {
      if (result?.reset) emit('reset')
    })
    .catch(erro => adicionarLog(`Erro inesperado: ${erro.message || 'falha desconhecida.'}`))
}

function onPageChange(newPage) { state.actionPage = newPage }

function onPreview(slot) {
  if (!slot?.type) return
  previewTitle.value = slot.nomeSprite || slot.nome
  previewText.value  = slot.description?.trim() || 'Ação de combate sem descrição detalhada.'
  previewing.value   = true
}

onMounted(() => {
  const els = {
    arena:         arenaEl.value,
    log:           logEl.value,
    fighters: {
      p1: makeRefs(fighterPlayerEl.value),
      p2: makeRefs(fighterEnemyEl.value),
    },
    bgmToggleBtn:   document.getElementById('bgm-toggle-btn'),
    bgmVolumeInput: document.getElementById('bgm-volume-input'),
  }

  initLibs({ els, atualizarHUD })

  window.__mugenAnimations = getAnimations()
  window.__mugenAudio      = getAudio()

  adicionarLog('Configure os jogadores e clique em INICIAR BATALHA.')
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
        emit('battle-setup')
      },
    })
    adicionarLog(`Partida iniciada: ${result.state.p1.classeNome} vs ${result.state.p2.classeNome}.`)
    atualizarHUD()
  } catch (erro) {
    adicionarLog(`Erro ao iniciar: ${erro.message || 'falha de conexão com a API.'}`)
    adicionarLog('Confirme se o servidor está rodando em http://127.0.0.1:8080')
    emit('reset')
  }
}, { immediate: true })
</script>
