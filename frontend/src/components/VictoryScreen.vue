<template>
  <div
    class="winner-overlay"
    id="winner-overlay"
    :class="{ 'is-hidden': !winner }"
    aria-live="polite"
  >
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

const winSprite = computed(() =>
  vencedor.value?.visual?.winImage || vencedor.value?.visual?.baseSprite || ''
)

const winText = computed(() => {
  if (!winner.value) return ''
  const label = winner.value === 'p1' ? 'Jogador 1' : 'Jogador 2'
  return vencedor.value?.visual?.winMessage ?? `${label} (${vencedor.value?.nome ?? ''}) venceu!`
})
</script>
