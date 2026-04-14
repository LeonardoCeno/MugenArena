import { createUIController } from "./ui-status.js";
import { createAnimationController } from "./battle-animations.js";

const FUNDOS_ARENA = ["BEACH 2.png","BEACH NIGHT.png","BEACH.png","CAVE 2.png","CAVE NIGHT.png","CAVE.png","DESERT NIGHT.png","DESERT.png","LAKE NIGHT.png","LAKE.png","MOUNTAIN 2.png","MOUNTAIN NIGHT.png","MOUNTAIN.png","OCEAN NIGHT.png","OCEAN.png","PATH 2.png","PATH NIGHT.png","PATH.png","SNOW NIGHT.png","SNOW.png","TALL GRASS NIGHT.png","TALL GRASS.png","UNDERWATER.png"];
const MUSICAS_FUNDO = [
	"./assets/audiosdefundo/megalovania.mp3",
	"./assets/audiosdefundo/intheend.mp3",
	"./assets/audiosdefundo/numb.mp3",
	"./assets/audiosdefundo/HERO.mp3",
	"./assets/audiosdefundo/monsterskillet.mp3",
];
const NIVEL_VOLUME_BGM_PADRAO = 3;

(() => {
	const API_URL = "../backend/web_api.php";

	const state = {
		serverState: null,
		resolvendoAcao: false,
		actionPage: 0,
		anim: null,
		bgMusic: null,
		bgMusicVolumeLevel: NIVEL_VOLUME_BGM_PADRAO,
		bgMusicMuted: false,
		sprites: { p1: null, p2: null },
		frameScale: { p1: null, p2: null },
		domainImage: null,
		arenaFundo: null,
		acaoPendente: null, // { playerKey, acao } — guarda ação do 1º jogador até o turno resolver
	};

	const fighterPlayerEl = document.getElementById("fighter-player");
	const fighterEnemyEl  = document.getElementById("fighter-enemy");

	const els = {
		turnInfo:         document.getElementById("turn-info"),
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

	function obterVolumeBgm() {
		return Math.max(1, Math.min(10, state.bgMusicVolumeLevel)) / 10;
	}

	function aplicarVolumeNaMusicaAtual() {
		if (!state.bgMusic) return;
		state.bgMusic.volume = obterVolumeBgm();
	}

	function ajustarNivelVolumeBgm(valorCru) {
		const nivel = Number.parseInt(String(valorCru), 10);
		if (Number.isNaN(nivel)) {
			if (els.bgmVolumeInput) els.bgmVolumeInput.value = String(state.bgMusicVolumeLevel);
			return;
		}

		state.bgMusicVolumeLevel = Math.max(1, Math.min(10, nivel));
		if (els.bgmVolumeInput) {
			els.bgmVolumeInput.value = String(state.bgMusicVolumeLevel);
		}
		aplicarVolumeNaMusicaAtual();
	}

	function atualizarBotaoMusicaFundo() {
		if (!els.bgmToggleBtn) return;
		els.bgmToggleBtn.textContent = state.bgMusicMuted ? "MUSICA: OFF" : "MUSICA: ON";
		els.bgmToggleBtn.classList.toggle("is-muted", state.bgMusicMuted);
		els.bgmToggleBtn.setAttribute("aria-pressed", String(state.bgMusicMuted));
	}

	function aplicarMuteNaMusicaAtual() {
		if (!state.bgMusic) return;
		state.bgMusic.muted = state.bgMusicMuted;
	}

	function alternarMuteMusicaFundo() {
		state.bgMusicMuted = !state.bgMusicMuted;
		aplicarMuteNaMusicaAtual();
		atualizarBotaoMusicaFundo();
	}

	function pararMusicaFundo() {
		if (!state.bgMusic) return;
		state.bgMusic.pause();
		state.bgMusic.currentTime = 0;
		state.bgMusic = null;
	}

	function tocarMusicaFundoAleatoria() {
		pararMusicaFundo();
		const src = MUSICAS_FUNDO[Math.floor(Math.random() * MUSICAS_FUNDO.length)];
		const audio = new Audio(src);
		audio.loop = false;
		audio.volume = obterVolumeBgm();
		audio.currentTime = 0;
		audio.muted = state.bgMusicMuted;
		audio.addEventListener("play", () => {
			audio.volume = obterVolumeBgm();
		});
		audio.addEventListener("ended", tocarMusicaFundoAleatoria);
		audio.play().catch(() => {});
		state.bgMusic = audio;
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
				if (errorSplash) await animations.mostrarSplashErroInsano(errorSplash, 3000);
				resetarParaSetup();
				if (mensagem) ui.adicionarLog(mensagem);
				return;
			}

			// Turno ainda não resolvido — 1º jogador escolheu, aguarda o 2º
			if (!resposta.resolved) {
				state.acaoPendente = { playerKey: atacanteKey, acao };
				if (resposta.state) atualizarEstado(resposta.state, false);
				atualizarHUD();
				const proximo = resposta.state?.currentKey;
				const nomeProximo = proximo ? (proximo === "p1" ? "Jogador 1" : "Jogador 2") : "outro jogador";
				ui.adicionarLog(`Aguardando ${nomeProximo} escolher...`);
				return;
			}

			// Turno resolvido — toca as duas animações em ordem de execução
			const ordem    = resposta.resolucaoOrdem ?? [atacanteKey, oposto(atacanteKey)];
			const acoesMap = { [atacanteKey]: acao };
			if (state.acaoPendente) {
				acoesMap[state.acaoPendente.playerKey] = state.acaoPendente.acao;
			}
			state.acaoPendente = null;

			// Estados intermediário e final para aplicar dano em tempo real
			const estadoIntermediario = resposta.estadoIntermediario ?? null;
			const estadoFinal         = resposta.state ?? null;

			// Filtra apenas ataques que têm animação (ignora skip)
			const ordemAnimada = ordem.filter(k => acoesMap[k] && acoesMap[k].type !== "skip");

			for (let i = 0; i < ordemAnimada.length; i++) {
				const keyAtacante        = ordemAnimada[i];
				const acaoAtacante       = acoesMap[keyAtacante];
				const keyDefensor        = oposto(keyAtacante);
				const defensorDefendendo = acoesMap[keyDefensor]?.type === "defend";

				await tocarAnimacao(keyAtacante, acaoAtacante, keyDefensor, defensorDefendendo);

				// Aplica dano ao vivo após cada animação
				const isUltimo      = i === ordemAnimada.length - 1;
				const estadoAplicar = (!isUltimo && estadoIntermediario) ? estadoIntermediario : estadoFinal;
				if (estadoAplicar) {
					const estadoAntesDaAtualizacao = state.serverState;
					atualizarEstado(estadoAplicar, true);
					atualizarHUD();
					await verificarEAnimarTransformacao(estadoAntesDaAtualizacao, estadoAplicar);
				}

				// 1 segundo entre ataques
				if (!isUltimo) {
					await new Promise(r => setTimeout(r, 500));
				}
			}

			// Garante estado final aplicado caso nenhuma animação tenha tocado
			if (ordemAnimada.length === 0 && estadoFinal) {
				const estadoAntesDaAtualizacao = state.serverState;
				atualizarEstado(estadoFinal, true);
				await verificarEAnimarTransformacao(estadoAntesDaAtualizacao, estadoFinal);
			}

			if (mensagem) {
				ui.adicionarLog(mensagem);
				if (mensagem.includes("desviou!")) {
					for (const key of ["p1", "p2"]) {
						const nomeJogador = resposta.state?.[key]?.nome ?? state.serverState?.[key]?.nome ?? "";
						if (nomeJogador && mensagem.includes(`${nomeJogador} desviou`)) {
							animations.animarEsquiva(key);
						}
					}
				}
			}

			if (resposta.state?.winner) {
				await animations.animarMorte(oposto(resposta.state.winner));
			}

			atualizarHUD();
		} catch (erro) {
			state.acaoPendente = null;
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
		pararMusicaFundo();
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
			animations.cancelarAnimacao();
			tocarMusicaFundoAleatoria();
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
	ui = createUIController({ state, els, onActionSelected: processarAcao });
	ajustarNivelVolumeBgm(state.bgMusicVolumeLevel);
	atualizarBotaoMusicaFundo();

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
	els.bgmToggleBtn?.addEventListener("click", alternarMuteMusicaFundo);
	els.bgmVolumeInput?.addEventListener("input", (e) => ajustarNivelVolumeBgm(e.target.value));
	els.bgmVolumeInput?.addEventListener("change", (e) => ajustarNivelVolumeBgm(e.target.value));
	ui.adicionarLog("Configure os jogadores e clique em INICIAR BATALHA.");
})();
/**
 * @param {{ onBattleSetup?: () => void }} opts
 * @returns {Promise<void>}
 */
function startBlackHoleAnimation({ onBattleSetup } = {}) {
  return new Promise(resolve => {
    const overlay = document.getElementById('black-hole-overlay');
    const canvas  = document.getElementById('black-hole-canvas');
    if (!overlay || !canvas) { resolve(); return; }

    const W  = window.innerWidth;
    const H  = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const cx  = W / 2;
    const cy  = H / 2;
    const diagR = Math.hypot(cx, cy) + 40;

    const pts = Array.from({ length: 480 }, () => ({
      angle:    Math.random() * Math.PI * 2,
      orbMult:  1.1  + Math.random() * 2.8,
      speed:   (0.35 + Math.random() * 1.55) * (Math.random() < 0.5 ? 1 : -1),
      size:     0.5  + Math.random() * 3.2,
      hue:      200  + Math.random() * 40,
      bright:   58   + Math.random() * 42,
      alpha:    0.28 + Math.random() * 0.72,
    }));

    const topbar      = document.querySelector('.topbar');
    const setupScreen = document.querySelector('.setup-screen');
    const suckTargets = [topbar, setupScreen].filter(Boolean);

    suckTargets.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const dx   = cx - (rect.left + rect.width  / 2);
      const dy   = cy - (rect.top  + rect.height / 2);
      const dur  = 1.5 + i * 0.12;
      el.style.willChange = 'transform, opacity';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = `transform ${dur}s cubic-bezier(0.48,0,0.82,0.18), opacity ${dur - 0.12}s ease`;
        el.style.transform  = `translate(${dx}px,${dy}px) scale(0.01) rotate(1260deg)`;
        el.style.opacity    = '0';
      }));
    });

    const PHASE1 = 1800;
    const PHASE2 = 2200;

    let phase = 1;
    let t0    = null;
    let raf;
    let battleSetupDone = false;

    const easeInQuad  = t => t * t;
    const easeOut3    = t => 1 - Math.pow(1 - t, 3);
    const easeOut5    = t => 1 - Math.pow(1 - t, 5);

    function drawBlackHole(bhR, progress, time) {
      if (bhR > diagR * 0.55) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }

      const glowR = Math.min(bhR * 4.8, W * 1.6);
      const ng    = ctx.createRadialGradient(cx, cy, bhR * 0.5, cx, cy, glowR);
      ng.addColorStop(0,    `rgba(200,220,255,${0.72 * progress})`);
      ng.addColorStop(0.32, `rgba(100,150,200,${0.46 * progress})`);
      ng.addColorStop(0.68, `rgba(50,100,150,${0.22 * progress})`);
      ng.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, 0.27);
      const dIn  = bhR * 1.08;
      const dOut = bhR * 3.6;
      for (let r = dIn; r < dOut; r += 1.5) {
        const i   = 1 - (r - dIn) / (dOut - dIn);
        const hue = 200 + i * 40;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hue},100%,66%,${i * 0.27 * progress})`;
        ctx.lineWidth   = 1;
        ctx.stroke();
      }
      ctx.restore();

      const pProg = Math.min(1, progress * 2.5);
      pts.forEach(p => {
        const r = bhR * p.orbMult;
        const a = p.angle + time * p.speed * 0.00088;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r * 0.27;
        ctx.beginPath();
        ctx.arc(x, y, p.size * pProg, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},100%,${p.bright}%,${p.alpha * pProg})`;
        ctx.fill();
      });

      const pr = ctx.createRadialGradient(cx, cy, bhR * 0.84, cx, cy, bhR * 1.72);
      pr.addColorStop(0,    `rgba(255,250,250,${progress})`);
      pr.addColorStop(0.20, `rgba(255,250,250 ,${0.88 * progress})`);
      pr.addColorStop(0.60, `rgba(224,255,255,${0.40 * progress})`);
      pr.addColorStop(1,    'rgba(192,246,251)');
      ctx.fillStyle = pr;
      ctx.beginPath();
      ctx.arc(cx, cy, bhR * 1.72, 0, Math.PI * 2);
      ctx.fill();

      if (time - t0 < 1000 && t0 !== null) {
        const rt = (time - t0) / 1000;
        [0, 0.25, 0.55].forEach(offset => {
          const t2 = Math.max(0, rt - offset);
          if (t2 <= 0) return;
          const rr = t2 * 340;
          const ra = (1 - t2) * 0.65;
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(175,95,255,${ra})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      }

      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(cx, cy, bhR, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawReveal(openR, t) {
      const rimW    = (1 - easeOut3(t)) * 145 + 8;
      const rimAlpha = Math.max(0, 1 - t * 1.15);
      if (openR > 0 && rimAlpha > 0.01) {
        const blackG = ctx.createRadialGradient(cx, cy, 0, cx, cy, openR + rimW);
        blackG.addColorStop(0,   `rgba(0,0,0,${rimAlpha})`);
        blackG.addColorStop(0.7, `rgba(0,0,0,${rimAlpha * 0.2})`);
        blackG.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = blackG;
        ctx.beginPath();
        ctx.arc(cx, cy, openR + rimW, 0, Math.PI * 2);
        ctx.fill();

        const rg = ctx.createRadialGradient(cx, cy, Math.max(0, openR * 0.80), cx, cy, openR + rimW);
        rg.addColorStop(0,    `rgba(230,245,255,${rimAlpha})`);
        rg.addColorStop(0.22, `rgba(160,210,255,${rimAlpha * 0.85})`);
        rg.addColorStop(0.55, `rgba(80,140,220,${rimAlpha * 0.42})`);
        rg.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(cx, cy, openR + rimW, 0, Math.PI * 2);
        ctx.fill();
      }

      // destination-out torna o canvas transparente, revelando o DOM atrás do overlay
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, openR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    overlay.style.display = 'block';

    raf = requestAnimationFrame(function frame(ts) {
      if (!t0) t0 = ts;
      const elapsed = ts - t0;
      ctx.clearRect(0, 0, W, H);

      if (phase === 1) {
        const t   = Math.min(elapsed / PHASE1, 1);
        const bhR = 4 + easeInQuad(t) * (diagR - 4);
        drawBlackHole(bhR, Math.min(1, t * 2.2), ts);

        if (t >= 1) {
          phase = 2;
          t0    = ts;

          if (!battleSetupDone) {
            battleSetupDone = true;
            suckTargets.forEach(el => {
              el.style.transition = 'none';
              el.style.transform  = '';
              el.style.opacity    = '';
              el.style.willChange = '';
              requestAnimationFrame(() => requestAnimationFrame(() => {
                el.style.transition = '';
              }));
            });
            if (onBattleSetup) onBattleSetup();
          }
        }

      } else if (phase === 2) {
        const t     = Math.min(elapsed / PHASE2, 1);
        const openR = easeOut5(t) * (diagR + 60);
        drawReveal(openR, t);

        if (t >= 1) {
          cancelAnimationFrame(raf);
          overlay.style.display = 'none';
          resolve();
          return;
        }
      }

      raf = requestAnimationFrame(frame);
    });
  });
}
