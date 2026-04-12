import { createUIController } from "./ui-status.js";
import { createAnimationController } from "./battle-animations.js";

const FUNDOS_ARENA = ["BEACH 2.png","BEACH NIGHT.png","BEACH.png","CAVE 2.png","CAVE NIGHT.png","CAVE.png","DESERT NIGHT.png","DESERT.png","LAKE NIGHT.png","LAKE.png","MOUNTAIN 2.png","MOUNTAIN NIGHT.png","MOUNTAIN.png","OCEAN NIGHT.png","OCEAN.png","PATH 2.png","PATH NIGHT.png","PATH.png","SNOW NIGHT.png","SNOW.png","TALL GRASS NIGHT.png","TALL GRASS.png","UNDERWATER.png"];

(() => {
	const API_URL = "../backend/web_api.php";
// define URL do back e cria o objeto que guarda tudo
	const state = {
		serverState: null,
		resolvendoAcao: false,
		actionPage: 0,
		anim: null,
		sprites: { p1: null, p2: null },
		frameScale: { p1: null, p2: null },
		domainImage: null,
		arenaFundo: null,
	};
// pega todos os elementos html e guarda para usar
	const fighterPlayerEl = document.getElementById("fighter-player");
	const fighterEnemyEl = document.getElementById("fighter-enemy");

	const els = {
		turnInfo: document.getElementById("turn-info"),
		log: document.getElementById("battle-log"),
		combatFeed: document.getElementById("combat-feed"),
		skillPreview: document.getElementById("skill-preview"),
		skillPreviewTitle: document.getElementById("skill-preview-title"),
		skillPreviewText: document.getElementById("skill-preview-text"),
		menu: document.getElementById("action-menu"),
		arena: document.querySelector(".arena"),
		battleApp: document.querySelector(".battle-app"),
		setupPanel: document.getElementById("setup-panel"),
		battleView: document.getElementById("battle-view"),
		startBtn: document.getElementById("start-btn"),
		p1Name: document.getElementById("p1-name"),
		p2Name: document.getElementById("p2-name"),
		p1Class: document.getElementById("p1-class"),
		p2Class: document.getElementById("p2-class"),
		winnerOverlay: document.getElementById("winner-overlay"),
		winnerSprite: document.getElementById("winner-sprite"),
		winnerText: document.getElementById("winner-text"),
		playAgainBtn: document.getElementById("play-again-btn"),
		cards: {
			enemy: {
				root: document.getElementById("card-enemy"),
				name: document.getElementById("enemy-name"),
				tag: document.getElementById("enemy-tag"),
				hpText: document.getElementById("enemy-hp-text"),
				energyText: document.getElementById("enemy-energy-text"),
				hpBar: document.getElementById("enemy-hp-bar"),
				energyBar: document.getElementById("enemy-energy-bar"),
			},
			player: {
				root: document.getElementById("card-player"),
				name: document.getElementById("player-name"),
				tag: document.getElementById("player-tag"),
				hpText: document.getElementById("player-hp-text"),
				energyText: document.getElementById("player-energy-text"),
				hpBar: document.getElementById("player-hp-bar"),
				energyBar: document.getElementById("player-energy-bar"),
			},
		},
		fighters: {
			p1: {
				root: fighterPlayerEl,
				img: fighterPlayerEl?.querySelector(".fighter-img") || null,
				initial: fighterPlayerEl?.querySelector("span") || null,
			},
			p2: {
				root: fighterEnemyEl,
				img: fighterEnemyEl?.querySelector(".fighter-img") || null,
				initial: fighterEnemyEl?.querySelector("span") || null,
			},
		},
	};

	let ui = null;
	let animations = null;

	const atualizarHUD = () => {
		if (!ui || !animations) return;
		ui.atualizarHUD({
			renderFighter: animations.aplicarVisualPersonagem,
		});
	};
// envia dos dados pro mano back, verifica se deu erro ou nao e retorna
	async function chamarApi(action, payload = {}) {
		const response = await fetch(API_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action, ...payload }),
		});

		if (!response.ok) {
			let mensagemErro = `Falha na API (${response.status}).`;
			try {
				const corpoErro = await response.json();
				if (corpoErro && corpoErro.message) {
					mensagemErro = corpoErro.message;
				}
			} catch (_) {}
			throw new Error(mensagemErro);
		}

		return response.json();
	}

	function aplicarNovoEstado(novoEstado, mostrarDano = false) {
		const estadoAnterior = state.serverState;
		state.serverState = novoEstado;

		if (!mostrarDano || !estadoAnterior?.started || !novoEstado?.started) return;
		animations.aplicarFeedbackDeDano(estadoAnterior, novoEstado);
	}
