const SPRITES_CORTES_DOMINIO_SUKUNA = [
	"./assets/sukuna/sprites/CORTE1.png",
	"./assets/sukuna/sprites/CORTE2.png",
	"./assets/sukuna/sprites/cortedomain1.png",
	"./assets/sukuna/sprites/cortedomain2.png",
];

export function createAnimationController({ state, els, atualizarHUD }) {

	// ── Helpers visuais ──────────────────────────────────────────────────

	function normalizarTipoFlutuante(tipo) {
		if (tipo === "bleed" || tipo === "burn" || tipo === "heal") return tipo;
		return "direct";
	}

	function obterFighterRootPorChave(chaveJogador) {
		return chaveJogador === "p1" ? els.fighters.p1.root : els.fighters.p2.root;
	}

	function atualizarClasseFlipDoFighter(fighterEl) {
		if (!fighterEl) return;
		fighterEl.classList.toggle("is-flipped", fighterEl.dataset.side === "player2");
	}

	function mostrarNumeroFlutuante(chaveJogador, valor, tipo = "direct", foiCritico = false) {
		if (valor <= 0) return;

		const fighter = obterFighterRootPorChave(chaveJogador);
		if (!fighter) return;

		const damageEl = document.createElement("div");
		const tipoNormalizado = normalizarTipoFlutuante(tipo);
		damageEl.className = `damage-float damage-${tipoNormalizado}`;
		if (foiCritico && tipoNormalizado !== "heal") {
			damageEl.classList.add("damage-float-critical");
		}
		damageEl.textContent = tipoNormalizado === "heal" ? `+${valor}` : `-${valor}`;
		fighter.appendChild(damageEl);

		requestAnimationFrame(() => damageEl.classList.add("show"));
		setTimeout(() => damageEl.remove(), 1250);
	}

	// ── Feedback de dano ─────────────────────────────────────────────────

	function aplicarFeedbackDeDano(estadoAnterior, novoEstado) {
		if (!estadoAnterior?.started || !novoEstado?.started) return;

		const danoP1 = Math.max(0, (estadoAnterior.p1?.vidaAtual ?? 0) - (novoEstado.p1?.vidaAtual ?? 0));
		const danoP2 = Math.max(0, (estadoAnterior.p2?.vidaAtual ?? 0) - (novoEstado.p2?.vidaAtual ?? 0));
		const curaP1 = Math.max(0, (novoEstado.p1?.vidaAtual ?? 0) - (estadoAnterior.p1?.vidaAtual ?? 0));
		const curaP2 = Math.max(0, (novoEstado.p2?.vidaAtual ?? 0) - (estadoAnterior.p2?.vidaAtual ?? 0));
		const tipoDanoP1 = novoEstado.p1?.ultimoTipoDano || "direct";
		const tipoDanoP2 = novoEstado.p2?.ultimoTipoDano || "direct";
		const mensagemAcao = (novoEstado?.message || "").toString();
		const teveCritico = mensagemAcao.includes("Acerto crítico!");
		const nomeP1 = (novoEstado?.p1?.nome || "").toString();
		const nomeP2 = (novoEstado?.p2?.nome || "").toString();

		let criticoP1 = false;
		let criticoP2 = false;

		if (teveCritico) {
			if (nomeP1 && mensagemAcao.includes(`em ${nomeP1}`) && danoP1 > 0) criticoP1 = true;
			if (nomeP2 && mensagemAcao.includes(`em ${nomeP2}`) && danoP2 > 0) criticoP2 = true;
			if (!criticoP1 && !criticoP2) {
				if (danoP1 > 0 && danoP2 <= 0) criticoP1 = true;
				else if (danoP2 > 0 && danoP1 <= 0) criticoP2 = true;
			}
		}

		mostrarNumeroFlutuante("p1", danoP1, tipoDanoP1, criticoP1);
		mostrarNumeroFlutuante("p2", danoP2, tipoDanoP2, criticoP2);
		mostrarNumeroFlutuante("p1", curaP1, "heal");
		mostrarNumeroFlutuante("p2", curaP2, "heal");
	}

	// ── Utilitários ──────────────────────────────────────────────────────

	function wait(ms) {
		if (ms <= 0) return Promise.resolve();
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	function mostrarSplashErroInsano(src, duracaoMs = 3000) {
		return new Promise((resolve) => {
			const overlay = document.createElement("div");
			overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center";

			const img = document.createElement("img");
			img.src = src;
			img.alt = "ERRO INSANO";
			img.style.cssText = "max-width:95vw;max-height:95vh;width:auto;height:auto";

			overlay.appendChild(img);
			document.body.appendChild(overlay);
			setTimeout(() => {
				overlay.remove();
				resolve();
			}, duracaoMs);
		});
	}

	// ── Timeline ─────────────────────────────────────────────────────────

	function runTimeline(events) {
		if (!events.length) return { duration: 0, cancel() {} };
		const handles = events.map(({ at, run }) => setTimeout(run, at));
		const duration = events.reduce((max, event) => Math.max(max, event.at), 0);
		return {
			duration,
			cancel() {
				handles.forEach(clearTimeout);
			},
		};
	}

	function cancelAnimation() {
		state.anim?.cancel();
		state.anim = null;
		state.sprites.p1 = null;
		state.sprites.p2 = null;
		state.domainImage = null;
		state.domainCutsActive = false;
		limparCortesDominioSukuna();
		els.arena
			?.querySelectorAll(".arena-action-overlay, .arena-energy-beam, .fighter-action-overlay")
			.forEach((el) => el.remove());
	}

	// ── Leitura de dados de animação ─────────────────────────────────────

	function obterFramesAnimacao(chaveJogador, caminho, nome) {
		const server = state.serverState;
		if (!server || !server[chaveJogador]) return [];

		const raiz = caminho === "actions"
			? server[chaveJogador].visual?.actions || {}
			: server[chaveJogador].visual?.reactions || {};

		const alvo = raiz[nome];
		const frames = Array.isArray(alvo?.frames) ? alvo.frames : [];
		return frames
			.filter((frame) => frame && typeof frame.sprite === "string" && frame.sprite.trim() !== "")
			.map((frame) => ({
				sprite: frame.sprite,
				durationMs: Number(frame.durationMs) > 0 ? Number(frame.durationMs) : 0,
				cssClass: frame.cssClass || null,
			}));
	}

	function obterFramesAnimacaoAcao(chaveJogador, nomeAcao) {
		return obterFramesAnimacao(chaveJogador, "actions", nomeAcao);
	}

	function obterFramesReacaoDefesa(chaveJogador) {
		return obterFramesAnimacao(chaveJogador, "reactions", "defendingHit");
	}

	function obterOverlaysAnimacaoAcao(chaveJogador, nomeAcao) {
		const server = state.serverState;
		if (!server || !server[chaveJogador]) return [];

		const actionConfig = server[chaveJogador].visual?.actions?.[nomeAcao];
		const overlays = Array.isArray(actionConfig?.overlays) ? actionConfig.overlays : [];

		return overlays
			.filter((overlay) => overlay && (overlay.mode === "beam" || overlay.sprite?.trim()))
			.map((overlay) => ({
				mode: overlay.mode ?? "attached",
				beamTone: overlay.beamTone ?? "normal",
				target: overlay.target ?? "opponent",
				sprite: overlay.sprite ?? "",
				startMs: overlay.startMs ?? 0,
				durationMs: overlay.durationMs ?? 0,
				x: overlay.x ?? 0,
				y: overlay.y ?? 0,
				scale: overlay.scale ?? 1,
				sizePx: overlay.sizePx ?? 260,
				frontOffsetPx: overlay.frontOffsetPx ?? 0,
				projectileAngleDeg: overlay.projectileAngleDeg ?? 0,
				thicknessPx: overlay.thicknessPx ?? 26,
				startOffsetX: overlay.startOffsetX ?? 0,
				startOffsetY: overlay.startOffsetY ?? 0,
				endOffsetX: overlay.endOffsetX ?? 0,
				endOffsetY: overlay.endOffsetY ?? 0,
			}));
	}

	// ── Construtores de eventos ──────────────────────────────────────────

	function buildFrameEvents(chaveJogador, frames) {
		if (!frames.length) return [];
		const events = [];
		let tempoAtual = 0;

		for (const frame of frames) {
			const sprite = frame.sprite;
			events.push({
				at: tempoAtual,
				run() {
					state.sprites[chaveJogador] = sprite;
					atualizarHUD();
				},
			});
			tempoAtual += frame.durationMs;
		}

		events.push({ at: tempoAtual, run() {} });
		return events;
	}

	function buildOverlayEvents(overlay, atacanteKey) {
		let el = null;
		return [
			{
				at: overlay.startMs,
				run() {
					el = criarOverlayEl(overlay, atacanteKey);
				},
			},
			{
				at: overlay.startMs + overlay.durationMs,
				run() {
					el?.remove();
					el = null;
				},
			},
		];
	}

	function buildDomainEvents(atacanteKey, nomeAcao) {
		const actionConfig = state.serverState?.[atacanteKey]?.visual?.actions?.[nomeAcao] ?? {};
		const domainImage = actionConfig.domainImage ?? null;
		if (!domainImage) return [];

		const delay = Number(actionConfig.domainDelayMs) > 0 ? Number(actionConfig.domainDelayMs) : 0;
		const cutsDelay = Number(actionConfig.domainCutsDelayMs) > 0 ? Number(actionConfig.domainCutsDelayMs) : null;
		const events = [
			{
				at: delay,
				run() {
					state.domainImage = domainImage;
					atualizarHUD();
				},
			},
		];

		if (cutsDelay !== null) {
			events.push({
				at: delay + cutsDelay,
				run() {
					state.domainCutsActive = true;
					atualizarHUD();
				},
			});
		}

		return events;
	}

	function buildAnimation(atacanteKey, acao, defensorKey, defensorEstaDefendendo) {
		const nomeAcao = acao.nomeSprite || acao.nome;
		const events = [];

		events.push(...buildFrameEvents(atacanteKey, obterFramesAnimacaoAcao(atacanteKey, nomeAcao)));

		if (acao.targetsOpponent && defensorEstaDefendendo) {
			events.push(...buildFrameEvents(defensorKey, obterFramesReacaoDefesa(defensorKey)));
		}

		for (const overlay of obterOverlaysAnimacaoAcao(atacanteKey, nomeAcao)) {
			events.push(...buildOverlayEvents(overlay, atacanteKey));
		}

		events.push(...buildDomainEvents(atacanteKey, nomeAcao));
		return events;
	}

	// ── Criação de elementos de overlay ─────────────────────────────────

	function calcularPosicoes(overlay, atacanteKey, origemEl, alvoEl, arenaRect) {
		const direcaoFrente = atacanteKey === "p1" ? 1 : -1;
		const escalaHorizontal = atacanteKey === "p2" ? -1 : 1;
		const anguloProjetil = atacanteKey === "p2" ? -overlay.projectileAngleDeg : overlay.projectileAngleDeg;
		const origemRect = origemEl.getBoundingClientRect();
		const alvoRect = alvoEl.getBoundingClientRect();
		const origemX = (origemRect.left + origemRect.width / 2) - arenaRect.left + direcaoFrente * overlay.frontOffsetPx + overlay.startOffsetX;
		const origemY = (origemRect.top + origemRect.height / 2) - arenaRect.top + overlay.startOffsetY;
		const alvoX = (alvoRect.left + alvoRect.width / 2) - arenaRect.left + overlay.endOffsetX;
		const alvoY = (alvoRect.top + alvoRect.height / 2) - arenaRect.top + overlay.endOffsetY;
		const deltaX = alvoX - origemX;
		const deltaY = alvoY - origemY;

		return {
			origemX,
			origemY,
			alvoX,
			alvoY,
			distancia: Math.sqrt(deltaX * deltaX + deltaY * deltaY),
			anguloAuto: Math.atan2(deltaY, deltaX) * (180 / Math.PI),
			anguloProjetil,
			escalaHorizontal,
		};
	}

	function criarBeamEl(overlay, pos) {
		const el = document.createElement("div");
		el.className = "arena-energy-beam";
		if (overlay.beamTone === "dark") el.classList.add("arena-energy-beam-dark");
		else if (overlay.beamTone === "pink") el.classList.add("arena-energy-beam-pink");
		el.setAttribute("aria-hidden", "true");
		el.style.cssText = `left:${pos.origemX}px;top:${pos.origemY}px;height:${overlay.thicknessPx}px;width:0px;transform:translate(0,-50%) rotate(${pos.anguloAuto}deg);transition:width ${overlay.durationMs}ms ease-out`;
		els.arena.appendChild(el);
		requestAnimationFrame(() => {
			el.style.width = `${pos.distancia}px`;
		});
		return el;
	}

	function criarProjectileEl(overlay, pos) {
		const el = document.createElement("img");
		el.className = "arena-action-overlay";
		el.src = overlay.sprite;
		el.alt = "";
		el.setAttribute("aria-hidden", "true");
		el.style.cssText = `width:${overlay.sizePx}px;left:${pos.origemX}px;top:${pos.origemY}px;transform:translate(-50%,-50%) scaleX(${pos.escalaHorizontal}) rotate(${pos.anguloProjetil}deg);transition:left ${overlay.durationMs}ms linear,top ${overlay.durationMs}ms linear`;
		els.arena.appendChild(el);
		requestAnimationFrame(() => {
			el.style.left = `${pos.alvoX}px`;
			el.style.top = `${pos.alvoY}px`;
		});
		return el;
	}

	function criarAttachedEl(overlay, alvoKey) {
		const fighter = els.fighters[alvoKey]?.root;
		if (!fighter) return null;
		const el = document.createElement("img");
		el.className = "fighter-action-overlay";
		el.src = overlay.sprite;
		el.alt = "";
		el.setAttribute("aria-hidden", "true");
		el.style.transform = `translate(${overlay.x}px,${overlay.y}px) scale(${overlay.scale})`;
		fighter.appendChild(el);
		return el;
	}

	function criarOverlayEl(overlay, atacanteKey) {
		const alvoKey = overlay.target === "self" ? atacanteKey : atacanteKey === "p1" ? "p2" : "p1";

		if (overlay.mode !== "beam" && overlay.mode !== "projectile") {
			return criarAttachedEl(overlay, alvoKey);
		}

		const arenaRect = els.arena?.getBoundingClientRect();
		const origemEl = els.fighters[atacanteKey]?.root;
		const alvoEl = els.fighters[alvoKey]?.root;
		if (!arenaRect || !origemEl || !alvoEl) return null;

		const pos = calcularPosicoes(overlay, atacanteKey, origemEl, alvoEl, arenaRect);
		if (overlay.mode === "beam") return criarBeamEl(overlay, pos);
		return criarProjectileEl(overlay, pos);
	}

	// ── Domain de Sukuna ─────────────────────────────────────────────────

	function obterLayerCortesDominio() {
		if (!els.arena) return null;
		let layer = els.arena.querySelector(".domain-cuts-layer");
		if (!layer) {
			layer = document.createElement("div");
			layer.className = "domain-cuts-layer";
			els.arena.appendChild(layer);
		}
		return layer;
	}

	function limparCortesDominioSukuna() {
		state.domainCutsTimeouts.forEach((id) => clearTimeout(id));
		state.domainCutsTimeouts = [];

		if (state.domainCutsIntervalId !== null) {
			clearInterval(state.domainCutsIntervalId);
			state.domainCutsIntervalId = null;
		}

		const layer = els.arena?.querySelector(".domain-cuts-layer");
		if (layer) layer.innerHTML = "";
	}

	function atualizarEfeitoCortesDominioSukuna(ativo) {
		if (!ativo) {
			limparCortesDominioSukuna();
			return;
		}
		if (state.domainCutsIntervalId !== null) return;

		criarCorteAleatorioDominioSukuna();
		state.domainCutsIntervalId = setInterval(() => {
			const quantidade = 1 + Math.floor(Math.random() * 2);
			for (let i = 0; i < quantidade; i++) criarCorteAleatorioDominioSukuna();
		}, 30);
	}

	// ── Renderização de personagens ──────────────────────────────────────

	function aplicarVisualPersonagem(chaveJogador, personagem, fighterRefs) {
		if (!fighterRefs?.root || !fighterRefs.img) return;

		const spriteTemporario = state.sprites[chaveJogador];
		const nomeClasse = personagem?.classe || "";
		const spriteBase = personagem?.visual?.baseSprite || null;
		const fighterEl = fighterRefs.root;
		const img = fighterRefs.img;
		const initial = fighterRefs.initial;

		fighterEl.classList.remove("has-image", "is-flipped", "action-casting", "true-cero-sized", "true-cero-plus-sized", "ubuntu-base-smaller");
		img.removeAttribute("src");

		if (spriteTemporario) {
			img.src = spriteTemporario;
			fighterEl.classList.add("has-image", "action-casting");
			atualizarClasseFlipDoFighter(fighterEl);
			img.onerror = () => fighterEl.classList.remove("has-image", "is-flipped", "action-casting");
			if (initial) initial.textContent = (nomeClasse || "?").trim().charAt(0).toUpperCase() || "?";
			return;
		}

		if (spriteBase) {
			img.src = spriteBase;
			fighterEl.classList.add("has-image");
			if (nomeClasse.toLowerCase() === "ubuntu") fighterEl.classList.add("ubuntu-base-smaller");
			atualizarClasseFlipDoFighter(fighterEl);
		}

		img.onerror = () => fighterEl.classList.remove("has-image", "is-flipped");
		if (initial) initial.textContent = (personagem?.classeNome || "?").trim().charAt(0).toUpperCase() || "?";
	}

	function animarEsquiva(chaveJogador) {
		const fighter = obterFighterRootPorChave(chaveJogador);
		if (!fighter) return;

		const dodgeSprite = state.serverState?.[chaveJogador]?.visual?.dodgeSprite ?? null;
		const spriteAnterior = state.sprites[chaveJogador];

		if (dodgeSprite) {
			state.sprites[chaveJogador] = dodgeSprite;
			atualizarHUD();
		}

		fighter.classList.remove("dodge-anim");
		void fighter.offsetWidth;
		fighter.classList.add("dodge-anim");

		setTimeout(() => {
			fighter.classList.remove("dodge-anim");
			if (dodgeSprite && state.sprites[chaveJogador] === dodgeSprite) {
				state.sprites[chaveJogador] = spriteAnterior;
				atualizarHUD();
			}
		}, 1200);
	}

	return {
		aplicarFeedbackDeDano,
		wait,
		mostrarSplashErroInsano,
		runTimeline,
		cancelAnimation,
		buildAnimation,
		atualizarEfeitoCortesDominioSukuna,
		aplicarVisualPersonagem,
		animarEsquiva,
	};
}
