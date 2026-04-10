export const ACOES_POR_PAGINA = 3;

export const PLACEHOLDER_ACTIONS_HTML = `
	<button disabled>ATACAR</button>
	<button disabled>DEFENDER</button>
	<button class="pagination-btn" disabled>→</button>
	<button disabled>HABILIDADE</button>
`;

function percentual(atual, maximo) {
	if (maximo <= 0) return "0%";
	return `${Math.max(0, Math.min(100, (atual / maximo) * 100))}%`;
}

function classePerigosa(hpAtual, hpMax) {
	return hpMax > 0 && hpAtual / hpMax <= 0.3;
}

function obterCustoEnergiaAcao(acao) {
	return Number(acao?.energyCost) || 0;
}

export function createUIController({ state, els, onActionSelected }) {
	function adicionarLog(texto) {
		const li = document.createElement("li");
		li.textContent = texto;
		els.log.prepend(li);

		while (els.log.children.length > 8) {
			els.log.removeChild(els.log.lastChild);
		}
	}

	function obterDescricaoAcao(acao) {
		if (acao && typeof acao.description === "string" && acao.description.trim() !== "") {
			return acao.description;
		}
		return "Ação de combate sem descrição detalhada.";
	}

	function mostrarPreviewSkill(nomeAcao, descricao) {
		if (!els.combatFeed || !els.skillPreviewTitle || !els.skillPreviewText) return;
		els.skillPreviewTitle.textContent = nomeAcao;
		els.skillPreviewText.textContent = descricao;
		els.combatFeed.classList.add("previewing-skill");
	}

	function esconderPreviewSkill() {
		if (!els.combatFeed) return;
		els.combatFeed.classList.remove("previewing-skill");
	}

	function setArenaDomain(domainImage) {
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

	function atualizarCardStatus(personagem, refs) {
		refs.name.textContent = personagem.classeNome.toUpperCase();
		refs.tag.textContent = personagem.nome;
		refs.hpText.textContent = `${personagem.vidaAtual} / ${personagem.vidaMaxima}`;
		refs.energyText.textContent = `${personagem.energiaAtual} / ${personagem.energiaMaxima}`;
		refs.hpBar.style.width = percentual(personagem.vidaAtual, personagem.vidaMaxima);
		refs.energyBar.style.width = percentual(personagem.energiaAtual, personagem.energiaMaxima);
		refs.hpBar.classList.toggle("danger", classePerigosa(personagem.vidaAtual, personagem.vidaMaxima));
	}

	function mostrarTelaVitoria(server) {
		if (!server || !server.winner) {
			els.winnerOverlay.classList.add("is-hidden");
			return;
		}

		const vencedor = server.winner === "p1" ? server.p1 : server.p2;
		const labelVencedor = server.winner === "p1" ? "Jogador 1" : "Jogador 2";
		const spriteVitoria = vencedor?.visual?.winImage || vencedor?.visual?.baseSprite || "";

		els.winnerText.textContent = `${labelVencedor} (${vencedor.nome}) venceu!`;
		if (spriteVitoria) {
			els.winnerSprite.src = spriteVitoria;
			els.winnerSprite.style.display = "block";
		} else {
			els.winnerSprite.removeAttribute("src");
			els.winnerSprite.style.display = "none";
		}
		els.winnerOverlay.classList.remove("is-hidden");
	}

	function atualizarHUD({ renderFighter, updateDomainCuts }) {
		const server = state.serverState;
		if (!server || !server.started) {
			setArenaDomain(null);
			updateDomainCuts(false);
			els.winnerOverlay.classList.add("is-hidden");
			return;
		}

		let domainImage = state.domainImage;
		if (!domainImage && (server.domainTurnsRemaining || 0) > 0 && server.domainCasterKey) {
			domainImage = server[server.domainCasterKey]?.visual?.actions?.["Domain"]?.domainImage ?? null;
		}
		setArenaDomain(domainImage);
		updateDomainCuts(state.domainCutsActive);

		atualizarCardStatus(server.p2, els.cards.enemy);
		atualizarCardStatus(server.p1, els.cards.player);
		renderFighter("p2", server.p2, els.fighters.p2);
		renderFighter("p1", server.p1, els.fighters.p1);

		if (server.winner) {
			els.turnInfo.textContent = `${server.winner === "p1" ? "Jogador 1" : "Jogador 2"} venceu!`;
			mostrarTelaVitoria(server);
			return;
		}

		els.winnerOverlay.classList.add("is-hidden");
		const jogadorDaVez = server.currentKey === "p1" ? "Jogador 1" : "Jogador 2";
		const nomeDaVez = server.currentKey === "p1" ? server.p1.nome : server.p2.nome;
		els.turnInfo.textContent = `Turno ${server.turno} • ${jogadorDaVez} (${nomeDaVez})`;
	}

	function setBotoesAcaoHabilitados(habilitado) {
		Array.from(els.menu.querySelectorAll("button")).forEach((btn) => {
			if (btn.classList.contains("pagination-btn")) {
				const totalAcoes = (state.serverState?.availableActions || []).length;
				const totalPaginas = Math.max(1, Math.ceil(totalAcoes / ACOES_POR_PAGINA));
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
				if (totalPaginas <= 1 || state.resolvendoAcao) {
					btn.disabled = true;
				} else {
					btn.addEventListener("click", () => {
						state.actionPage = (state.actionPage + 1) % totalPaginas;
						montarAcoes();
					});
				}
				els.menu.appendChild(btn);
				return;
			}

			btn.textContent = acao.nome;
			if (!acao.type) {
				btn.disabled = true;
			} else {
				const nomeAcao = acao.nomeSprite || acao.nome;
				const custoEnergia = obterCustoEnergiaAcao(acao);
				const semEnergia = Boolean(acao.disabled) || custoEnergia > energiaAtual;
				const descricaoAcao = obterDescricaoAcao(acao);

				btn.classList.toggle("is-disabled-by-energy", semEnergia);
				if (semEnergia) btn.tabIndex = -1;

				btn.addEventListener("mouseenter", () => mostrarPreviewSkill(nomeAcao, descricaoAcao));
				btn.addEventListener("mouseleave", esconderPreviewSkill);
				btn.addEventListener("focus", () => mostrarPreviewSkill(nomeAcao, descricaoAcao));
				btn.addEventListener("blur", esconderPreviewSkill);
				btn.addEventListener("click", () => {
					if (semEnergia || state.resolvendoAcao) return;
					onActionSelected(acao);
				});
			}

			els.menu.appendChild(btn);
		});
	}

	function resetarParaSetup(cancelAnimation) {
		state.serverState = null;
		state.resolvendoAcao = false;
		state.actionPage = 0;
		state.arenaFundo = null;
		cancelAnimation();
		esconderPreviewSkill();

		els.battleView.classList.add("is-hidden");
		els.battleApp?.classList.remove("is-playing");
		els.setupPanel.classList.remove("is-hidden");
		els.winnerOverlay.classList.add("is-hidden");
		setArenaDomain(null);

		els.turnInfo.textContent = "Prepare a partida";
		els.log.innerHTML = "";
		adicionarLog("Configure os jogadores e clique em INICIAR BATALHA.");
		els.menu.innerHTML = PLACEHOLDER_ACTIONS_HTML;
	}

	return {
		adicionarLog,
		mostrarPreviewSkill,
		esconderPreviewSkill,
		setArenaDomain,
		atualizarHUD,
		setBotoesAcaoHabilitados,
		montarAcoes,
		resetarParaSetup,
	};
}
