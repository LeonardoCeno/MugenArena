import { reactive } from 'vue'
import { createAnimationController } from '../libs/battle-animations.js'
import { createClashSystem } from '../libs/clash-system.js'
import { createAudioController, AUDIO_DOMAIN_BREAK } from '../libs/audio-controller.js'
import { startBlackHoleAnimation } from '../libs/black-hole-animation.js'

const API_URL = '../backend/web_api.php'

export const FUNDOS_ARENA = [
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
  anim: null,
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

// Called once from BattleArena.vue onMounted. Safe to call again on remount
// (resetarEstado cancels in-flight animations before re-init).
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
  if (state.resolvendoAcao || !state.serverState?.started || state.serverState.winner) return {}

  esconderPreview()
  state.resolvendoAcao = true
  habilitarBotoes(false)

  const atacanteKey = state.serverState.currentKey
  const errorSplash = state.serverState[atacanteKey]?.visual?.errorSplash ?? null
  animations.cancelarAnimacao()

  let didReset = false

  try {
    const resposta = await chamarApi('action', {
      playerKey:  atacanteKey,
      actionType: acao.type,
      skillIndex: typeof acao.skillIndex === 'number' ? acao.skillIndex : null,
    })

    const mensagem = resposta.message || null

    if (resposta.state?.started === false) {
      didReset = true
      limparPosePendente()
      if (errorSplash) await animations.mostrarSplashErroInsano(errorSplash, 3000)
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
    if (!didReset) {
      state.actionPage = 0
      montarAcoes()
      state.resolvendoAcao = false
      habilitarBotoes(true)
    }
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
  state.sprites.p1 = null
  state.sprites.p2 = null
  state.frameScale.p1 = null
  state.frameScale.p2 = null
}
