# MugenArena - Handoff Tecnico Completo para IA

## Objetivo
Este documento explica como o projeto funciona de ponta a ponta, com foco em:
- Arquitetura real do codigo atual
- Contratos de dados entre backend e frontend
- Fluxo de turno, clash e domain
- Estrutura visual/audio
- Regras que nao podem ser quebradas
- Checklist pratico para outra IA editar com seguranca

---

## 1) Estrutura atual do projeto

### Raiz
- `compose.yaml`: sobe app PHP+Apache em `:8080`.
- `Dockerfile`: imagem `php:8.4-apache`, copia projeto para `/var/www/html`.
- `README.md`: instrucoes de execucao; atualmente contem marcador de conflito Git no topo (`<<<<<<< HEAD`).
- `backend/`: regra de jogo e API.
- `frontend/`: UI, animacao, clash visual, audio.

### Backend
- `backend/ExcecaoJogo.php`: excecoes de dominio (`ExcecaoJogo`, `EnergiaInsuficienteException`, `EntradaInvalidaException`).
- `backend/Personagem.php`: classe base com engine de combate e status.
- `backend/GameService.php`: facade principal que agrega traits.
- `backend/index.php`: modo CLI para testes manuais.
- `backend/web_api.php`: endpoint HTTP JSON usado pelo frontend.
- `backend/GameService/Helpers.php`: utilitarios de chave, domain e leitura de skill.
- `backend/GameService/GameSetup.php`: catalogo de classes, criacao de personagens e estado inicial.
- `backend/GameService/TurnOrder.php`: prioridade, velocidade, regras de order e cancel de domain.
- `backend/GameService/TurnExecution.php`: submissao/execucao de acoes e resolucao de rodada.
- `backend/GameService/StateExport.php`: serializacao do estado para o frontend.
- `backend/characters/*/*.php`: implementacoes dos personagens e configuracao visual por acao.

### Frontend
- `frontend/batalha.html`: estrutura da tela (intro, setup, battle, tutorial, HUD, arena).
- `frontend/batalha.css`: layout e efeitos visuais (inclui beam dinamico por cor via CSS vars).
- `frontend/app.js`: orquestrador principal do jogo no cliente.
- `frontend/ui-status.js`: HUD, cards de status, menu de acoes e preview.
- `frontend/battle-animations.js`: timeline de animacoes, overlays, projeteis, beams, domain VFX.
- `frontend/clash-system.js`: logica visual do clash (espera overlap, freeze, vencedor continua).
- `frontend/audio-controller.js`: BGM, audio de domain clash, fade, volume/mute.
- `frontend/black-hole-animation.js`: transicao de entrada para tela de batalha.
- `frontend/tutorial-content.html`: conteudo textual do tutorial.
- `frontend/assets/`: sprites, GIFs, SFX e fundos.

Observacao:
- Nao existe pasta `docs/` no estado atual do workspace (apesar de referencias antigas em conversa).

---

## 2) Backend - modelo de estado e fluxo de API

## 2.1 Endpoint HTTP (`backend/web_api.php`)
A API e orientada por `action` no body JSON.

Acoes aceitas:
- `start`: cria partida e salva em sessao.
- `state`: retorna estado atual.
- `action`: submete acao de um jogador.
- `catalog`: retorna personagens disponiveis para selecao.

Fluxo:
1. Recebe JSON (`receberJson`).
2. Roteia por `switch` de `action`.
3. Em `action`, chama `GameService::submeterAcao`.
4. Atualiza `$_SESSION['game']` se a partida nao foi resetada.
5. Retorna payload com campos de resolucao e estado exportado.

Campos importantes de resposta em `action`:
- `resolved` (bool)
- `resolucaoOrdem` (array ou null)
- `mensagensResolucao` (array)
- `estadoIntermediario` (obj ou null)
- `domainCancel` (obj ou null)
- `clash` (obj ou null)
- `state` (estado completo exportado)

---

## 2.2 Estado de jogo em memoria (sessao)
Criado por `GameSetup::criarEstadoDeJogo`:
- `p1`, `p2`: instancias de `Personagem`
- `turno`: inteiro
- `skipTurns`: `{ p1, p2 }`
- `pendingActions`: `{ p1, p2 }`
- `domain`: `{ turnsRemaining, casterKey }`

Invariantes:
- `pendingActions` deve existir sempre para os dois lados.
- `domain` deve manter os campos `turnsRemaining` e `casterKey`.
- `p1`/`p2` devem ser objetos validos de classes que extendem `Personagem`.

---

