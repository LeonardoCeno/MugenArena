<template>
  <article
    class="card"
    :class="side === 'enemy' ? 'card-enemy' : 'card-player'"
    :id="side === 'enemy' ? 'card-enemy' : 'card-player'"
  >
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

    <div
      class="status-icons"
      :id="side === 'enemy' ? 'enemy-status-icons' : 'player-status-icons'"
    >
      <img
        v-if="bleedTurnos > 0"
        src="/assets/efeitos/sangrar.png"
        alt="Sangramento"
        :title="`Sangramento: ${bleedTurnos} turno(s)`"
      />
      <img
        v-if="burnTurnos > 0"
        src="/assets/efeitos/queimar.png"
        alt="Queimadura"
        :title="`Queimadura: ${burnTurnos} turno(s)`"
      />
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  side:          { type: String, required: true },
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
