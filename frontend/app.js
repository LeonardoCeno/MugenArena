import { createUIController } from "./ui-status.js";
import { createAnimationController } from "./battle-animations.js";
import { createClashSystem } from "./clash-system.js";
import { createAudioController, AUDIO_DOMAIN_BREAK } from "./audio-controller.js";
import { startBlackHoleAnimation } from "./black-hole-animation.js";

const FUNDOS_ARENA = ["BEACH 2.png","BEACH NIGHT.png","BEACH.png","CAVE 2.png","CAVE NIGHT.png","CAVE.png","DESERT NIGHT.png","DESERT.png","LAKE NIGHT.png","LAKE.png","MOUNTAIN 2.png","MOUNTAIN NIGHT.png","MOUNTAIN.png","OCEAN NIGHT.png","OCEAN.png","PATH 2.png","PATH NIGHT.png","PATH.png","SNOW NIGHT.png","SNOW.png","TALL GRASS NIGHT.png","TALL GRASS.png","UNDERWATER.png"];

(() => {
	const API_URL = "../backend/web_api.php";

	const state = {
		serverState: null,
		resolvendoAcao: false,
		actionPage: 0,
		introTransitioning: false,
		anim: null,
		tutorialLoaded: false,
		tutorialLoadingPromise: null,
		sprites: { p1: null, p2: null },
		frameScale: { p1: null, p2: null },
		pendingSprites: { p1: null, p2: null },
		pendingFrameScale: { p1: null, p2: null },
		domainImage: null,
		domainImageVersion: 0,
		arenaFundo: null,
		acaoPendente: null, // { playerKey, acao } — guarda ação do 1º jogador até o turno resolver
	};

	const fighterPlayerEl = document.getElementById("fighter-player");
	const fighterEnemyEl  = document.getElementById("fighter-enemy");

	const els = {
		turnInfo:         document.getElementById("turn-info"),
		topbar:           document.querySelector(".topbar"),
		introScreen:      document.getElementById("intro-screen"),
		introStartBtn:    document.getElementById("intro-start-btn"),
		introTutorialBtn: document.getElementById("intro-tutorial-btn"),
		tutorialOpenBtn:  document.getElementById("tutorial-open-btn"),
		tutorialModal:    document.getElementById("tutorial-modal"),
		tutorialOverlay:  document.getElementById("tutorial-overlay"),
		tutorialContentHost: document.getElementById("tutorial-content-host"),
		bgmToggleBtn:     document.getElementById("bgm-toggle-btn"),
		bgmVolumeInput:   document.getElementById("bgm-volume-input"),
		log:              document.getElementById("battle-log"),
		combatFeed:       document.getElementById("combat-feed"),
		skillPreview:     document.getElementById("skill-preview"),
		skillPreviewTitle:document.getElementById("skill-preview-title"),
		skillPreviewText: document.getElementById("skill-preview-text"),
		menu:             document.getElementById("action-menu"),
		arena:            document.querySelector(".arena"),
		battleApp:        document.querySelector(".battle-app"),
		setupPanel:       document.getElementById("setup-panel"),
		battleView:       document.getElementById("battle-view"),
		startBtn:         document.getElementById("start-btn"),
		p1Name:           document.getElementById("p1-name"),
		p2Name:           document.getElementById("p2-name"),
		p1Class:          document.getElementById("p1-class"),
		p2Class:          document.getElementById("p2-class"),
		winnerOverlay:    document.getElementById("winner-overlay"),
		winnerSprite:     document.getElementById("winner-sprite"),
		winnerText:       document.getElementById("winner-text"),
		playAgainBtn:     document.getElementById("play-again-btn"),
		cards: {
			enemy: {
				root:        document.getElementById("card-enemy"),
				name:        document.getElementById("enemy-name"),
				tag:         document.getElementById("enemy-tag"),
				hpText:      document.getElementById("enemy-hp-text"),
				energyText:  document.getElementById("enemy-energy-text"),
				hpBar:       document.getElementById("enemy-hp-bar"),
				energyBar:   document.getElementById("enemy-energy-bar"),
				statusIcons: document.getElementById("enemy-status-icons"),
			},
			player: {
				root:        document.getElementById("card-player"),
				name:        document.getElementById("player-name"),
				tag:         document.getElementById("player-tag"),
				hpText:      document.getElementById("player-hp-text"),
				energyText:  document.getElementById("player-energy-text"),
				hpBar:       document.getElementById("player-hp-bar"),
				energyBar:   document.getElementById("player-energy-bar"),
				statusIcons: document.getElementById("player-status-icons"),
			},
		},
		fighters: {
			p1: {
				root:    fighterPlayerEl,
				img:     fighterPlayerEl?.querySelector(".fighter-img") || null,
				initial: fighterPlayerEl?.querySelector("span") || null,
			},
			p2: {
				root:    fighterEnemyEl,
				img:     fighterEnemyEl?.querySelector(".fighter-img") || null,
				initial: fighterEnemyEl?.querySelector("span") || null,
			},
		},
	};

	let ui = null;
	let animations = null;

	function oposto(chave) { return chave === "p1" ? "p2" : "p1"; }

	function obterElementosTutorial() {
		const host = els.tutorialContentHost;
		if (!host) return null;

		return {
			host,
			closeBtn: host.querySelector("[data-tutorial-close]"),
			nav: host.querySelector("[data-tutorial-nav]"),
			buttons: [...host.querySelectorAll(".tutorial-modal__topic-btn")],
			panels: [...host.querySelectorAll(".tutorial-modal__topic-panel")],
		};
	}

	function renderizarTopicoTutorial(topicId = null) {
		const refs = obterElementosTutorial();
		if (!refs) return;

		const targetId = topicId ?? refs.buttons[0]?.dataset.topicId ?? null;
		if (!targetId) return;

		refs.buttons.forEach(btn => {
			btn.classList.toggle("is-active", btn.dataset.topicId === targetId);
		});

		refs.panels.forEach(panel => {
			panel.classList.toggle("is-active", panel.dataset.topicPanel === targetId);
		});
	}

	async function carregarTutorialSeNecessario() {
		if (state.tutorialLoaded || !els.tutorialContentHost) return;
		if (state.tutorialLoadingPromise) {
			await state.tutorialLoadingPromise;
			return;
		}

		els.tutorialContentHost.innerHTML = '<div class="tutorial-modal__loading">CARREGANDO TUTORIAL...</div>';
		state.tutorialLoadingPromise = fetch("./tutorial-content.html")
			.then(async response => {
				if (!response.ok) {
					throw new Error(`Falha ao carregar tutorial (${response.status}).`);
				}
				const html = await response.text();
				els.tutorialContentHost.innerHTML = html;
				state.tutorialLoaded = true;
				renderizarTopicoTutorial();
			})
			.catch(erro => {
				els.tutorialContentHost.innerHTML = '<div class="tutorial-modal__loading">Nao foi possivel carregar o tutorial.</div>';
				throw erro;
			})
			.finally(() => {
				state.tutorialLoadingPromise = null;
			});

		await state.tutorialLoadingPromise;
	}

	async function abrirTutorial() {
		if (!els.tutorialModal) return;
		try {
			await carregarTutorialSeNecessario();
		} catch (_) {}
		els.tutorialModal.classList.remove("is-hidden");
		els.tutorialModal.setAttribute("aria-hidden", "false");
	}

	function fecharTutorial() {
		if (!els.tutorialModal) return;
		els.tutorialModal.classList.add("is-hidden");
		els.tutorialModal.setAttribute("aria-hidden", "true");
	}

	function wait(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	async function abrirSelecaoInicial() {
		if (state.introTransitioning) return;
		state.introTransitioning = true;

		if (els.introStartBtn) els.introStartBtn.disabled = true;
		if (els.introTutorialBtn) els.introTutorialBtn.disabled = true;

		els.setupPanel?.classList.remove("is-hidden");
		els.setupPanel?.classList.add("is-transition-ready");

		requestAnimationFrame(() => {
			els.battleApp?.classList.add("is-entering-setup");
			els.battleApp?.classList.remove("is-intro");
			els.introScreen?.classList.add("is-leaving");
		});

		await wait(820);

		els.introScreen?.classList.add("is-hidden");
		els.introScreen?.classList.remove("is-leaving");
		els.setupPanel?.classList.remove("is-transition-ready");
		els.battleApp?.classList.remove("is-entering-setup");

		if (els.turnInfo) {
			els.turnInfo.textContent = "Prepare a partida";
		}

		if (els.introStartBtn) els.introStartBtn.disabled = false;
		if (els.introTutorialBtn) els.introTutorialBtn.disabled = false;
		state.introTransitioning = false;
	}

	const atualizarHUD = () => {
		if (!ui || !animations) return;
		ui.atualizarHUD({ renderFighter: animations.visualPersonagem });
	};

	async function chamarApi(action, payload = {}) {
		const response = await fetch(API_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action, ...payload }),
		});

		if (!response.ok) {
			let mensagemErro = `Falha na API (${response.status}).`;
			try {
				const corpo = await response.json();
				if (corpo?.message) mensagemErro = corpo.message;
			} catch (_) {}
			throw new Error(mensagemErro);
		}

		return response.json();
	}

	function atualizarEstado(novoEstado, mostrarDano = false) {
		const estadoAnterior = state.serverState;
		state.serverState = novoEstado;

		if (!mostrarDano || !estadoAnterior?.started || !novoEstado?.started) return;
		animations.feedbackDano(estadoAnterior, novoEstado);
	}

	function limparPosePendente(chave = null) {
		if (chave) {
			state.pendingSprites[chave] = null;
			state.pendingFrameScale[chave] = null;
			return;
		}

		state.pendingSprites.p1 = null;
		state.pendingSprites.p2 = null;
		state.pendingFrameScale.p1 = null;
		state.pendingFrameScale.p2 = null;
	}

	function aplicarPosePendenteDeDomain(chave, acao) {
		if (!acao?.activatesDomain || !acao?.domainClash) {
			limparPosePendente(chave);
			return;
		}

		const frame = animations.obterPrimeiroFrameDaAcao(chave, acao);
		if (!frame?.sprite) {
			limparPosePendente(chave);
			return;
		}

		state.pendingSprites[chave] = frame.sprite;
		state.pendingFrameScale[chave] = frame.scale ?? null;
	}

	async function animarEsquivaEmTempoReal(mensagemEtapa, estadoAtual) {
		if (!mensagemEtapa || !mensagemEtapa.includes("desviou!")) return false;
		for (const key of ["p1", "p2"]) {
			const nomeJogador = estadoAtual?.[key]?.nome ?? "";
			if (nomeJogador && mensagemEtapa.includes(`${nomeJogador} desviou`)) {
				animations.animarEsquiva(key);
				await animations.wait(800);
				return true;
			}
		}
		return false;
	}

	async function verificarEAnimarTransformacao(estadoAnterior, estadoNovo) {
		if (!estadoAnterior?.started || !estadoNovo?.started) return;
		for (const chave of ["p1", "p2"]) {
			if (!estadoAnterior[chave]?.transformado && estadoNovo[chave]?.transformado) {
				await animations.animarTransformacao(chave);
			}
		}
	}

	async function tocarAnimacao(atacanteKey, acao, defensorKey, defensorEstaDefendendo) {
		const timeline      = animations.montarAnimacao(atacanteKey, acao, defensorKey, defensorEstaDefendendo);
		const animacaoAtiva = animations.rodarTimeline(timeline);
		state.anim          = animacaoAtiva;
		await animations.wait(animacaoAtiva.duration);
		animations.cancelarAnimacao();
	}

	function deslocarEventos(events, delayMs) {
		if (delayMs <= 0) return events;
		return events.map(event => ({ ...event, at: event.at + delayMs }));
	}

	function sincronizarLancamentoDeProjeteis(animData1, animData2) {
		const syncedLaunchMs = Math.max(animData1.projectileStartMs, animData2.projectileStartMs);

		const sincronizar = (animData) => {
			const delayMs = Math.max(0, syncedLaunchMs - animData.projectileStartMs);
			return {
				...animData,
				preEvents: [
					...animData.preLaunchEvents,
					...deslocarEventos(animData.launchEvents, delayMs),
				],
				projectileStartMs: syncedLaunchMs,
			};
		};

		return [sincronizar(animData1), sincronizar(animData2)];
	}

	function sincronizarExpansaoDeDomains(animData1, animData2) {
		const syncedExpandMs = Math.max(animData1.domainExpandMs, animData2.domainExpandMs);

		return [
			{ ...animData1, syncedExpandMs },
			{ ...animData2, syncedExpandMs },
		];
	}

	async function executarTurnoClash(acoesMap, clashMeta, estadoFinal) {
		const rawAnimData1 = animations.montarAnimacaoClash("p1", acoesMap["p1"], "p2");
		const rawAnimData2 = animations.montarAnimacaoClash("p2", acoesMap["p2"], "p1");
		const [animData1, animData2] = sincronizarLancamentoDeProjeteis(rawAnimData1, rawAnimData2);

		const allPreEvents = [...animData1.preEvents, ...animData2.preEvents];
		const handle = animations.rodarTimeline(allPreEvents);
		state.anim = handle;

		// Wait until both projectiles are in flight (max startMs + small buffer)
		const bothLaunchedMs = Math.max(animData1.projectileStartMs, animData2.projectileStartMs) + 80;
		await animations.wait(bothLaunchedMs);

		const ref1 = animData1.getProjectileRef();
		const ref2 = animData2.getProjectileRef();
		const refs1 = animData1.getProjectileRefs?.() ?? (ref1 ? [ref1] : []);
		const refs2 = animData2.getProjectileRefs?.() ?? (ref2 ? [ref2] : []);

		if (ref1 && ref2) {
			await clashSystem.runClash(
				ref1, ref2, clashMeta,
				animData1.postEvents, animData2.postEvents,
				animations,
				refs1,
				refs2
			);
		} else {
			// Fallback: projectile refs unavailable — wait out clash, then fire winner's post-events
			await animations.wait(clashMeta.durationMs);
			const winnerPost = clashMeta.winner === "p1" ? animData1.postEvents : animData2.postEvents;
			if (winnerPost.length > 0) {
				const h = animations.rodarTimeline(winnerPost);
				await animations.wait(h.duration);
			}
		}

		animations.cancelarAnimacao();
	}

	async function prepararDomainClash(acoesMap) {
		animations.mostrarAnelClashDeDomain();
		const rawAnimData1 = animations.montarAnimacaoDomainClash("p1", acoesMap["p1"], "p2");
		const rawAnimData2 = animations.montarAnimacaoDomainClash("p2", acoesMap["p2"], "p1");
		const [animData1, animData2] = sincronizarExpansaoDeDomains(rawAnimData1, rawAnimData2);

		const preEvents = [...animData1.preExpandEvents, ...animData2.preExpandEvents];
		state.anim = animations.rodarTimeline(preEvents);

		await animations.wait(Math.max(animData1.syncedExpandMs, animData2.syncedExpandMs));

		const cleanupSplit = animations.mostrarPainelClashDeDomain(
			animData1.domainImage,
			animData2.domainImage,
			7000
		);
		audio.playClashDomain();

		return { animData1, animData2, cleanupSplit };
	}

	async function executarTurnoDomainClash(acoesMap, clashMeta) {
		const { animData1, animData2, cleanupSplit } = await prepararDomainClash(acoesMap);

		if (clashMeta?.bothFailed) {
			await animations.wait(6000);
			await audio.fadeOutClashDomain(1000);
			cleanupSplit();
			state.sprites.p1 = null;
			state.sprites.p2 = null;
			state.frameScale.p1 = null;
			state.frameScale.p2 = null;
			limparPosePendente();
			atualizarHUD();
			animations.textoFlutuante("p1", "domain break");
			animations.textoFlutuante("p2", "domain break");

			const breakDurationMs = 2200;
			const breakAudioExtraMs = 1200;
			const breakFadeMs = 1000;
			const breakAudio = new Audio(AUDIO_DOMAIN_BREAK);
			breakAudio.volume = audio.getVolume();
			breakAudio.muted = false;
			breakAudio.play().catch(() => {});

			try {
				await animations.mostrarFundoDomainBreak(clashMeta.effectGif || "./assets/efeitos/domainbreak.gif", breakDurationMs);
				await animations.wait(breakAudioExtraMs - breakFadeMs);
				await audio.fadeAudioOut(breakAudio, breakFadeMs);
			} finally {
				breakAudio.pause();
				breakAudio.currentTime = 0;
			}

			animations.cancelarAnimacao();
			return { bothFailed: true };
		}

		const winnerKey = clashMeta.winner;
		const fadeOutMs = 1400;
		const fadeInMs = 1400;
		await animations.wait(7000 - fadeOutMs);

		const loserKey = winnerKey === "p1" ? "p2" : "p1";
		const winnerAnimData = winnerKey === "p1" ? animData1 : animData2;
		const blackoutPromise = animations.mostrarTransicaoPosClashDeDomain(fadeOutMs, fadeInMs);

		await animations.wait(Math.max(0, fadeOutMs - 1000));
		const fadeAudioPromise = audio.fadeOutClashDomain(1000);
		await animations.wait(1000);
		await fadeAudioPromise;
		cleanupSplit();
		state.sprites[loserKey] = null;
		state.frameScale[loserKey] = null;
		limparPosePendente(loserKey);
		state.domainImageVersion += 1;
		state.domainImage = winnerAnimData.domainImage ?? null;
		atualizarHUD();

		const winnerPostHandle = winnerAnimData.winnerDeferredEvents.length > 0
			? animations.rodarTimeline(winnerAnimData.winnerDeferredEvents)
			: { duration: 0, cancel() {} };

		await blackoutPromise;

		const restanteMs = Math.max(0, Math.max(clashMeta.durationMs ?? 0, winnerPostHandle.duration) - fadeOutMs);
		await animations.wait(restanteMs);
		animations.cancelarAnimacao();
		return { bothFailed: false };
	}

	async function processarAcao(acao) {
		if (state.resolvendoAcao || !state.serverState?.started || state.serverState.winner) return;

		ui.esconderPreview();
		state.resolvendoAcao = true;
		ui.habilitarBotoes(false);

		const atacanteKey = state.serverState.currentKey;
		const errorSplash = state.serverState[atacanteKey]?.visual?.errorSplash ?? null;

		animations.cancelarAnimacao();

		try {
			const resposta = await chamarApi("action", {
				playerKey:  atacanteKey,
				actionType: acao.type,
				skillIndex: typeof acao.skillIndex === "number" ? acao.skillIndex : null,
			});

			const mensagem = resposta.message || null;

			if (resposta.state?.started === false) {
				limparPosePendente();
				if (errorSplash) await animations.mostrarSplashErroInsano(errorSplash, 3000);
				resetarParaSetup();
				if (mensagem) ui.adicionarLog(mensagem);
				return;
			}

			if (!resposta.resolved) {
				state.acaoPendente = { playerKey: atacanteKey, acao };
				aplicarPosePendenteDeDomain(atacanteKey, acao);
				if (resposta.state) atualizarEstado(resposta.state, false);
				atualizarHUD();
				const proximo = resposta.state?.currentKey;
				const nomeProximo = proximo ? (proximo === "p1" ? "Jogador 1" : "Jogador 2") : "outro jogador";
				ui.adicionarLog(`Aguardando ${nomeProximo} escolher...`);
				return;
			}

			const ordem    = resposta.resolucaoOrdem ?? [atacanteKey, oposto(atacanteKey)];
			const mensagensResolucao = Array.isArray(resposta.mensagensResolucao) ? resposta.mensagensResolucao : [];
			const domainCancel = resposta.domainCancel?.cancelled ? resposta.domainCancel : null;
			const acoesMap = { [atacanteKey]: acao };
			aplicarPosePendenteDeDomain(atacanteKey, acao);
			if (state.acaoPendente) {
				acoesMap[state.acaoPendente.playerKey] = state.acaoPendente.acao;
			}
			state.acaoPendente = null;
			atualizarHUD();

			const estadoIntermediario = resposta.estadoIntermediario ?? null;
			const estadoFinal         = resposta.state ?? null;

			// ── Clash branch ─────────────────────────────────────────────────────
			if (resposta.clash?.occurred) {
				if (resposta.clash.kind === "domain") {
					await executarTurnoDomainClash(acoesMap, resposta.clash);
				} else {
					await executarTurnoClash(acoesMap, resposta.clash, estadoFinal);
				}
				limparPosePendente();
				const estadoAntesDaAtualizacao = state.serverState;
				atualizarEstado(estadoFinal, true);
				atualizarHUD();
				await verificarEAnimarTransformacao(estadoAntesDaAtualizacao, estadoFinal);
				if (mensagem) ui.adicionarLog(mensagem);
				if (resposta.state?.winner) {
					await animations.animarMorte(oposto(resposta.state.winner));
				}
				atualizarHUD();
				return;
			}
			// ── End clash branch ──────────────────────────────────────────────────

			const ordemAnimada = ordem.filter(k => acoesMap[k] && acoesMap[k].type !== "skip");

			for (let i = 0; i < ordemAnimada.length; i++) {
				const keyAtacante        = ordemAnimada[i];
				const acaoAtacante       = acoesMap[keyAtacante];
				const keyDefensor        = oposto(keyAtacante);
				const defensorDefendendo = acoesMap[keyDefensor]?.type === "defend";
				const mensagemEtapa      = mensagensResolucao[i] ?? null;

				limparPosePendente(keyAtacante);
				await tocarAnimacao(keyAtacante, acaoAtacante, keyDefensor, defensorDefendendo);

				const isUltimo      = i === ordemAnimada.length - 1;
				const estadoAplicar = (!isUltimo && estadoIntermediario) ? estadoIntermediario : estadoFinal;
				if (estadoAplicar) {
					const estadoAntesDaAtualizacao = state.serverState;
					atualizarEstado(estadoAplicar, true);
					atualizarHUD();
					await animarEsquivaEmTempoReal(mensagemEtapa, estadoAplicar);
					await verificarEAnimarTransformacao(estadoAntesDaAtualizacao, estadoAplicar);
				}

				if (!isUltimo) {
					await new Promise(r => setTimeout(r, 500));
				}
			}

			// Garante estado final aplicado caso nenhuma animação tenha tocado
			if (ordemAnimada.length === 0 && estadoFinal) {
				const estadoAntesDaAtualizacao = state.serverState;
				limparPosePendente();
				atualizarEstado(estadoFinal, true);
				await animarEsquivaEmTempoReal(mensagensResolucao[0] ?? null, estadoFinal);
				await verificarEAnimarTransformacao(estadoAntesDaAtualizacao, estadoFinal);
			}

			limparPosePendente();

			if (domainCancel?.playerKey) {
				animations.textoFlutuante(domainCancel.playerKey, String(domainCancel.text || "domain failed"));
			}

			if (mensagem) {
				ui.adicionarLog(mensagem);
			}

			if (resposta.state?.winner) {
				await animations.animarMorte(oposto(resposta.state.winner));
			}

			atualizarHUD();
		} catch (erro) {
			state.acaoPendente = null;
			limparPosePendente();
			audio.stopClashDomain();
			animations.cancelarAnimacao();
			atualizarHUD();
			ui.adicionarLog(`Erro ao executar ação: ${erro.message || "falha desconhecida."}`);
		} finally {
			state.actionPage = 0;
			ui.montarAcoes();
			state.resolvendoAcao = false;
			ui.habilitarBotoes(true);
		}
	}

	function resetarParaSetup() {
		audio.stopClashDomain();
		audio.stopBgm();
		limparPosePendente();
		ui.resetarParaSetup(animations.cancelarAnimacao);
	}

	function resetarOverlayBH() {
		const overlay = document.getElementById('black-hole-overlay');
		if (overlay) overlay.style.display = 'none';
		['.topbar', '.setup-screen'].forEach(sel => {
			const el = document.querySelector(sel);
			if (el) { el.style.transition = 'none'; el.style.transform = ''; el.style.opacity = ''; el.style.willChange = ''; }
		});
	}

	async function iniciar() {
		if (window.location.protocol === "file:") {
			ui.adicionarLog("Abra pelo servidor PHP: http://127.0.0.1:8080/batalha.html");
			return;
		}

		els.startBtn.disabled = true;
		try {
			const resposta = await chamarApi("start", {
				p1Name:  els.p1Name.value.trim()  || "Jogador 1",
				p1Class: els.p1Class.value,
				p2Name:  els.p2Name.value.trim()  || "Jogador 2",
				p2Class: els.p2Class.value,
			});

			if (!resposta.ok) {
				ui.adicionarLog(resposta.message || "Não foi possível iniciar a partida.");
				return;
			}

			atualizarEstado(resposta.state, false);
			state.resolvendoAcao = false;
			state.actionPage = 0;
			limparPosePendente();
			animations.cancelarAnimacao();
			audio.playRandomBgm();
			ui.esconderPreview();

			await startBlackHoleAnimation({
				onBattleSetup: () => {
					state.arenaFundo = `./assets/fundosdojogo/${encodeURIComponent(FUNDOS_ARENA[Math.floor(Math.random() * FUNDOS_ARENA.length)])}`;
					els.battleApp.classList.add("is-playing");
					els.setupPanel.classList.add("is-hidden");
					els.battleView.classList.remove("is-hidden");
					els.log.innerHTML = "";
					atualizarHUD();
					ui.montarAcoes();
				}
			});

			ui.adicionarLog(`Partida iniciada: ${state.serverState.p1.classeNome} vs ${state.serverState.p2.classeNome}.`);
		} catch (erro) {
			ui.adicionarLog(`Erro ao iniciar: ${erro.message || "falha de conexão com a API."}`);
			ui.adicionarLog("Confirme se o servidor está rodando em http://127.0.0.1:8080");
			resetarOverlayBH();
		} finally {
			els.startBtn.disabled = false;
		}
	}

	animations = createAnimationController({ state, els, atualizarHUD });
	const clashSystem = createClashSystem();
	const audio = createAudioController({ els });
	ui = createUIController({ state, els, onActionSelected: processarAcao });
	audio.setVolume(1);
	audio.updateMuteButton();

	function atualizarPreview(pickerDataFor, spriteUrl, label) {
		const side = pickerDataFor === 'p1-class' ? 'p1' : 'p2';
		const img  = document.getElementById(`${side}-preview-sprite`);
		const name = document.getElementById(`${side}-preview-name`);
		if (!img) return;
		img.classList.add('loading');
		setTimeout(() => {
			img.src = spriteUrl ?? '';
			img.alt = label ?? '';
			if (name) name.textContent = label ?? '';
			requestAnimationFrame(() => img.classList.remove('loading'));
		}, 80);
	}

	function construirSeletores(catalog) {
		document.querySelectorAll(".char-picker").forEach((picker) => {
			const defaultKey = document.getElementById(picker.dataset.for).value;
			picker.replaceChildren(
				...catalog.map((c) => {
					const btn = document.createElement("button");
					btn.type = "button";
					btn.className = "char-option" + (c.key === defaultKey ? " is-selected" : "");
					btn.dataset.value  = c.key;
					btn.dataset.sprite = c.selectSprite ?? '';
					btn.dataset.label  = c.label ?? '';
					const img = document.createElement("img");
					img.src = c.selectSprite;
					img.alt = c.label;
					const span = document.createElement("span");
					span.textContent = c.label;
					btn.append(img, span);
					return btn;
				})
			);
			const selected = picker.querySelector(".char-option.is-selected");
			if (selected) atualizarPreview(picker.dataset.for, selected.dataset.sprite, selected.dataset.label);
		});
	}

	chamarApi("catalog")
		.then((data) => construirSeletores(data.catalog ?? []))
		.catch((erro) => ui.adicionarLog(`Erro ao carregar personagens: ${erro.message}`));

	els.setupPanel.addEventListener("click", (e) => {
		const opt = e.target.closest(".char-option");
		if (!opt) return;
		const picker = opt.closest(".char-picker");
		picker.querySelectorAll(".char-option").forEach((b) => b.classList.remove("is-selected"));
		opt.classList.add("is-selected");
		document.getElementById(picker.dataset.for).value = opt.dataset.value;
		atualizarPreview(picker.dataset.for, opt.dataset.sprite, opt.dataset.label);
	});

	els.startBtn.addEventListener("click", iniciar);
	els.playAgainBtn.addEventListener("click", resetarParaSetup);
	els.introStartBtn?.addEventListener("click", abrirSelecaoInicial);
	els.introTutorialBtn?.addEventListener("click", abrirTutorial);
	els.tutorialOpenBtn?.addEventListener("click", abrirTutorial);
	els.tutorialOverlay?.addEventListener("click", fecharTutorial);
	els.tutorialModal?.addEventListener("click", (e) => {
		if (e.target.closest("[data-tutorial-close]")) {
			fecharTutorial();
			return;
		}

		const botao = e.target.closest(".tutorial-modal__topic-btn");
		if (!botao) return;
		renderizarTopicoTutorial(botao.dataset.topicId);
	});
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && !els.tutorialModal?.classList.contains("is-hidden")) {
			fecharTutorial();
		}
	});
	els.bgmToggleBtn?.addEventListener("click", () => audio.toggleMute());
	els.bgmVolumeInput?.addEventListener("input",  (e) => audio.setVolume(e.target.value));
	els.bgmVolumeInput?.addEventListener("change", (e) => audio.setVolume(e.target.value));
	ui.adicionarLog("Configure os jogadores e clique em INICIAR BATALHA.");
})();