## 2.3 Classe base `Personagem`
Regras centrais:
- Desvio: `sorteouDesvio` = 10%
- Critico: `sorteouCritico` = 7%
- Defesa: reduz dano recebido em 50%
- Regeneracao de energia base por turno: 10

Campos de status:
- `sangramentoTurnos`, `sangramentoDanoPorTurno`, atraso
- `queimaduraTurnos`, `queimaduraDanoPorTurno`, atraso
- `ultimoTipoDano` (consumido pelo frontend para cor dos floats)

Ponto critico recente:
- `forcarAcertoNoProximoAtaque()` seta `ignorarDesvioNoProximoAtaque`.
- Isso e usado no vencedor de projectile clash para evitar o bug de "ganhou clash mas errou por desvio".

---

## 2.4 Orquestracao de turno (`TurnExecution` + `TurnOrder`)

### Submissao (`GameService::submeterAcao`)
- Valida chave e estado
- Impede dupla submissao do mesmo player no turno
- Valida skillIndex/custo/energy/domain lock
- Grava em `pendingActions`
- Preenche auto-skip (`preencherAcoesSkip`)
- Resolve rodada quando ambos preencheram

### Ordem (`TurnOrder::determinarOrdem`)
Prioridade de execucao:
1. Acao de domain marcada como "deve executar por ultimo" (regra especial)
2. `priority` da acao
3. `velocidade`
4. desempate aleatorio

### Clash
- Domain clash quando os dois lados usam skill com `activatesDomain` + `domainClash`.
- Projectile clash quando os dois lados usam skill `clashable`.
- Em clash, apenas vencedor executa (exceto bothFailed em domain clash).

Decisao do clash (`decidirVencedorDoClash`):
- Domain clash com ambos sem prioridade: 40% p1, 40% p2, 20% bothFailed.
- Projectile clash usa combinacao de prioridade/aleatorio.

### Domain cancel por interrupcao
- Se defensor iria ativar domain
- E atacante causa dano antes
- Chance de cancel = 60%
- Se cancelar, aplica penalidade de energia (50% do custo da skill de domain)

### Avanco de turno
- Processa bleed/burn no fim
- Incrementa `turno`
- Limpa pendencias
- Chama `iniciarTurno` dos dois (reseta defesa e regenera energia)

---

## 2.5 Exportacao para frontend (`StateExport`)
Campos principais:
- `started`, `turno`, `currentKey`, `winner`, `waitingFor`
- `domainTurnsRemaining`, `domainCasterKey`
- `p1`, `p2` com stats + `visual`
- `availableActions` (flat para jogador atual)
- `availableActionsPorJogador` (duas listas)

`availableActions` inclui:
- `type`, `label`, `skillName`, `description`
- `skillIndex`, `targetsOpponent`, `energyCost`
- `disabled`, `melee`, `priority`, `activatesDomain`, `domainClash`

---

## 3) Frontend - ciclo principal

## 3.1 Estado global (`frontend/app.js`)
Chaves importantes:
- `serverState`
- `resolvendoAcao` (trava antiduplo clique)
- `anim`
- `sprites`, `frameScale`
- `pendingSprites`, `pendingFrameScale`
- `domainImage`, `domainImageVersion`
- `acaoPendente` (1o jogador aguardando 2o)

### Ciclo de acao
1. Jogador escolhe acao no menu.
2. `processarAcao` chama API `action`.
3. Se `resolved=false`, guarda acao pendente e espera outro jogador.
4. Se `resolved=true`, executa:
   - branch clash (projectile/domain)
   - ou branch normal por ordem retornada
5. Atualiza HUD e logs.

---

## 3.2 HUD e menu (`ui-status.js`)
Funcoes centrais:
- `atualizarHUD`: cards, barras, status, turn text, vitoria.
- `montarAcoes`: pagina menu em 3 slots + botao de pagina.
- `setDomain`: aplica imagem de fundo de domain com overlay escuro.

Dependencia critica:
- Usa `serverState.availableActions` e `currentKey` para construir botoes.

---

## 3.3 Animacao de combate (`battle-animations.js`)

### Timeline
- `rodarTimeline(events)` com `setTimeout`.
- `cancelarAnimacao` limpa overlays e estados visuais temporarios.

### Overlays
`overlaysDeConfig` normaliza campos como:
- `mode` (`attached`, `projectile`, `beam`)
- `startMs`, `durationMs`, offsets, `thicknessPx`, `beamTone`, etc.

