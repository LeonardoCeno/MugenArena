<template>
  <aside class="controls" aria-label="Ações disponíveis">
    <h3>AÇÕES</h3>
    <div class="grid-actions" id="action-menu">
      <template v-for="(slot, idx) in slots" :key="idx">
        <button
          v-if="idx === 2"
          class="pagination-btn"
          :disabled="resolving || totalPaginas <= 1"
          @click="nextPage"
        >→</button>

        <button
          v-else-if="slot && slot.type"
          :disabled="resolving"
          :class="{ 'is-disabled-by-energy': slot.semEnergia }"
          :tabindex="(slot.semEnergia || resolving) ? -1 : 0"
          @mouseenter="$emit('preview', slot)"
          @mouseleave="$emit('hide-preview')"
          @focus="$emit('preview', slot)"
          @blur="$emit('hide-preview')"
          @click="onAction(slot)"
        >{{ slot.nome }}</button>

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