// aqui que executa a animation
	async function processarAcaoComAnimacao(acao) {
		if (state.resolvendoAcao || !state.serverState?.started || state.serverState.winner) return;
//preparaçao pra animation
		ui.esconderPreviewSkill();
		state.resolvendoAcao = true;
		ui.setBotoesAcaoHabilitados(false);

		const atacanteKey = state.serverState.currentKey;
		const defensorKey = atacanteKey === "p1" ? "p2" : "p1";
		const defensorEstaDefendendo = state.serverState[defensorKey]?.defendendo === true;
		const errorSplash = state.serverState[atacanteKey]?.visual?.errorSplash ?? null;

		animations.cancelAnimation();
//envia pro back
		try {
			const resposta = await chamarApi("action", {
				actionType: acao.type,
				skillIndex: typeof acao.skillIndex === "number" ? acao.skillIndex : null,
			});

			const mensagem = resposta.message || "Ação executada.";

			if (resposta.state?.started === false) {
				if (errorSplash) await animations.mostrarSplashErroInsano(errorSplash, 3000);
				resetarParaSetup();
				ui.adicionarLog(mensagem);
				return;
			}

			const animacaoAtiva = animations.runTimeline(
				animations.buildAnimation(atacanteKey, acao, defensorKey, defensorEstaDefendendo)
			);
			state.anim = animacaoAtiva;

			await animations.wait(animacaoAtiva.duration);
			animations.cancelAnimation();

			if (resposta.state) {
				aplicarNovoEstado(resposta.state, true);
				if (mensagem.includes("desviou!") && acao.targetsOpponent) {
					animations.animarEsquiva(defensorKey);
				}
			}

			ui.adicionarLog(mensagem);
			atualizarHUD();
		} catch (erro) {
			animations.cancelAnimation();
			atualizarHUD();
			ui.adicionarLog(`Erro ao executar ação: ${erro.message || "falha desconhecida."}`);
		} finally {
			state.resolvendoAcao = false;
			state.actionPage = 0;
			ui.montarAcoes();
			ui.setBotoesAcaoHabilitados(true);
		}
	}

	function resetarParaSetup() {
		ui.resetarParaSetup(animations.cancelAnimation);
	}
//inicia a partida
	async function iniciar() {
  if (window.location.protocol === "file:") {
    ui.adicionarLog("Abra pelo servidor PHP: http://127.0.0.1:8080/batalha.html");
    return;
  }

  els.startBtn.disabled = true;
  try {
    const resposta = await chamarApi("start", {
      p1Name: els.p1Name.value.trim() || "Jogador 1",
      p1Class: els.p1Class.value,
      p2Name: els.p2Name.value.trim() || "Jogador 2",
      p2Class: els.p2Class.value,
    });

    if (!resposta.ok) {
      ui.adicionarLog(resposta.message || "Não foi possível iniciar a partida.");
      return;
    }

    aplicarNovoEstado(resposta.state, false);
    state.resolvendoAcao = false;
    state.actionPage = 0;
    animations.cancelAnimation();
    ui.esconderPreviewSkill();

    // ========== ANIMAÇÃO DO BURACO NEGRO ==========
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

    // Força reset visual caso a animação tenha sido iniciada parcialmente
    const overlay = document.getElementById('black-hole-overlay');
    if (overlay) overlay.style.display = 'none';
    ['.topbar', '.setup-screen'].forEach(sel => {
      const el = document.querySelector(sel);
      if (el) { el.style.transition = 'none'; el.style.transform = ''; el.style.opacity = ''; el.style.willChange = ''; }
    });
  } finally {
    els.startBtn.disabled = false;
  }
}
//cria os modulos principais passando dados que precisam
	animations = createAnimationController({ state, els, atualizarHUD });
	ui = createUIController({
		state,
		els,
		onActionSelected: processarAcaoComAnimacao,
	});