### Beam
- `criarBeam` desenha elemento `.arena-energy-beam`.
- Cor dinamica: `applyBeamTone` + `resolveBeamPalette`.
- `beamTone` aceita `dark`, `pink` e cor CSS valida (hex/rgb/nome suportado pelo browser).

### Clash prep
- `montarAnimacaoClash` separa `preLaunchEvents`, `launchEvents`, `postEvents`.
- Expondo:
  - `getProjectileRef` / `getProjectileRefs`
  - `setBeamAimOverride`
  - `getPrimaryBeamSourcePoint`

### Mira de beam contra beam
- Em `app.js`, antes de sincronizar launch:
  - pega origem do beam de cada lado
  - aplica override para cada beam mirar na origem do outro

---

## 3.4 Sistema de clash visual (`clash-system.js`)
Fluxo:
1. `runClash` espera overlap (ou timeout).
2. Congela ambos (`freezeAtCurrentPosition`).
3. Exibe efeitos visuais de clash.
4. Remove perdedor.
5. Vencedor continua ate alvo e dispara post-events.

Particularidades beam vs beam:
- Detector usa segmentos de beam (`beamPairTouched` e `beamFrontsReached`).
- Frente real do beam e calculada por largura atual do `beamEl` (`getBeamFrontInArena`).
- Parametros de tuning atuais no topo:
  - `BEAM_TOUCH_EARLY_MULTIPLIER = 0.7`
  - `BEAM_FRONT_REACH_RATIO = 1.8`

Observacao importante:
- Esses dois parametros estao sendo ajustados com frequencia recente para acertar ponto de colisao visual.

---

## 3.5 Audio (`audio-controller.js`)
- BGM aleatoria em loop por faixa (`playRandomBgm`).
- Domain clash possui audio proprio em loop (`playClashDomain`).
- Regra atual solicitada pelo usuario:
  - Se musica de fundo esta ON, musica de domain clash fica mutada.
  - Implementado com `audio.muted = !muted` no `playClashDomain`.

---

## 4) Contratos de dados backend -> frontend

## 4.1 Request action
`POST backend/web_api.php`

Body:
- `action`: `start | state | action | catalog`
- Para `action`: `playerKey`, `actionType`, `skillIndex`

## 4.2 Response action
Campos esperados pelo frontend:
- `ok`
- `resolved`
- `resolucaoOrdem`
- `mensagensResolucao`
- `estadoIntermediario`
- `domainCancel`
- `clash`
- `message`
- `state`

## 4.3 Objeto `visual` de personagem
Vem de `getConfiguracaoVisual()` no PHP.
Contem:
- `baseSprite`, `winImage`, `winMessage`, opcional `dodgeSprite`, `errorSplash`
- `actions` por nome de skill
- `reactions.defendingHit`

Cada acao pode ter:
- `frames` (sprite/duration/scale)
- `overlays` (attached/projectile/beam)
- `audio` e `domainAudio`
- `domainDelayMs`, `domainImage`
- `repeatFrames`, `repeatOverlays`

---

## 5) Personagens e regras (estado atual)

## 5.1 Sukuna (`backend/characters/sukuna/Sukuna.php`)
- Stats: HP 300, ATK 25, EN 4000, VEL 70, regen 70.
- Skills:
  - Desmantelar (dano + bleed)
  - Kamino Fuga (projectile clashable priority + burn)
  - Reverse Energy (cura)
  - Domain (activatesDomain + domainClash + priority)

## 5.2 Gojo (`backend/characters/gojo/Gojo.php`)
- Stats: HP 300, ATK 20, EN 1000, VEL 90, regen 50.
- Skills:
  - Azul
  - Vazio Roxo (projectile clashable priority)
  - Reverse Energy
  - Domain (skipTurns 2, activatesDomain, domainClash, priority)

## 5.3 Sans (`backend/characters/sans/Sans.php`)
- Stats: HP 1, ATK 1, EN 800, VEL 100, regen 0.
- Mecanica especial:
  - Recebe dano primeiro na energia; so toma HP quando energia zerar.
- Skills: bluesoul, comecou, BADTIME (priority), eh eh (recupera energia).

## 5.4 Ulquiorra (`backend/characters/ulquiorra/Ulquiorra.php`)
- Stats: HP 240, ATK 30, EN 400, VEL 80, regen 40.
- Skills:
  - Cero (beam)
  - cero oscuras (beam clashable priority)
  - Barrage (melee + bleed)
  - Heal
- Beam tone atual de `cero oscuras`: `#003424`.

