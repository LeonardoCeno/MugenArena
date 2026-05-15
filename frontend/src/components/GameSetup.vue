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

      <button id="start-btn" class="start-btn" :disabled="!p1Class || !p2Class" @click="onStart">INICIAR BATALHA</button>
    </div>

    <!-- Clash mode selection overlay -->
    <Transition name="clash-select">
      <div v-if="showModeSelect" class="clash-select-overlay" @click.self="showModeSelect = false">
        <div class="clash-select-shell">
          <p class="clash-select-eyebrow">MODO DE CLASH</p>

          <div class="clash-select-cards">
            <!-- SORTE -->
            <button class="clash-card clash-card--sorte" @click="confirmMode('random')">
              <div class="clash-card__bg"></div>
              <div class="clash-card__glow"></div>
              <span class="clash-card__tag">ALEATORIO</span>
              <h2 class="clash-card__title">SORTE</h2>
              <p class="clash-card__desc">Vencedor do clash decidido por chance. Nenhum jogador controla o resultado.</p>
              <span class="clash-card__cta">ESCOLHER</span>
            </button>

            <div class="clash-select-divider">
              <span>VS</span>
            </div>

            <!-- QTE -->
            <button class="clash-card clash-card--qte" @click="confirmMode('qte')">
              <div class="clash-card__bg"></div>
              <div class="clash-card__glow"></div>
              <span class="clash-card__tag">HABILIDADE</span>
              <h2 class="clash-card__title">QTE</h2>
              <p class="clash-card__desc">Complete uma sequência de teclas antes do oponente. Quem for mais rápido vence o clash.</p>
              <span class="clash-card__cta">ESCOLHER</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  catalog: { type: Array, default: () => [] },
})
const emit = defineEmits(['start-game'])

const p1Name       = ref('Jogador 1')
const p2Name       = ref('Jogador 2')
const p1Class      = ref('')
const p2Class      = ref('')
const showModeSelect = ref(false)

const p1Preview = ref({ sprite: '', label: '' })
const p2Preview = ref({ sprite: '', label: '' })

watch(() => props.catalog, (cats) => {
  if (!cats.length) return
  if (!p1Class.value) {
    p1Class.value = cats[0].key
    p1Preview.value = { sprite: cats[0].selectSprite, label: cats[0].label }
  }
  if (!p2Class.value) {
    const second = cats.length > 1 ? cats[1] : cats[0]
    p2Class.value = second.key
    p2Preview.value = { sprite: second.selectSprite, label: second.label }
  }
}, { immediate: true })

function selectChar(side, char) {
  if (side === 'p1') {
    p1Class.value = char.key
    p1Preview.value = { sprite: char.selectSprite, label: char.label }
  } else {
    p2Class.value = char.key
    p2Preview.value = { sprite: char.selectSprite, label: char.label }
  }
}

function onStart() {
  if (!p1Class.value || !p2Class.value) return
  showModeSelect.value = true
}

function confirmMode(mode) {
  showModeSelect.value = false
  emit('start-game', {
    p1Name:    p1Name.value.trim(),
    p2Name:    p2Name.value.trim(),
    p1Class:   p1Class.value,
    p2Class:   p2Class.value,
    clashMode: mode,
  })
}
</script>