//pagina de seleçao de personagem
	function atualizarPreviewPersonagem(pickerDataFor, spriteUrl, label) {
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

	function construirSeletoresPersonagem(catalog) {
		document.querySelectorAll(".char-picker").forEach((picker) => {
			const defaultKey = document.getElementById(picker.dataset.for).value;
			picker.replaceChildren(
				...catalog.map((c) => {
					const btn = document.createElement("button");
					btn.type = "button";
					btn.className = "char-option" + (c.key === defaultKey ? " is-selected" : "");
					btn.dataset.value = c.key;
					btn.dataset.sprite = c.selectSprite ?? '';
					btn.dataset.label = c.label ?? '';
					const img = document.createElement("img");
					img.src = c.selectSprite;
					img.alt = c.label;
					const span = document.createElement("span");
					span.textContent = c.label;
					btn.append(img, span);
					return btn;
				})
			);
			// Set initial preview
			const selected = picker.querySelector(".char-option.is-selected");
			if (selected) atualizarPreviewPersonagem(picker.dataset.for, selected.dataset.sprite, selected.dataset.label);
		});
	}
//aqui ele pede a lista e constroi os botoes
	chamarApi("catalog")
		.then((data) => construirSeletoresPersonagem(data.catalog ?? []))
		.catch((erro) => ui.adicionarLog(`Erro ao carregar personagens: ${erro.message}`));

	els.setupPanel.addEventListener("click", (e) => {
		const opt = e.target.closest(".char-option");
		if (!opt) return;
		const picker = opt.closest(".char-picker");
		picker.querySelectorAll(".char-option").forEach((b) => b.classList.remove("is-selected"));
		opt.classList.add("is-selected");
		document.getElementById(picker.dataset.for).value = opt.dataset.value;
		atualizarPreviewPersonagem(picker.dataset.for, opt.dataset.sprite, opt.dataset.label);
	});

	els.startBtn.addEventListener("click", iniciar);
	els.playAgainBtn.addEventListener("click", resetarParaSetup);
	ui.adicionarLog("Configure os jogadores e clique em INICIAR BATALHA.");
})();
/**
 *
 * @param {{ onBattleSetup?: () => void }} opts
 * @returns {Promise<void>}
 */