## 5.5 Miku (`backend/characters/miku/Miku.php`)
- Stats: HP 200, ATK 20, EN 500, VEL 75, regen 30.
- Skills:
  - MAGIC! (projectile clashable)
  - Miku BEEAM (beam clashable priority)
  - MY VOICE
  - mikupower (cura)
- Beam tone atual de Miku BEEAM: `#00f7ff`.

## 5.6 Labubu (`backend/characters/labubu/Labubu.php`)
- Stats: HP 300, ATK 20, EN 2067, VEL 55.
- Skills:
  - MorangodoAmor (projectile clashable priority)
  - labuaura (cura)

## 5.7 Profe (`backend/characters/profe/Profe.php`)
- Stats: HP 267, ATK 24, EN 500, VEL 60, regen 35.
- Skills:
  - Red bill (cura)
  - Apelacao
  - VibeCode (projectile clashable)
  - DOOCKER (domain com dano, skipTurns 1, activatesDomain/domainClash/priority)

## 5.8 Ubuntu (`backend/characters/ubuntu/Ubuntu.php`)
- Stats: HP 999, ATK 10, EN 999, VEL 30.
- `usaSomenteHabilidades = true`.
- Fluxo de skill em 2 etapas:
  - Primeiro turno: abrir terminal
  - Segundo turno: ls (dano muito alto)
- `retornaAoSetup('erro') = true`: encerra partida para setup.

## 5.9 UbuntuKiller (`backend/characters/ubuntukiller/UbuntuKiller.php`)
- Stats: HP 500, ATK 100, EN 1000, VEL 45, regen 0.
- Mecanica de dano semelhante a Sans: energia absorve dano primeiro.
- Skill unica `ubuntubuxa` com prioridade.

---

## 6) Pontos sensiveis (nao quebrar)

- Nao mudar nomes de chaves exportadas em `state` sem atualizar frontend.
- Nao remover `ultimoTipoDano` (quebra feedback visual de dano).
- Nao remover `availableActions` flat (menu depende disso).
- Nao mudar contrato de `clash` (frontend usa `kind`, `winner`, `durationMs`, `bothFailed`).
- Nao esquecer `consumirEnergia` nas skills de custo positivo.
- Nao quebrar regra de domain interrompido (chance 60% + penalidade de 50% da energia).
- Nao alterar comportamento de `forcarAcertoNoProximoAtaque` sem revisar projectile clash.
- Em clash beam-vs-beam, cuidado extremo com:
  - calculo da frente do beam por largura atual
  - thresholds de proximidade no topo de `clash-system.js`

---

## 7) Checklist para outra IA editar com seguranca

1. Ler primeiro:
- `backend/web_api.php`
- `backend/Personagem.php`
- `backend/GameService/TurnExecution.php`
- `backend/GameService/TurnOrder.php`
- `backend/GameService/StateExport.php`
- `frontend/app.js`
- `frontend/battle-animations.js`
- `frontend/clash-system.js`

2. Antes de mudar regra de combate:
- Conferir impacto em exportacao (`StateExport`)
- Conferir impacto visual em `app.js` + `battle-animations.js`

3. Antes de mudar clash:
- Testar projectile vs projectile
- Testar beam vs beam
- Testar beam vs projectile
- Testar domain clash (winner e bothFailed)

4. Antes de mudar audio:
- Testar botao MUSICA ON/OFF
- Testar domain clash com fundo ON e OFF

5. Sanity checks rapidos:
- `node --check frontend/app.js`
- `node --check frontend/battle-animations.js`
- `node --check frontend/clash-system.js`
- `php -l backend/web_api.php`
- `php -l backend/Personagem.php`
- `php -l backend/GameService/TurnExecution.php`

6. Validacao funcional minima:
- Partida normal sem clash
- Projectile clash
- Beam clash
- Domain clash
- Um personagem vencendo
- Caso Ubuntu que retorna ao setup

---

## 8) Observacoes de manutencao

- O projeto usa configuracao visual em PHP e execucao visual em JS.
- Isso significa que alteracoes em personagens (PHP) podem quebrar animacoes (JS) sem erro de compilacao.
- Sempre validar em runtime no browser, nao apenas lint/syntax.
- Existe historico de ajustes frequentes em beam/clash/audio; trate esses trechos como area de alta volatilidade.

---

## 9) Resumo operacional

- Backend decide regras, danos, ordem, clash e estado final.
- Frontend interpreta o estado e reproduz animacoes sincronizadas.
- Contratos JSON e campos `visual` sao o acoplamento principal.
- Se preservar contratos e invariantes acima, outra IA consegue iterar sem quebrar o jogo.
