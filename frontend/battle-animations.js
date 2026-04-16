
const TIPOS_FLUTUANTES = new Set(["bleed", "burn", "heal"]);

const STATUS_EFFECT_VISUALS = {
	bleed: { gif: "./assets/efeitos/bleed.gif",    cssClass: "bleed-effect-overlay" },
	burn:  { gif: "./assets/efeitos/burnburn.gif", cssClass: "burn-effect-overlay"  },
};

export function createAnimationController({ state, els, atualizarHUD }) {

	let meleeAttackerKey = null;

	// ── Helpers visuais ──────────────────────────────────────────────────

	function flipFighter(fighterEl) {
		if (!fighterEl) return;
		fighterEl.classList.toggle("is-flipped", fighterEl.dataset.side === "player2");
	}

	function mostrarEfeito(fighter, gifSrc, cssClass) {
		const el = document.createElement("img");
		el.src = gifSrc;
		el.alt = "";
		el.setAttribute("aria-hidden", "true");
		el.className = cssClass;
		fighter.appendChild(el);
		setTimeout(() => el.remove(), 2000);
	}

	function numFlutuante(chave, valor, tipo = "direct", foiCritico = false) {
		if (valor <= 0) return;
		const fighter = els.fighters[chave]?.root;
		if (!fighter) return;

		const t = TIPOS_FLUTUANTES.has(tipo) ? tipo : "direct";
		const el = document.createElement("div");
		el.className = `damage-float damage-${t}`;
		if (foiCritico && t !== "heal") el.classList.add("damage-float-critical");
		el.textContent = t === "heal" ? `+${valor}` : `-${valor}`;
		fighter.appendChild(el);

		const visual = STATUS_EFFECT_VISUALS[t];
		if (visual) mostrarEfeito(fighter, visual.gif, visual.cssClass);

		requestAnimationFrame(() => el.classList.add("show"));
		setTimeout(() => el.remove(), 1250);
	}

	function textoFlutuante(chave, texto, tipo = "direct") {
		if (!texto) return;
		const fighter = els.fighters[chave]?.root;
		if (!fighter) return;

		const t = TIPOS_FLUTUANTES.has(tipo) ? tipo : "direct";
		const el = document.createElement("div");
		el.className = `damage-float damage-${t} sprite-float-text`;
		el.textContent = texto;
		fighter.appendChild(el);

		requestAnimationFrame(() => el.classList.add("show"));
		setTimeout(() => el.remove(), 1250);
	}

	// ── Feedback de dano ─────────────────────────────────────────────────

	function feedbackDano(anterior, novo) {
		if (!anterior?.started || !novo?.started) return;

		const danoP1 = Math.max(0, (anterior.p1?.vidaAtual ?? 0) - (novo.p1?.vidaAtual ?? 0));
		const danoP2 = Math.max(0, (anterior.p2?.vidaAtual ?? 0) - (novo.p2?.vidaAtual ?? 0));
		const curaP1 = Math.max(0, (novo.p1?.vidaAtual ?? 0) - (anterior.p1?.vidaAtual ?? 0));
		const curaP2 = Math.max(0, (novo.p2?.vidaAtual ?? 0) - (anterior.p2?.vidaAtual ?? 0));
		const tipoDanoP1 = novo.p1?.ultimoTipoDano || "direct";
		const tipoDanoP2 = novo.p2?.ultimoTipoDano || "direct";
		const msg = String(novo?.message || "");
		const teveCritico = msg.includes("Acerto crítico!");
		const nomeP1 = String(novo?.p1?.nome || "");
		const nomeP2 = String(novo?.p2?.nome || "");
		let criticoP1 = false, criticoP2 = false;

		if (teveCritico) {
			if (nomeP1 && msg.includes(`em ${nomeP1}`) && danoP1 > 0) criticoP1 = true;
			if (nomeP2 && msg.includes(`em ${nomeP2}`) && danoP2 > 0) criticoP2 = true;
			if (!criticoP1 && !criticoP2) {
				if (danoP1 > 0 && danoP2 <= 0) criticoP1 = true;
				else if (danoP2 > 0 && danoP1 <= 0) criticoP2 = true;
			}
		}

		numFlutuante("p1", danoP1, tipoDanoP1, criticoP1);
		numFlutuante("p2", danoP2, tipoDanoP2, criticoP2);
		numFlutuante("p1", curaP1, "heal");
		numFlutuante("p2", curaP2, "heal");
	}

	// ── Utilitários ──────────────────────────────────────────────────────

	function wait(ms) {
		if (ms <= 0) return Promise.resolve();
		return new Promise(r => setTimeout(r, ms));
	}

	function mostrarSplashErroInsano(src, duracaoMs = 3000) {
		return new Promise(resolve => {
			const overlay = document.createElement("div");
			overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center";
			const img = document.createElement("img");
			img.src = src;
			img.alt = "ERRO INSANO";
			img.style.cssText = "max-width:95vw;max-height:95vh;width:auto;height:auto";
			overlay.appendChild(img);
			document.body.appendChild(overlay);
			setTimeout(() => { overlay.remove(); resolve(); }, duracaoMs);
		});
	}

	// ── Timeline ─────────────────────────────────────────────────────────

	function rodarTimeline(events) {
		if (!events.length) return { duration: 0, cancel() {} };
		const handles = events.map(({ at, run }) => setTimeout(run, at));
		const duration = events.reduce((max, e) => Math.max(max, e.at), 0);
		return {
			duration,
			cancel() { handles.forEach(clearTimeout); },
		};
	}

	function cancelarAnimacao() {
		state.anim?.cancel();
		state.anim = null;
		state.sprites.p1 = null;
		state.sprites.p2 = null;
		state.frameScale.p1 = null;
		state.frameScale.p2 = null;
		state.domainImage = null;
		state.domainImageVersion = 0;
		els.arena
			?.querySelectorAll(".arena-action-overlay, .arena-energy-beam, .fighter-action-overlay, .domain-clash-ring, .domain-clash-split, .domain-clash-blackout, .domain-break-background")
			.forEach(el => el.remove());
		document.querySelectorAll(".char-transform-overlay").forEach(el => el.remove());
		for (const chave of ["p1", "p2"]) {
			els.fighters[chave]?.root?.classList.remove("char-transforming", "char-transformed");
		}
		if (meleeAttackerKey) resetMelee(meleeAttackerKey);
	}

	// ── Leitura de config de animação ────────────────────────────────────

	function framesDeConfig(config) {
		let frames = Array.isArray(config?.frames) ? config.frames : [];
		const repeat = Number(config?.repeatFrames);
		if (repeat > 1) {
			const base = [...frames];
			frames = Array.from({ length: repeat }, () => base).flat();
		}
		return frames
			.filter(f => f && typeof f.sprite === "string" && f.sprite.trim() !== "")
			.map(f => ({
				sprite: f.sprite,
				durationMs: Number(f.durationMs) > 0 ? Number(f.durationMs) : 0,
				cssClass: f.cssClass || null,
				scale: f.scale ?? null,
			}));
	}

	function obterPrimeiroFrameDaAcao(chave, acao) {
		const nomeAcao = acao?.nomeSprite || acao?.nome;
		if (!nomeAcao) return null;

		const actionConfig = state.serverState?.[chave]?.visual?.actions?.[nomeAcao] ?? {};
		const frames = framesDeConfig(actionConfig);
		return frames[0] ?? null;
	}

	function overlaysDeConfig(config) {
		let overlays = Array.isArray(config?.overlays) ? config.overlays : [];
		const repeat = Number(config?.repeatOverlays);

		if (repeat > 1 && overlays.length > 0) {
			const base = [...overlays];
			const startDelay = Number(config?.repeatOverlaysStartMs ?? 0);
			let minStart = Infinity, maxEnd = -Infinity;
			for (const o of base) {
				const s = o.startMs ?? 0;
				const e = s + (o.durationMs ?? 0);
				if (s < minStart) minStart = s;
				if (e > maxEnd) maxEnd = e;
			}
			const cycleDuration = maxEnd - minStart;
			overlays = Array.from({ length: repeat }, (_, i) =>
				base.map(o => ({ ...o, startMs: startDelay + ((o.startMs ?? 0) - minStart) + i * cycleDuration }))
			).flat();
		}

		return overlays
			.filter(o => o && (o.mode === "beam" || o.sprite?.trim()))
			.map(o => ({
				mode: o.mode ?? "attached",
				beamTone: o.beamTone ?? "normal",
				target: o.target ?? "opponent",
				sprite: o.sprite ?? "",
				startMs: o.startMs ?? 0,
				durationMs: o.durationMs ?? 0,
				x: o.x ?? 0,
				y: o.y ?? 0,
				scale: o.scale ?? 1,
				sizePx: o.sizePx ?? 260,
				frontOffsetPx: o.frontOffsetPx ?? 0,
				projectileAngleDeg: o.projectileAngleDeg ?? 0,
				thicknessPx: o.thicknessPx ?? 26,
				startOffsetX: o.startOffsetX ?? 0,
				startOffsetY: o.startOffsetY ?? 0,
				endOffsetX: o.endOffsetX ?? 0,
				endOffsetY: o.endOffsetY ?? 0,
			}));
	}

	// ── Construtores de eventos ──────────────────────────────────────────

	function eventosFrames(chave, frames) {
		if (!frames.length) return { events: [], duration: 0 };
		const events = [];
		let t = 0;

		for (const frame of frames) {
			const sprite = frame.sprite;
			const scale  = frame.scale ?? null;
			events.push({
				at: t,
				run() {
					state.sprites[chave]    = sprite;
					state.frameScale[chave] = scale;
					atualizarHUD();
				},
			});
			t += frame.durationMs;
		}

		events.push({ at: t, run() {} });

		return { events, duration: t };
	}

	function eventosOverlay(overlay, atacanteKey, minEndMs = 0) {
		let el = null;
		const endAt = Math.max(overlay.startMs + overlay.durationMs, minEndMs);
		return [
			{
				at: overlay.startMs,
				run() { el = criarOverlay(overlay, atacanteKey); },
			},
			{
				at: endAt,
				run() { el?.remove(); el = null; },
			},
		];
	}

	function eventosDomain(config) {
		const domainImage = config?.domainImage ?? null;
		if (!domainImage) return [];
		const delay = Number(config?.domainDelayMs) > 0 ? Number(config.domainDelayMs) : 0;
		return [{
			at: delay,
			run() {
				state.domainImageVersion += 1;
				state.domainImage = domainImage;
				atualizarHUD();
			},
		}];
	}

	function listaAudio(config, campo = "audio") {
		const valor = config?.[campo];
		if (Array.isArray(valor)) return valor;
		if (valor?.file) return [valor];
		return [];
	}

	function volumePorNivel(volumeLevel, fallbackVolume = 1) {
		const nivel = Number.parseInt(String(volumeLevel), 10);
		if (Number.isNaN(nivel)) return fallbackVolume;
		return Math.max(1, Math.min(10, nivel)) / 10;
	}

	function eventosAudio(config, campo = "audio", offsetMs = 0) {
		const audios = listaAudio(config, campo);
		return audios
			.filter(a => a?.file)
			.map(a => {
				const file      = a.file;
				const startMs   = offsetMs + (a.startMs ?? 0);
				const durationMs = a.durationMs ?? null;
				const volume = volumePorNivel(a.volumeLevel, 1);
				return {
					at: startMs,
					run() {
						const audio = new Audio(file);
						audio.volume = volume;
						audio.currentTime = 0;
						audio.play().catch(() => {});
						if (durationMs != null) {
							setTimeout(() => { audio.pause(); audio.currentTime = 0; }, durationMs);
						}
					},
				};
			});
	}

	// ── Melee dash ───────────────────────────────────────────────────────

	// Ajuste fino de altura por atacante (px positivo = mais para baixo)
	const MELEE_Y_OFFSET = { p1: 0, p2: 0 };
	// Distância horizontal do inimigo (px positivo = mais afastado)
	const MELEE_X_GAP    = { p1: -30, p2: -5 };

	function offsetMelee(atacanteKey, defensorKey) {
		const atacanteEl = els.fighters[atacanteKey]?.root;
		const defensorEl = els.fighters[defensorKey]?.root;
		if (!atacanteEl || !defensorEl) return null;

		const aRect = atacanteEl.getBoundingClientRect();
		const dRect = defensorEl.getBoundingClientRect();
		const aCx = aRect.left + aRect.width  / 2;
		const dCx = dRect.left + dRect.width  / 2;
		const direcao = aCx < dCx ? 1 : -1;

		const offsetX = (dCx - aCx) - direcao * (aRect.width / 2 + MELEE_X_GAP[atacanteKey]);
		// Compensação de transform-origin: center bottom ao mudar de scale
		const scaleRatio = dRect.height / aRect.height;
		const compY = (aRect.height / 2) * (1 - scaleRatio);
		const offsetY = ((dRect.top + dRect.height / 2) - (aRect.top + aRect.height / 2)) - compY + MELEE_Y_OFFSET[atacanteKey];

		return { offsetX, offsetY, dRect };
	}

	function aplicarMelee(atacanteKey, defensorKey) {
		const atacanteEl = els.fighters[atacanteKey]?.root;
		const defensorEl = els.fighters[defensorKey]?.root;
		if (!atacanteEl || !defensorEl) return;

		const result = offsetMelee(atacanteKey, defensorKey);
		if (!result) return;

		// dRect já lido em offsetMelee — reutilizamos para evitar terceiro getBoundingClientRect
		const defensorScale = result.dRect.width / (defensorEl.offsetWidth || 1);
		meleeAttackerKey = atacanteKey;
		atacanteEl.style.transition = "none";
		atacanteEl.style.setProperty("--melee-offset-x", `${result.offsetX}px`);
		atacanteEl.style.setProperty("--melee-offset-y", `${result.offsetY}px`);
		atacanteEl.style.setProperty("--melee-scale", defensorScale);
		atacanteEl.style.zIndex = "10";
	}

	function resetMelee(chave) {
		const el = els.fighters[chave]?.root;
		if (!el) return;
		el.style.transition = "none";
		el.style.removeProperty("--melee-offset-x");
		el.style.removeProperty("--melee-offset-y");
		el.style.removeProperty("--melee-scale");
		el.style.removeProperty("z-index");
		el.classList.remove("melee-dashing");
		meleeAttackerKey = null;
	}

	function eventosMelee(atacanteKey, defensorKey, frameDuration) {
		return [
			{ at: 0,             run() { aplicarMelee(atacanteKey, defensorKey); } },
			{ at: frameDuration, run() { resetMelee(atacanteKey); } },
		];
	}

	// ── Montagem de animação ─────────────────────────────────────────────

	function montarAnimacao(atacanteKey, acao, defensorKey, defensorEstaDefendendo) {
		const nomeAcao     = acao.nomeSprite || acao.nome;
		const actionConfig = state.serverState?.[atacanteKey]?.visual?.actions?.[nomeAcao] ?? {};
		const events       = [];

		const { events: frameEvts, duration: frameDuration } = eventosFrames(atacanteKey, framesDeConfig(actionConfig));
		events.push(...frameEvts);

		if (acao.targetsOpponent && defensorEstaDefendendo) {
			const defConfig = state.serverState?.[defensorKey]?.visual?.reactions?.["defendingHit"] ?? {};
			events.push(...eventosFrames(defensorKey, framesDeConfig(defConfig)).events);
		}

		for (const overlay of overlaysDeConfig(actionConfig)) {
			const minEndMs = overlay.mode === "beam" ? frameDuration : 0;
			events.push(...eventosOverlay(overlay, atacanteKey, minEndMs));
		}

		events.push(...eventosDomain(actionConfig));
		events.push(...eventosAudio(actionConfig, "domainAudio", Number(actionConfig?.domainDelayMs) > 0 ? Number(actionConfig.domainDelayMs) : 0));
		events.push(...eventosAudio(actionConfig));

		if (acao.melee) {
			events.push(...eventosMelee(atacanteKey, defensorKey, frameDuration));
		}

		return events;
	}

	function montarAnimacaoClash(atacanteKey, acao, defensorKey) {
		const nomeAcao     = acao.nomeSprite || acao.nome;
		const actionConfig = state.serverState?.[atacanteKey]?.visual?.actions?.[nomeAcao] ?? {};

		const allOverlays   = overlaysDeConfig(actionConfig);
		const projectileOverlays = allOverlays.filter(o => o.mode === "projectile");
		const otherOverlays = allOverlays.filter(o => o.mode !== "projectile");
		const primaryProjectileOverlay = projectileOverlays[0] ?? null;
		const projectileStartMs = primaryProjectileOverlay?.startMs ?? 0;

		const { events: frameEvts } = eventosFrames(atacanteKey, framesDeConfig(actionConfig));

		const projArrivalMs = projectileOverlays.length > 0
			? Math.max(...projectileOverlays.map(overlay => overlay.startMs + overlay.durationMs))
			: 0;

		const allAudio = eventosAudio(actionConfig);
		const preAudio  = allAudio.filter(e => e.at < projectileStartMs);
		const launchAudio = allAudio.filter(e => e.at >= projectileStartMs && e.at < projArrivalMs);
		const postAudio = allAudio.filter(e => e.at >= projArrivalMs)
			.map(e => ({ ...e, at: e.at - projArrivalMs }));

		const allOtherOverlayEvts = otherOverlays.flatMap(o => eventosOverlay(o, atacanteKey));
		const preOverlayEvts = allOtherOverlayEvts.filter(e => e.at < projectileStartMs);
		const launchOverlayEvts = allOtherOverlayEvts.filter(e => e.at >= projectileStartMs && e.at < projArrivalMs);
		const postOverlayEvts = allOtherOverlayEvts
			.filter(e => e.at >= projArrivalMs)
			.map(e => ({ ...e, at: e.at - projArrivalMs }));

		let projectileRef = null;
		const projectileRefs = [];
		const projectileCreationEvents = projectileOverlays.map((overlay, index) => ({
			at: overlay.startMs,
			run() {
				const arenaRect = els.arena?.getBoundingClientRect();
				const origemEl  = els.fighters[atacanteKey]?.root;
				const alvoEl    = els.fighters[defensorKey]?.root;
				if (!arenaRect || !origemEl || !alvoEl) return;
				const pos = posicoes(overlay, atacanteKey, origemEl, alvoEl, arenaRect);
				const ref = criarProjetil(overlay, pos, atacanteKey);
				ref.animation.onfinish = null; // clash system manages removal
				projectileRefs.push(ref);
				if (index === 0) projectileRef = ref;
			},
		}));

		const preLaunchEvents = [
			...frameEvts.filter(e => e.at < projectileStartMs),
			...preAudio,
			...preOverlayEvts,
		];

		const launchEvents = [
			...frameEvts.filter(e => e.at >= projectileStartMs && e.at < projArrivalMs),
			...launchAudio,
			...launchOverlayEvts,
			...projectileCreationEvents,
		];

		const postEvents = [...postAudio, ...postOverlayEvts];

		return {
			preLaunchEvents,
			launchEvents,
			postEvents,
			projectileStartMs,
			getProjectileRef: () => projectileRef,
			getProjectileRefs: () => projectileRefs,
		};
	}

	function montarAnimacaoDomainClash(atacanteKey, acao, defensorKey, options = {}) {
		const nomeAcao     = acao.nomeSprite || acao.nome;
		const actionConfig = state.serverState?.[atacanteKey]?.visual?.actions?.[nomeAcao] ?? {};
		const domainExpandMs = Number(actionConfig?.domainDelayMs) > 0 ? Number(actionConfig.domainDelayMs) : 0;
		const domainImage = actionConfig?.domainImage ?? null;

		const { events: frameEvts } = eventosFrames(atacanteKey, framesDeConfig(actionConfig));
		const overlayEvts = overlaysDeConfig(actionConfig).flatMap(overlay => eventosOverlay(overlay, atacanteKey));
		const audioEvts = eventosAudio(actionConfig);
		const domainAudioEvts = eventosAudio(actionConfig, "domainAudio");

		const preExpandEvents = [
			...frameEvts.filter(event => event.at < domainExpandMs),
			...audioEvts.filter(event => event.at < domainExpandMs),
		];

		const winnerDeferredEvents = [
			...overlayEvts,
			...domainAudioEvts,
			...audioEvts.filter(event => event.at >= domainExpandMs),
			...frameEvts.filter(event => event.at >= domainExpandMs),
		].map(event => ({
			...event,
			at: event.at >= domainExpandMs ? event.at - domainExpandMs : event.at,
		}));

		return {
			preExpandEvents,
			winnerDeferredEvents,
			domainExpandMs,
			domainImage,
		};
	}

	// ── Criação de elementos de overlay ─────────────────────────────────

	function escala(px, arenaW) {
		return px * ((arenaW ?? els.arena?.getBoundingClientRect().width ?? 1000) / 1000);
	}

	function posicoes(overlay, atacanteKey, origemEl, alvoEl, arenaRect) {
		const direcaoFrente    = atacanteKey === "p1" ? 1 : -1;
		const escalaHorizontal = atacanteKey === "p2" ? -1 : 1;
		const anguloProjetil   = atacanteKey === "p2" ? -overlay.projectileAngleDeg : overlay.projectileAngleDeg;
		const arenaW           = arenaRect.width;
		const origemRect       = origemEl.getBoundingClientRect();
		const alvoRect         = alvoEl.getBoundingClientRect();

		const origemX = (origemRect.left + origemRect.width  / 2) - arenaRect.left
			+ direcaoFrente * escala(overlay.frontOffsetPx, arenaW)
			+ direcaoFrente * escala(overlay.startOffsetX, arenaW);
		const origemY = (origemRect.top  + origemRect.height / 2) - arenaRect.top
			+ escala(overlay.startOffsetY, arenaW);
		const alvoX = (alvoRect.left + alvoRect.width  / 2) - arenaRect.left + escala(overlay.endOffsetX, arenaW);
		const alvoY = (alvoRect.top  + alvoRect.height / 2) - arenaRect.top  + escala(overlay.endOffsetY, arenaW);
		const deltaX = alvoX - origemX;
		const deltaY = alvoY - origemY;

		return {
			origemX, origemY, alvoX, alvoY,
			distancia:        Math.sqrt(deltaX * deltaX + deltaY * deltaY),
			anguloAuto:       Math.atan2(deltaY, deltaX) * (180 / Math.PI),
			anguloProjetil,
			escalaHorizontal,
			arenaW,
		};
	}

	function criarBeam(overlay, pos) {
		const el = document.createElement("div");
		el.className = "arena-energy-beam";
		if (overlay.beamTone === "dark")       el.classList.add("arena-energy-beam-dark");
		else if (overlay.beamTone === "pink")  el.classList.add("arena-energy-beam-pink");
		el.setAttribute("aria-hidden", "true");
		const arenaRect = els.arena?.getBoundingClientRect();
		const arenaW = arenaRect?.width ?? pos.arenaW;
		const arenaH = arenaRect?.height ?? 0;
		const angleRad = (pos.anguloAuto * Math.PI) / 180;
		const dirX = Math.cos(angleRad);
		const dirY = Math.sin(angleRad);
		const edgeDistances = [];

		if (Math.abs(dirX) > 1e-6) {
			const tX = dirX > 0 ? (arenaW - pos.origemX) / dirX : (0 - pos.origemX) / dirX;
			if (tX > 0) edgeDistances.push(tX);
		}

		if (Math.abs(dirY) > 1e-6 && arenaH > 0) {
			const tY = dirY > 0 ? (arenaH - pos.origemY) / dirY : (0 - pos.origemY) / dirY;
			if (tY > 0) edgeDistances.push(tY);
		}

		const edgeReach = edgeDistances.length ? Math.min(...edgeDistances) : pos.distancia;
		const beamEndPadding = escala(overlay.beamEndPaddingPx ?? 60, pos.arenaW);
		const overshoot = Math.max(1, overlay.beamOvershoot ?? 1.35);
		const beamWidth = Math.max(pos.distancia * overshoot, edgeReach + beamEndPadding);
		const baseBeamHeight = escala(overlay.thicknessPx, pos.arenaW);
		const targetEndCoverage = Math.max(0, Math.min(1, overlay.beamEndScreenCoverage ?? 0.3));
		const minBeamHeightForTipCoverage = arenaH > 0 ? (arenaH * targetEndCoverage) / 2 : baseBeamHeight;
		const beamHeight = Math.max(baseBeamHeight, minBeamHeightForTipCoverage);
		el.style.cssText = `left:${pos.origemX}px;top:${pos.origemY}px;height:${beamHeight}px;width:0px;transform:translate(0,-50%) rotate(${pos.anguloAuto}deg);transition:width ${overlay.durationMs}ms ease-out`;
		els.arena.appendChild(el);
		// force reflow — garante que width:0 está committed antes de aplicar width alvo para a transição CSS
		void el.getBoundingClientRect();
		el.style.width = `${beamWidth}px`;
		return el;
	}

	function zIndexProjetil(atacanteKey) {
		return atacanteKey === "p1" ? 6 : 5;
	}

	function criarProjetil(overlay, pos, atacanteKey) {
		const el = document.createElement("img");
		el.className = "arena-action-overlay";
		el.src = overlay.sprite;
		el.alt = "";
		el.setAttribute("aria-hidden", "true");
		const sizePx = escala(overlay.sizePx ?? 260, pos.arenaW);
		// Position + transform set via inline style (no transition — animation handles movement)
		el.style.cssText = `width:${sizePx}px;left:${pos.origemX}px;top:${pos.origemY}px;z-index:${zIndexProjetil(atacanteKey)};transform:translate(-50%,-50%) scaleX(${pos.escalaHorizontal}) scale(${overlay.scale ?? 1}) rotate(${pos.anguloProjetil}deg);`;
		els.arena.appendChild(el);
		void el.getBoundingClientRect(); // force layout before animation starts

		const animation = el.animate(
			[
				{ left: `${pos.origemX}px`, top: `${pos.origemY}px` },
				{ left: `${pos.alvoX}px`,   top: `${pos.alvoY}px`   },
			],
			{ duration: overlay.durationMs, fill: "forwards", easing: "linear" }
		);
		// Default: remove element when animation finishes (non-clash path)
		animation.onfinish = () => el.remove();

		return {
			el,
			animation,
			pos,
			overlay,
			atacanteKey,
		};
	}

	function criarAttached(overlay, alvoKey) {
		const fighter = els.fighters[alvoKey]?.root;
		if (!fighter) return null;
		const el = document.createElement("img");
		el.className = "fighter-action-overlay";
		el.src = overlay.sprite;
		el.alt = "";
		el.setAttribute("aria-hidden", "true");
		// lemos arenaW uma vez e reusamos para todos os escala() abaixo
		const arenaW  = els.arena?.getBoundingClientRect().width ?? 1000;
		const direcao = alvoKey === "p2" ? -1 : 1;
		const xPx     = escala((overlay.x ?? 0) * direcao, arenaW);
		const yPx     = escala(overlay.y ?? 0, arenaW);
		el.style.transform = `translate(calc(-50% + ${xPx}px), calc(-50% + ${yPx}px)) scale(${overlay.scale ?? 1})`;
		if (overlay.sizePx != null) el.style.width = `${escala(overlay.sizePx, arenaW)}px`;

		const renderizarNaArena = fighter.classList.contains("preparing-domain") && !!els.arena;
		if (renderizarNaArena) {
			const arenaRect = els.arena.getBoundingClientRect();
			const fighterRect = fighter.getBoundingClientRect();
			el.classList.add("fighter-action-overlay--arena");
			el.style.left = `${fighterRect.left + fighterRect.width / 2 - arenaRect.left}px`;
			el.style.top = `${fighterRect.top + fighterRect.height / 2 - arenaRect.top}px`;
			if (overlay.sizePx == null) {
				el.style.width = `${fighterRect.width}px`;
				el.style.height = `${fighterRect.height}px`;
			}
			els.arena.appendChild(el);
			return el;
		}

		fighter.appendChild(el);
		return el;
	}

	function criarOverlay(overlay, atacanteKey) {
		const alvoKey = overlay.target === "self" ? atacanteKey : (atacanteKey === "p1" ? "p2" : "p1");

		if (overlay.mode !== "beam" && overlay.mode !== "projectile") {
			return criarAttached(overlay, alvoKey);
		}

		const arenaRect = els.arena?.getBoundingClientRect();
		const origemEl  = els.fighters[atacanteKey]?.root;
		const alvoEl    = els.fighters[alvoKey]?.root;
		if (!arenaRect || !origemEl || !alvoEl) return null;

		const pos = posicoes(overlay, atacanteKey, origemEl, alvoEl, arenaRect);
		if (overlay.mode === "beam") return criarBeam(overlay, pos);
		return criarProjetil(overlay, pos, atacanteKey).el;
	}

	// ── Renderização de personagens ──────────────────────────────────────

	function escalaFighter(fighterEl, chave, personagem) {
		const s = state.frameScale?.[chave] ?? state.pendingFrameScale?.[chave] ?? personagem?.visual?.spriteScale ?? null;
		if (s != null) fighterEl.style.setProperty("--fighter-scale", s);
		else           fighterEl.style.removeProperty("--fighter-scale");
	}

	function visualPersonagem(chave, personagem, refs) {
		if (!refs?.root || !refs.img) return;

		const spriteTemp = state.sprites[chave] ?? state.pendingSprites?.[chave] ?? null;
		const preparandoDomain = !state.sprites[chave] && !!state.pendingSprites?.[chave];
		const nomeClasse = personagem?.classeNome || personagem?.classe || "?";
		const spriteBase = personagem?.visual?.baseSprite || null;
		const fighterEl  = refs.root;
		const img        = refs.img;
		const initial    = refs.initial;

		fighterEl.classList.remove("has-image", "is-flipped", "action-casting", "preparing-domain", "true-cero-sized", "true-cero-plus-sized", "ubuntu-base-smaller");
		img.removeAttribute("src");

		if (spriteTemp) {
			img.src = spriteTemp;
			fighterEl.classList.add("has-image", "action-casting");
			if (preparandoDomain) fighterEl.classList.add("preparing-domain");
			flipFighter(fighterEl);
			img.onerror = () => fighterEl.classList.remove("has-image", "is-flipped", "action-casting");
		} else if (spriteBase) {
			img.src = spriteBase;
			fighterEl.classList.add("has-image");
			if (nomeClasse.toLowerCase() === "ubuntu") fighterEl.classList.add("ubuntu-base-smaller");
			flipFighter(fighterEl);
			img.onerror = () => fighterEl.classList.remove("has-image", "is-flipped");
		}

		if (initial) initial.textContent = nomeClasse.trim().charAt(0).toUpperCase() || "?";
		escalaFighter(fighterEl, chave, personagem);
	}

	function animarEsquiva(chave) {
		const fighter = els.fighters[chave]?.root;
		if (!fighter) return Promise.resolve(false);

		const dodgeSprite = state.serverState?.[chave]?.visual?.dodgeSprite ?? null;
		const spriteAnterior = state.sprites[chave];

		if (dodgeSprite) { state.sprites[chave] = dodgeSprite; atualizarHUD(); }

		fighter.classList.remove("dodge-anim");
		void fighter.offsetWidth;
		fighter.classList.add("dodge-anim");

		setTimeout(() => {
			fighter.classList.remove("dodge-anim");
			if (dodgeSprite && state.sprites[chave] === dodgeSprite) {
				state.sprites[chave] = spriteAnterior;
				atualizarHUD();
			}
		}, 1200);

		return wait(500).then(() => true);
	}

	function animarMorte(chave) {
		const fighter = els.fighters[chave]?.root;
		if (!fighter) return Promise.resolve();
		return new Promise(resolve => {
			fighter.style.transition = "opacity 0.9s ease-out";
			fighter.style.opacity = "0";
			setTimeout(() => { fighter.style.transition = ""; fighter.style.opacity = ""; resolve(); }, 1500);
		});
	}

	function mostrarAnelClashDeDomain() {
		if (!els.arena) return;

		for (const chave of ["p1", "p2"]) {
			const fighter = els.fighters[chave]?.root;
			const arenaRect = els.arena.getBoundingClientRect();
			const fighterRect = fighter?.getBoundingClientRect();
			if (!fighterRect) continue;

			const ring = document.createElement("div");
			ring.className = "domain-clash-ring";
			ring.style.left = `${fighterRect.left - arenaRect.left + (fighterRect.width / 2)}px`;
			ring.style.top = `${fighterRect.top - arenaRect.top + (fighterRect.height / 2)}px`;
			els.arena.appendChild(ring);

			ring.addEventListener("animationend", () => ring.remove(), { once: true });
		}
	}

	function mostrarPainelClashDeDomain(leftImage, rightImage, durationMs = 7000) {
		if (!els.arena || (!leftImage && !rightImage)) {
			return () => {};
		}

		const panel = document.createElement("div");
		panel.className = "domain-clash-split";
		panel.style.setProperty("--domain-clash-duration", `${durationMs}ms`);

		const leftPane = document.createElement("div");
		leftPane.className = "domain-clash-split-pane is-left";
		if (leftImage) leftPane.style.backgroundImage = `url('${leftImage}')`;

		const rightPane = document.createElement("div");
		rightPane.className = "domain-clash-split-pane is-right";
		if (rightImage) rightPane.style.backgroundImage = `url('${rightImage}')`;

		panel.append(leftPane, rightPane);
		els.arena.appendChild(panel);

		let removed = false;
		const cleanup = () => {
			if (removed) return;
			removed = true;
			panel.remove();
		};

		setTimeout(cleanup, durationMs + 100);
		return cleanup;
	}

	function mostrarTransicaoPosClashDeDomain(fadeOutMs = 1000, fadeInMs = 1000) {
		if (!els.arena) return wait(fadeOutMs + fadeInMs);

		const overlay = document.createElement("div");
		overlay.className = "domain-clash-blackout";
		overlay.style.setProperty("--domain-blackout-fadeout-ms", `${fadeOutMs}ms`);
		overlay.style.setProperty("--domain-blackout-fadein-ms", `${fadeInMs}ms`);
		els.arena.appendChild(overlay);

		return new Promise(resolve => {
			requestAnimationFrame(() => overlay.classList.add("is-dark"));
			setTimeout(() => overlay.classList.remove("is-dark"), fadeOutMs);
			setTimeout(() => {
				overlay.remove();
				resolve();
			}, fadeOutMs + fadeInMs + 40);
		});
	}

	function mostrarFundoDomainBreak(gifSrc, durationMs = 1800) {
		if (!els.arena || !gifSrc) return wait(durationMs);

		const overlay = document.createElement("div");
		overlay.className = "domain-break-background";
		overlay.style.backgroundImage = `url('${gifSrc}')`;
		els.arena.appendChild(overlay);

		return new Promise(resolve => {
			requestAnimationFrame(() => overlay.classList.add("is-visible"));
			setTimeout(() => {
				overlay.classList.remove("is-visible");
				setTimeout(() => {
					overlay.remove();
					resolve();
				}, 260);
			}, durationMs);
		});
	}

	async function animarTransformacao(chave) {
		const fighter       = els.fighters[chave]?.root;
		const transformCfg  = state.serverState?.[chave]?.visual?.transformation ?? {};
		const spriteTransf  = transformCfg.sprite ?? null;
		const audioConfig   = typeof transformCfg.audio === "string"
			? { file: transformCfg.audio }
			: (transformCfg.audio ?? null);
		const audioFile     = audioConfig?.file ?? null;
		const audioVolume   = volumePorNivel(audioConfig?.volumeLevel, 0.75);
		const audioDurationMs = Number(audioConfig?.durationMs) > 0 ? Number(audioConfig.durationMs) : 3600;

		// Overlay escuro
		const overlay = document.createElement("div");
		overlay.className = "char-transform-overlay";
		document.body.appendChild(overlay);

		// Audio
		if (audioFile) {
			const audio = new Audio(audioFile);
			audio.volume = audioVolume;
			audio.play().catch(() => {});
			setTimeout(() => { try { audio.pause(); audio.currentTime = 0; } catch (_) {} }, audioDurationMs);
		}

		// Fase 1: pulso no sprite do fighter
		if (fighter) fighter.classList.add("char-transforming");

		await wait(200);
		overlay.classList.add("active"); // escurece a tela

		// Fase 2: troca o sprite para a forma transformada
		await wait(900);
		if (spriteTransf) { state.sprites[chave] = spriteTransf; atualizarHUD(); }

		// Fase 3: flash
		await wait(300);
		overlay.classList.add("flash");

		await wait(280);
		overlay.classList.remove("flash");
		overlay.classList.add("fade-out"); // tela volta ao normal

		// Fase 4: limpa animação de pulso, aplica idle de transformado
		await wait(500);
		if (fighter) {
			fighter.classList.remove("char-transforming");
			fighter.classList.add("char-transformed");
		}

		// Fase 5: solta o sprite temporário (baseSprite já é DOMAINSUKUNA.png via servidor)
		await wait(600);
		state.sprites[chave] = null;
		atualizarHUD();

		await wait(300);
		overlay.remove();
	}

	return {
		feedbackDano,
		textoFlutuante,
		obterPrimeiroFrameDaAcao,
		wait,
		mostrarSplashErroInsano,
		mostrarAnelClashDeDomain,
		mostrarPainelClashDeDomain,
		mostrarTransicaoPosClashDeDomain,
		mostrarFundoDomainBreak,
		rodarTimeline,
		cancelarAnimacao,
		montarAnimacao,
		montarAnimacaoClash,
		montarAnimacaoDomainClash,
		visualPersonagem,
		animarEsquiva,
		animarMorte,
		animarTransformacao,
	};
}