function startBlackHoleAnimation({ onBattleSetup } = {}) {
  return new Promise(resolve => {
    const overlay = document.getElementById('black-hole-overlay');
    const canvas  = document.getElementById('black-hole-canvas');
    if (!overlay || !canvas) { resolve(); return; }

    // — Canvas setup —
    const W  = window.innerWidth;
    const H  = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const cx  = W / 2;
    const cy  = H / 2;
    const diagR = Math.hypot(cx, cy) + 40; // radius that covers full screen

    // — Accretion-disk particle system —
    const pts = Array.from({ length: 480 }, () => ({
      angle:    Math.random() * Math.PI * 2,
      orbMult:  1.1  + Math.random() * 2.8,   // orbit = bhRadius * orbMult
      speed:   (0.35 + Math.random() * 1.55) * (Math.random() < 0.5 ? 1 : -1),
      size:     0.5  + Math.random() * 3.2,
      hue:      200  + Math.random() * 40,
      bright:   58   + Math.random() * 42,
      alpha:    0.28 + Math.random() * 0.72,
    }));

    // — Suck-in targets —
    const topbar      = document.querySelector('.topbar');
    const setupScreen = document.querySelector('.setup-screen');
    const suckTargets = [topbar, setupScreen].filter(Boolean);

    suckTargets.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const dx   = cx - (rect.left + rect.width  / 2);
      const dy   = cy - (rect.top  + rect.height / 2);
      const dur  = 1.5 + i * 0.12;
      el.style.willChange = 'transform, opacity';
      // Double rAF so the browser paints the element before starting transition
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = `transform ${dur}s cubic-bezier(0.48,0,0.82,0.18), opacity ${dur - 0.12}s ease`;
        el.style.transform  = `translate(${dx}px,${dy}px) scale(0.01) rotate(1260deg)`;
        el.style.opacity    = '0';
      }));
    });

    // — Phase constants —
    const PHASE1 = 1800;  // black hole expands to cover screen
    const PHASE2 = 2200;  // portal opens, battle revealed

    let phase = 1;
    let t0    = null;
    let raf;
    let battleSetupDone = false;

    // — Easing helpers —
    const easeInQuad  = t => t * t;
    const easeOut3    = t => 1 - Math.pow(1 - t, 3);
    const easeOut5    = t => 1 - Math.pow(1 - t, 5);

    // ─── Draw helpers ────────────────────────────────────────────────────────

    function drawBlackHole(bhR, progress, time) {
      // Fill full screen once hole is large enough (avoids gaps at corners)
      if (bhR > diagR * 0.55) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }

      // Outer nebula / gravitational glow
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

      // Accretion disk rings (flattened to simulate tilted disk)
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

      // Orbital particles
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

      // Photon ring (bright thin halo just outside event horizon)
      const pr = ctx.createRadialGradient(cx, cy, bhR * 0.84, cx, cy, bhR * 1.72);
      pr.addColorStop(0,    `rgba(255,250,250,${progress})`);
      pr.addColorStop(0.20, `rgba(255,250,250 ,${0.88 * progress})`);
      pr.addColorStop(0.60, `rgba(224,255,255,${0.40 * progress})`);
      pr.addColorStop(1,    'rgba(192,246,251)');
      ctx.fillStyle = pr;
      ctx.beginPath();
      ctx.arc(cx, cy, bhR * 1.72, 0, Math.PI * 2);
      ctx.fill();

      // Gravitational-wave ripples (only at the very start)
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

      // Event horizon — solid black core
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(cx, cy, bhR, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawReveal(openR, t) {
      // Glowing iris rim that fades as portal expands
      const rimW    = (1 - easeOut3(t)) * 145 + 8;
      const rimAlpha = Math.max(0, 1 - t * 1.15);
      if (openR > 0 && rimAlpha > 0.01) {
        // Black gradient fading with the rim
        const blackG = ctx.createRadialGradient(cx, cy, 0, cx, cy, openR + rimW);
        blackG.addColorStop(0, `rgba(0,0,0,${rimAlpha})`);
        blackG.addColorStop(0.7, `rgba(0,0,0,${rimAlpha * 0.2})`);
        blackG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = blackG;
        ctx.beginPath();
        ctx.arc(cx, cy, openR + rimW, 0, Math.PI * 2);
        ctx.fill();

        // Blue glowing rim
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

      // Cut the portal hole (destination-out makes canvas transparent,
      // revealing whatever DOM element is rendered behind the overlay)
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, openR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    // ─── Animation loop ───────────────────────────────────────────────────────

    overlay.style.display = 'block';

    raf = requestAnimationFrame(function frame(ts) {
      if (!t0) t0 = ts;
      const elapsed = ts - t0;
      ctx.clearRect(0, 0, W, H);

      if (phase === 1) {
        const t   = Math.min(elapsed / PHASE1, 1);
        // Quadratic ease-in: starts visible immediately (offset 8px), then rapidly expands
        const bhR = 8 + easeInQuad(t) * (diagR - 8);
        drawBlackHole(bhR, Math.min(1, t * 2.2), ts);

        if (t >= 1) {
          phase = 2;
          t0    = ts;

          // — Battle setup happens here, while canvas fully covers the screen —
          if (!battleSetupDone) {
            battleSetupDone = true;
            // Reset suck targets instantly (canvas hides the jump)
            suckTargets.forEach(el => {
              el.style.transition = 'none';
              el.style.transform  = '';
              el.style.opacity    = '';
              el.style.willChange = '';
              // Re-enable transitions after browser processes the reset
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