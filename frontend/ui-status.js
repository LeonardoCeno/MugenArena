export const ACOES_POR_PAGINA = 3;

export const PLACEHOLDER_ACTIONS_HTML = `
	<button disabled>ATACAR</button>
	<button disabled>DEFENDER</button>
	<button class="pagination-btn" disabled>→</button>
	<button disabled>HABILIDADE</button>
`;

function labelJogador(key) {
	return key === "p1" ? "Jogador 1" : "Jogador 2";
}

function percentual(atual, maximo) {
	if (maximo <= 0) return "0%";
	return `${Math.max(0, Math.min(100, (atual / maximo) * 100))}%`;
}

function classePerigosa(hpAtual, hpMax) {
	return hpMax > 0 && hpAtual / hpMax <= 0.3;
}

export function createUIController({ state, els, onActionSelected }) {
	function adicionarLog(texto) {
		const li = document.createElement("li");
		li.textContent = texto;
		els.log.prepend(li);

		if (els.log.children.length > 8) {
			els.log.removeChild(els.log.lastChild);
		}
	}

	function mostrarPreview(nomeAcao, descricao) {
		if (!els.combatFeed || !els.skillPreviewTitle || !els.skillPreviewText) return;
		els.skillPreviewTitle.textContent = nomeAcao;
		els.skillPreviewText.textContent = descricao;
		els.combatFeed.classList.add("previewing-skill");
	}

	function esconderPreview() {
		if (!els.combatFeed) return;
		els.combatFeed.classList.remove("previewing-skill");
	}

	function setDomain(domainImage) {
		if (!els.arena) return;
		const img = domainImage || state.arenaFundo;
		if (img) {
			const overlay = domainImage ? 'linear-gradient(rgba(20,22,32,0.25),rgba(20,22,32,0.25)), ' : '';
			els.arena.style.backgroundImage = `${overlay}url('${img}')`;
			els.arena.style.backgroundSize = 'cover';
			els.arena.style.backgroundPosition = 'center';
			els.arena.style.backgroundRepeat = 'no-repeat';
		} else {
			els.arena.style.backgroundImage = '';
			els.arena.style.backgroundSize = '';
			els.arena.style.backgroundPosition = '';
			els.arena.style.backgroundRepeat = '';
		}
	}

	function atualizarCard(personagem, refs) {
		refs.name.textContent = personagem.classeNome.toUpperCase();
		refs.tag.textContent = personagem.nome;
		refs.hpText.textContent = `${personagem.vidaAtual} / ${personagem.vidaMaxima}`;
		refs.energyText.textContent = `${personagem.energiaAtual} / ${personagem.energiaMaxima}`;
		refs.hpBar.style.width = percentual(personagem.vidaAtual, personagem.vidaMaxima);
		refs.energyBar.style.width = percentual(personagem.energiaAtual, personagem.energiaMaxima);
		refs.hpBar.classList.toggle("danger", classePerigosa(personagem.vidaAtual, personagem.vidaMaxima));

		if (refs.statusIcons) {
			refs.statusIcons.innerHTML = "";
			if ((personagem.bleedTurnos || 0) > 0) {
				const img = document.createElement("img");
				img.src = "./assets/efeitos/sangrar.png";
				img.alt = "Sangramento";
				img.title = `Sangramento: ${personagem.bleedTurnos} turno(s)`;
				refs.statusIcons.appendChild(img);
			}
			if ((personagem.burnTurnos || 0) > 0) {
				const img = document.createElement("img");
				img.src = "./assets/efeitos/queimar.png";
				img.alt = "Queimadura";
				img.title = `Queimadura: ${personagem.burnTurnos} turno(s)`;
				refs.statusIcons.appendChild(img);
			}
		}
	}

	function mostrarVitoria(server) {
		if (!server || !server.winner) {
			els.winnerOverlay.classList.add("is-hidden");
			return;
		}

		const vencedor = server.winner === "p1" ? server.p1 : server.p2;
		const labelVencedor = labelJogador(server.winner);
		const spriteVitoria = vencedor?.visual?.winImage || vencedor?.visual?.baseSprite || "";

		const winMessage = vencedor?.visual?.winMessage ?? `${labelVencedor} (${vencedor.nome}) venceu!`;
		els.winnerText.textContent = winMessage;
		if (spriteVitoria) {
			els.winnerSprite.src = spriteVitoria;
			els.winnerSprite.style.display = "block";
		} else {
			els.winnerSprite.removeAttribute("src");
			els.winnerSprite.style.display = "none";
		}
		els.winnerOverlay.classList.remove("is-hidden");
	}

	function atualizarHUD({ renderFighter }) {
		const server = state.serverState;
		if (!server || !server.started) {
			setDomain(null);
			els.winnerOverlay.classList.add("is-hidden");
			return;
		}

		let domainImage = state.domainImage;
		if (!domainImage && (server.domainTurnsRemaining || 0) > 0 && server.domainCasterKey) {
			const actions = server[server.domainCasterKey]?.visual?.actions ?? {};
			for (const action of Object.values(actions)) {
				if (action.domainImage) { domainImage = action.domainImage; break; }
			}
		}
		setDomain(domainImage);

		atualizarCard(server.p2, els.cards.enemy);
		atualizarCard(server.p1, els.cards.player);
		renderFighter("p2", server.p2, els.fighters.p2);
		renderFighter("p1", server.p1, els.fighters.p1);

		if (server.winner) {
			els.turnInfo.textContent = `${labelJogador(server.winner)} venceu!`;
			mostrarVitoria(server);
			return;
		}

		els.winnerOverlay.classList.add("is-hidden");
		const jogadorDaVez = labelJogador(server.currentKey);
		const nomeDaVez = server[server.currentKey].nome;
		els.turnInfo.textContent = `Turno ${server.turno} • ${jogadorDaVez} (${nomeDaVez})`;
	}

	function habilitarBotoes(habilitado) {
		const totalAcoes = (state.serverState?.availableActions || []).length;
		const totalPaginas = Math.max(1, Math.ceil(totalAcoes / ACOES_POR_PAGINA));
		Array.from(els.menu.querySelectorAll("button")).forEach((btn) => {
			if (btn.classList.contains("pagination-btn")) {
				btn.disabled = !habilitado || totalPaginas <= 1;
				return;
			}

			if (btn.textContent.trim() !== "-") {
				btn.disabled = !habilitado;
			}
		});
	}

	function montarAcoes() {
		els.menu.innerHTML = "";
		const server = state.serverState;
		if (!server || !server.started || server.winner) return;

		const energiaAtual = Number(server[server.currentKey]?.energiaAtual ?? 0);
		const acoes = (server.availableActions || []).map((acao) => ({
			...acao,
			nome: acao.label,
			nomeSprite: acao.skillName || acao.label,
		}));

		const totalPaginas = Math.max(1, Math.ceil(acoes.length / ACOES_POR_PAGINA));
		if (state.actionPage >= totalPaginas) state.actionPage = 0;

		const inicio = state.actionPage * ACOES_POR_PAGINA;
		const acoesPagina = acoes.slice(inicio, inicio + ACOES_POR_PAGINA);
		while (acoesPagina.length < ACOES_POR_PAGINA) acoesPagina.push({ nome: "-", type: null });

		const slots = [acoesPagina[0], acoesPagina[1], null, acoesPagina[2]];
		slots.forEach((acao, slotIndex) => {
			const btn = document.createElement("button");

			if (slotIndex === 2) {
				btn.textContent = "→";
				btn.classList.add("pagination-btn");
				btn.disabled = totalPaginas <= 1 || state.resolvendoAcao;
				btn.addEventListener("click", () => {
					if (state.resolvendoAcao) return;
					state.actionPage = (state.actionPage + 1) % totalPaginas;
					montarAcoes();
				});
				els.menu.appendChild(btn);
				return;
			}

			btn.textContent = acao.nome;
			if (!acao.type) {
				btn.disabled = true;
			} else {
				const nomeAcao     = acao.nomeSprite || acao.nome;
				const custoEnergia = Number(acao?.energyCost) || 0;
				const semEnergia   = Boolean(acao.disabled) || custoEnergia > energiaAtual;
				const descricao    = (acao?.description?.trim()) || "Ação de combate sem descrição detalhada.";

				btn.classList.toggle("is-disabled-by-energy", semEnergia);
				if (semEnergia || state.resolvendoAcao) btn.tabIndex = -1;
				if (state.resolvendoAcao) btn.disabled = true;

				btn.addEventListener("mouseenter", () => mostrarPreview(nomeAcao, descricao));
				btn.addEventListener("mouseleave", esconderPreview);
				btn.addEventListener("focus",      () => mostrarPreview(nomeAcao, descricao));
				btn.addEventListener("blur",       esconderPreview);
				btn.addEventListener("click", () => {
					if (semEnergia || state.resolvendoAcao) return;
					onActionSelected(acao);
				});
			}

			els.menu.appendChild(btn);
		});
	}

	function resetarParaSetup(cancelar) {
		state.serverState = null;
		state.resolvendoAcao = false;
		state.actionPage = 0;
		state.arenaFundo = null;
		cancelar();
		esconderPreview();

		els.battleView.classList.add("is-hidden");
		els.battleApp?.classList.remove("is-playing");
		els.setupPanel.classList.remove("is-hidden");
		els.winnerOverlay.classList.add("is-hidden");
		setDomain(null);

		els.turnInfo.textContent = "Prepare a partida";
		els.log.innerHTML = "";
		adicionarLog("Configure os jogadores e clique em INICIAR BATALHA.");
		els.menu.innerHTML = PLACEHOLDER_ACTIONS_HTML;
	}

	return {
		adicionarLog,
		mostrarPreview,
		esconderPreview,
		setDomain,
		atualizarHUD,
		habilitarBotoes,
		montarAcoes,
		resetarParaSetup,
	};
}
