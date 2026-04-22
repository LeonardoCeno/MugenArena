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
          <img class="intro-panel__image" src="/assets/fundos/market1.jpg" alt="Confronto de dominios" />
          <div class="intro-panel__content">
            <strong class="intro-panel__title">Confronto de Egos.</strong>
            <p class="intro-panel__text">Que sobreviva a mais forte</p>
          </div>
        </article>

        <div class="intro-panel-grid">
          <article class="intro-panel intro-panel--spotlight intro-panel--characters">
            <img class="intro-panel__image" src="/assets/fundos/market3.jpg" alt="Todos os personagens" />
            <div class="intro-panel__content intro-panel__content--top">
              <strong class="intro-panel__title">Todos os personagens</strong>
            </div>
          </article>

          <article class="intro-panel intro-panel--image-only" aria-label="Painel ilustrativo">
            <img class="intro-panel__image intro-panel__image--plain" src="/assets/fundos/market2.jpg" alt="Arena ilustrativa" />
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
