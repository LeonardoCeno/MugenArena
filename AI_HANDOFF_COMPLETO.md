# MugenArena - Handoff Tecnico Completo para IA

## Objetivo
Este documento explica como o projeto funciona de ponta a ponta, com foco em:
- Arquitetura real do codigo atual
- Contratos de dados entre backend e frontend
- Fluxo de turno, clash (normal e QTE) e domain
- Estrutura visual/audio
- Regras que nao podem ser quebradas
- Checklist pratico para outra IA editar com seguranca

---

## 1) Estrutura atual do projeto

### Raiz
- `compose.yaml`: sobe app PHP+Apache em `:8080`.
- `Dockerfile`: imagem `php:8.4-apache`.
- `backend/`: regra de jogo e API HTTP.
- `frontend/`: SPA Vue 3 com Vite.

### Backend
- `backend/ExcecaoJogo.php`: excecoes de dominio (`ExcecaoJogo`, `EnergiaInsuficienteException`, `EntradaInvalidaException`).
- `backend/Personagem.php`: classe base com engine de combate e status.
- `backend/GameService.php`: facade principal que agrega traits.
- `backend/index.php`: modo CLI para testes manuais.
- `backend/web_api.php`: endpoint HTTP JSON.
- `backend/GameService/Helpers.php`: utilitarios de chave, domain e leitura de skill.
- `backend/GameService/GameSetup.php`: catalogo de classes, criacao de personagens e estado inicial.
- `backend/GameService/TurnOrder.php`: prioridade, velocidade, regras de order e cancel de domain.
- `backend/GameService/TurnExecution.php`: submissao/execucao de acoes, resolucao de rodada e clash QTE.
- `backend/GameService/StateExport.php`: serializacao do estado para o frontend.
- `backend/characters/*/*.php`: implementacoes dos personagens e configuracao visual por acao.

### Frontend (Vue 3 + Vite)
- `frontend/src/App.vue`: componente raiz — fases (`intro`, `setup`, `battle`), HUD de audio, tutorial.
- `frontend/src/components/IntroScreen.vue`: tela de abertura.
- `frontend/src/components/GameSetup.vue`: selecao de personagens + overlay de modo de clash.
- `frontend/src/components/BattleArena.vue`: arena de batalha, monta HUD, repassa eventos.
- `frontend/src/composables/useGame.js`: estado reativo global + toda logica de turno, clash e domain.
- `frontend/src/libs/battle-animations.js`: timeline de animacoes, overlays, projeteis, beams, domain VFX.
- `frontend/src/libs/clash-system.js`: logica visual do clash (overlap, freeze, vencedor continua, QTE hook).
- `frontend/src/libs/qte-system.js`: sistema de Quick Time Event para clash modo QTE.
- `frontend/src/libs/audio-controller.js`: BGM, audio de domain clash, fade, volume/mute.
- `frontend/src/libs/black-hole-animation.js`: transicao de entrada para tela de batalha.
- `frontend/src/batalha.css`: layout e todos os estilos (inclui `.clash-select-*`, `.qte-side-panel`, `.domain-clash-blackout`, etc).

---

## 2) Backend - modelo de estado e fluxo de API

### 2.1 Endpoint HTTP (`backend/web_api.php`)
Acoes aceitas via campo `action` no body JSON:

| action | descricao |
|---|---|
| `start` | Cria partida, salva em sessao |
| `state` | Retorna estado atual |
| `action` | Submete acao de um jogador |
| `resolve_clash` | Resolve clash QTE apos o frontend decidir o vencedor |
| `catalog` | Retorna personagens disponíveis |

**Resposta de `action`:**
```json
{
  "ok": true,
  "resolved": true,
  "clashQtePending": false,
  "resolucaoOrdem": ["p1", "p2"],
  "mensagensResolucao": ["..."],
  "estadoIntermediario": null,
  "domainCancel": null,
  "clash": { "occurred": true, "kind": "domain", "winner": "p1", "bothFailed": false, "durationMs": 1000 },
  "message": "...",
  "state": { ... }
}
```

**Resposta de `resolve_clash`:** mesmos campos, sem `clashQtePending`.

**Campo `clashQtePending`:** retornado como `true` quando ambos submeteram acoes que entrariam em clash e o `clashMode` e `qte`. Nesse caso `resolved` sera `false` e o frontend deve rodar o QTE antes de chamar `resolve_clash`.

---

### 2.2 Estado de jogo em sessao (`$_SESSION['game']`)
Criado por `GameSetup::criarEstadoDeJogo`:
- `p1`, `p2`: instancias de `Personagem`
- `turno`: inteiro
- `skipTurns`: `{ p1, p2 }`
- `pendingActions`: `{ p1, p2 }`
- `domain`: `{ turnsRemaining, casterKey }`
- `clashMode`: `'random'` ou `'qte'` — definido no `start` e preservado para a duracao da partida
- `pendingClash`: `{ kind: 'projectile'|'domain' }` — preenchido quando QTE e necessario; `null` no restante do tempo

Invariantes:
- `pendingActions` deve existir sempre para os dois lados.
- `clashMode` deve ser passado no `start` e nunca alterado depois.
- `pendingClash` deve ser `null` fora do fluxo QTE.

---

### 2.3 Classe base `Personagem`
- Desvio: `sorteouDesvio` = 10%
- Critico: `sorteouCritico` = 7%
- Defesa: reduz dano recebido em 50%
- Regeneracao de energia base por turno: 10
- `forcarAcertoNoProximoAtaque()`: seta `ignorarDesvioNoProximoAtaque` — usado no vencedor de projectile clash para evitar o bug de "ganhou clash mas errou por desvio".

---

### 2.4 Orquestracao de turno (`TurnExecution` + `TurnOrder`)

**Submissao (`GameService::submeterAcao`):**
1. Valida chave, estado, custo, energy, domain lock
2. Grava em `pendingActions`
3. Preenche auto-skip
4. Quando ambos preenchidos, chama `resolverRodada`

**`resolverRodada`** detecta clash QTE antes de qualquer outra resolucao:
- Se `clashMode === 'qte'` e ambas as acoes sao clashable com mesma prioridade → define `pendingClash` e retorna `qtePending: true`
- Caso contrario, resolve normalmente

**Gating de QTE por prioridade:**
- Se `$p1Priority === $p2Priority` (ambos true ou ambos false) → QTE dispara
- Se um tem prioridade e o outro nao → clash normal (ataque com priority ganha garantido, sem QTE)

**Clash normal (`resolverClash`):**
- `$forcedWinner !== null` → usa valor forcado; `'tie'` ou qualquer valor que nao seja `'p1'`/`'p2'` → `bothFailed = true`
- `$forcedWinner === null` → decide aleatoriamente via `decidirVencedorDoClash`

**Domain clash `bothFailed`:**
- Ambos recebem 20 de dano
- Avanca turno normalmente
- Retorna `clash.bothFailed = true` + `effectGif`

---

### 2.5 `resolverClashQTE` (web_api.php)
```
POST { action: 'resolve_clash', winnerKey: 'p1'|'p2'|'tie' }
```
- `'p1'` ou `'p2'` → vencedor forcado
- `'tie'` (ou qualquer valor invalido) → `bothFailed = true` → domain break ou resolucao de empate
- Chama `GameService::resolverClashQTE` → `resolverClashPendente` → `resolverClash` com o winner forcado
- Apos resolver, executa turnos skip encadeados se necessario

---

## 3) Frontend - ciclo principal

### 3.1 Fases (App.vue)
- `intro` → tela de abertura
- `setup` → selecao de personagens (`GameSetup.vue`)
- `battle` → arena (`BattleArena.vue`)

Transicao intro→setup: animacao CSS de 820ms.
Transicao setup→battle: anima buraco negro (`startBlackHoleAnimation`), depois monta `BattleArena`.

---

### 3.2 Selecao de modo de clash (`GameSetup.vue`)
- Ao clicar "INICIAR BATALHA", um overlay aparece com dois cards:
  - **SORTE** (`'random'`): vencedor do clash decidido por chance
  - **QTE** (`'qte'`): jogadores competem em Quick Time Event
- Ao escolher, emite `start-game` com `{ p1Name, p2Name, p1Class, p2Class, clashMode }`
- O overlay pode ser fechado clicando fora (cancela e volta para selecao)

---

### 3.3 Estado global (`useGame.js`)
```js
export const state = reactive({
  serverState: null,
  resolvendoAcao: false,
  actionPage: 0,
  anim: null,
  sprites: { p1, p2 },
  frameScale: { p1, p2 },
  pendingSprites: { p1, p2 },
  pendingFrameScale: { p1, p2 },
  domainImage: null,
  domainImageVersion: 0,
  arenaFundo: null,
  acaoPendente: null,
})
```

---

### 3.4 Ciclo de acao (`processarAcao` em useGame.js)

```
jogador escolhe acao
  → chamarApi('action', { playerKey, actionType, skillIndex })
  → resposta.clashQtePending?
      SIM → detectar kind ('projectile' ou 'domain')
            → kind === 'domain'  → executarTurnoDomainClashQTE(acoesMap)
            → kind === 'projectile' → executarTurnoClashQTE(acoesMap, null)
      NAO, resolved = false → guardar em acaoPendente, aguardar outro jogador
      NAO, resolved = true → clash.occurred?
                              SIM → clash.kind === 'domain' → executarTurnoDomainClash
                                  → clash.kind === 'projectile' → executarTurnoClash
                              NAO → tocarAnimacao em ordem
  → atualizarEstado + atualizarHUD + adicionarLog
```

BGM inicia com 2 segundos de atraso apos `iniciarPartida`:
```js
setTimeout(() => audio.playRandomBgm(), 2000)
```

---

### 3.5 Sistema de QTE (`qte-system.js`)

**Controles:**
- P1: `W A S D`
- P2: `← ↑ ↓ →`

**Mecanica:**
- 10 teclas por jogador, exibidas uma por vez
- Tecla atual (grande, pulsante, dourada) + preview da proxima (menor, opaca, deslocada a direita)
- Ao acertar: tecla atual sai para esquerda/some, proxima desliza para posicao central (Web Animations API, 160ms)
- Ao errar: painel treme (shake animation CSS)
- Nunca duas teclas consecutivas iguais na mesma sequencia
- Timer: 7000ms para clash de domain (5000ms para projectile clash)

**Resolucao:**
- Primeiro a completar 10 teclas → chama `tryFinish(winner)`
- Se outro completar dentro de 180ms → `finish('tie')` (empate)
- Timeout: mais progresso ganha; empate no timeout → `finish('tie')`
- `tie` → frontend envia `winnerKey: 'tie'` para o backend → `bothFailed = true`

**UI:**
- Dois paineis flutuantes laterais (`.qte-side-panel--p1` esquerda, `.qte-side-panel--p2` direita)
- Barra de tempo centralizada no topo (`.qte-top-bar`)
- Nao obstrui a colisao do centro

---

### 3.6 Clash de projetil QTE (`executarTurnoClashQTE`)

1. Monta animacoes de clash dos dois lados, sincroniza lancamento
2. Aguarda lancamento dos projeteis
3. Chama `clashSystem.runClashQTE` — congela projeteis na colisao, chama callback `onQTEReady(arenaEl)`
4. Dentro do callback: roda `qteSystem.runQTE(arenaEl, 5000)` → chama `resolve_clash`
5. `runClashQTE` aguarda 1 segundo apos vencedor decidido (colisao visual continua) e depois limpa
6. Projetil vencedor continua ao alvo com `postEvents`

---

### 3.7 Clash de domain QTE (`executarTurnoDomainClashQTE`)

1. `prepararDomainClash(acoesMap)`: aneis de clash, animacoes de expansao, split-screen dos dois domains, audio de clash
2. `qteSystem.runQTE(arenaEl, 7000)` — QTE sobre os paineis de domain
3. `chamarApi('resolve_clash', { winnerKey: winner })`

**Se `bothFailed` (empate):**
- `cleanupSplit()` imediato
- Audio faz fade em paralelo (nao bloqueia)
- GIF de domain break aparece imediatamente
- Texto flutuante "domain break" nos dois lados

**Se ha vencedor:**
- `mostrarTransicaoPosClashDeDomain(fadeOutMs=1200, fadeInMs=1200, holdMs=1000)`
  - Tela escurece em 1200ms
  - Fica escura por +1000ms (hold exclusivo do modo QTE)
  - Clareia em 1200ms
- Durante o escurecimento: troca estado (loser removido, `domainImage` do winner)
- Apos o hold (quando tela comeca a clarear): `winnerDeferredEvents` disparados — domain do vencedor comeca do zero
- Aguarda `blackoutPromise` + duracao dos eventos deferred
- `cancelarAnimacao`

**Comportamento garantido:** domain do vencedor nunca aparece antes da tela comecar a clarear. A tela fica 1 segundo mais escura que no modo normal para dramatismo.

---

### 3.8 Clash de domain normal (`executarTurnoDomainClash`)

1. `prepararDomainClash(acoesMap)`
2. Se `bothFailed`: aguarda 6s de confronto, fade do audio, cleanup, domain break
3. Se ha vencedor: aguarda `7000 - fadeOutMs`, inicia blackout (`fadeOut=1400, fadeIn=1400`), troca estado, dispara `winnerDeferredEvents`, aguarda `restanteMs`

---

### 3.9 `mostrarTransicaoPosClashDeDomain(fadeOutMs, fadeInMs, holdMs=0)`
- Cria overlay `.domain-clash-blackout`
- Fade para preto em `fadeOutMs`
- Permanece escuro por `holdMs` (novo parametro — usado apenas no modo QTE com holdMs=1000)
- Clareia em `fadeInMs`
- Promise resolve apos `fadeOutMs + holdMs + fadeInMs + 40ms`

---

### 3.10 Audio (`audio-controller.js`)
- BGM aleatoria em loop (`playRandomBgm`); inicia 2s apos inicio de partida
- Domain clash: audio proprio em loop (`playClashDomain`)
- Se BGM ON → audio de domain clash mutado
- `fadeOutClashDomain(ms)`: fade e stop do audio de clash
- `AUDIO_DOMAIN_BREAK`: constante importada para o som de quebra de domain

---

## 4) Contratos de dados

### 4.1 Request `start`
```json
{ "action": "start", "p1Class": "sukuna", "p1Name": "P1", "p2Class": "gojo", "p2Name": "P2", "clashMode": "qte" }
```

### 4.2 Request `action`
```json
{ "action": "action", "playerKey": "p1", "actionType": "skill", "skillIndex": 0 }
```

### 4.3 Request `resolve_clash`
```json
{ "action": "resolve_clash", "winnerKey": "p1" }
```
Valores validos de `winnerKey`: `"p1"`, `"p2"`, `"tie"` (qualquer outro → null → bothFailed)

### 4.4 Objeto `clash` na resposta
```json
{
  "occurred": true,
  "kind": "domain",
  "winner": "p1",
  "durationMs": 1000,
  "bothFailed": false,
  "damageEach": 20,
  "effectGif": "./assets/efeitos/domainbreak.gif"
}
```

### 4.5 Objeto `visual` de personagem
Vem de `getConfiguracaoVisual()` no PHP.
- `baseSprite`, `winImage`, `winMessage`, `dodgeSprite`, `errorSplash`
- `actions` por nome de skill: `frames`, `overlays`, `audio`, `domainAudio`, `domainImage`, `domainDelayMs`
- `reactions.defendingHit`

---

## 5) Personagens e regras (estado atual)

### Sukuna
- Stats: HP 300, ATK 25, EN 4000, VEL 70, regen 70
- Skills: Desmantelar (bleed), Kamino Fuga (projectile clashable priority + burn), Reverse Energy (cura), Domain (activatesDomain + domainClash + priority)

### Gojo
- Stats: HP 300, ATK 20, EN 1000, VEL 90, regen 50
- Skills: Azul, Vazio Roxo (projectile clashable priority), Reverse Energy, Domain (skipTurns 2, activatesDomain + domainClash + priority)

### Sans
- Stats: HP 1, ATK 1, EN 800, VEL 100, regen 0
- Mecanica especial: energia absorve dano antes do HP
- Skills: bluesoul, comecou, BADTIME (priority), eh eh (recupera energia)

### Ulquiorra
- Stats: HP 240, ATK 30, EN 400, VEL 80, regen 40
- Skills: Cero (beam), cero oscuras (beam clashable priority, beamTone `#003424`), Barrage (melee + bleed), Heal

### Miku
- Stats: HP 200, ATK 20, EN 500, VEL 75, regen 30
- Skills: MAGIC! (projectile clashable), Miku BEEAM (beam clashable priority, beamTone `#00f7ff`), MY VOICE, mikupower (cura)

### Labubu
- Stats: HP 300, ATK 20, EN 2067, VEL 55
- Skills: MorangodoAmor (projectile clashable priority), labuaura (cura)

### Profe
- Stats: HP 267, ATK 24, EN 500, VEL 60, regen 35
- Skills: Red bill (cura), Apelacao, VibeCode (projectile clashable), DOOCKER (domain com dano, skipTurns 1, activatesDomain + domainClash + priority)

### Ubuntu
- Stats: HP 999, ATK 10, EN 999, VEL 30
- `usaSomenteHabilidades = true`; fluxo de skill em 2 etapas (abrir terminal → ls)
- `retornaAoSetup('erro') = true`: encerra partida para setup

### UbuntuKiller
- Stats: HP 500, ATK 100, EN 1000, VEL 45, regen 0
- Energia absorve dano antes do HP
- Skill unica `ubuntubuxa` com prioridade

### Escanor
- Personagem mais recente (commit "escanor beta")
- Verificar arquivo em `backend/characters/escanor/` para stats e skills atuais

---

## 6) Pontos sensiveis (nao quebrar)

- Nao mudar nomes de chaves exportadas em `state` sem atualizar frontend.
- Nao remover `ultimoTipoDano` (quebra feedback visual de dano).
- Nao remover `availableActions` flat (menu depende).
- Nao mudar contrato de `clash` (frontend usa `kind`, `winner`, `durationMs`, `bothFailed`, `effectGif`).
- Nao remover `clashQtePending` da resposta de `action` (quebra todo o fluxo QTE).
- Nao mudar `pendingClash` sem atualizar `resolverClashPendente`.
- Nao quebrar regra de domain interrompido (chance 60% + penalidade 50% da energia).
- Nao alterar `forcarAcertoNoProximoAtaque` sem revisar projectile clash.
- Em clash beam-vs-beam, cuidado extremo com `BEAM_TOUCH_EARLY_MULTIPLIER` e `BEAM_FRONT_REACH_RATIO` no topo de `clash-system.js`.
- Em QTE, `tryFinish` com janela de 180ms e `finish('tie')` sao essenciais para detectar empate simultaneo.
- `mostrarTransicaoPosClashDeDomain` tem parametro `holdMs` — nao remover sem verificar usos no domain QTE.

---

## 7) Checklist para outra IA editar com seguranca

**Ler primeiro:**
- `backend/web_api.php` (rotas e contratos)
- `backend/GameService/TurnExecution.php` (clash, QTE gating, resolucao)
- `backend/GameService/StateExport.php` (o que o frontend recebe)
- `frontend/src/composables/useGame.js` (toda a logica do cliente)
- `frontend/src/libs/clash-system.js` (visual do clash e hook QTE)
- `frontend/src/libs/qte-system.js` (mecanica QTE)
- `frontend/src/libs/battle-animations.js` (animacoes e domain transition)

**Antes de mudar regra de combate:**
- Conferir impacto em `StateExport`
- Conferir impacto visual em `useGame.js` + `battle-animations.js`

**Antes de mudar clash:**
- Testar: projectile vs projectile (modo random e modo QTE)
- Testar: beam vs beam
- Testar: beam vs projectile
- Testar: domain clash winner (modo random e modo QTE)
- Testar: domain clash bothFailed (modo random e modo QTE — empate no QTE)
- Testar: clash com prioridades diferentes (um com priority, outro sem) → clash normal, sem QTE

**Antes de mudar audio:**
- Testar BGM ON/OFF
- Testar domain clash com fundo ON e OFF

**Sanity checks:**
```bash
node --check frontend/src/composables/useGame.js
node --check frontend/src/libs/battle-animations.js
node --check frontend/src/libs/clash-system.js
node --check frontend/src/libs/qte-system.js
php -l backend/web_api.php
php -l backend/GameService/TurnExecution.php
```

---

## 8) Fluxo QTE completo (resumo para referencia rapida)

```
[Usuario escolhe QTE no setup]
    ↓ clashMode: 'qte' enviado no 'start'
    ↓ backend salva clashMode no state da sessao

[Turno com clash clashavel, mesma prioridade nos dois lados]
    ↓ backend retorna: resolved=false, clashQtePending=true, clash.kind
    ↓ frontend detecta clashQtePending

    kind === 'projectile':
        projeteis lancados e sincronizados
        colisao detectada → projeteis congelados
        QTE panels aparecem sobre os lutadores (5000ms)
        vencedor/empate → resolve_clash({winnerKey})
        1s de delay → projeteis desbloqueados → vencedor continua

    kind === 'domain':
        animacao de expansao de domain
        split-screen dos dois domains
        QTE panels aparecem sobre os lutadores (7000ms)
        vencedor/empate → resolve_clash({winnerKey})

        se bothFailed:
            split cleanup → GIF de break imediatamente → audio fade paralelo

        se winner:
            blackout (1200ms escurecer + 1000ms hold + 1200ms clarear)
            durante hold: troca estado (loser removido, domain do winner)
            quando tela comeca a clarear: winnerDeferredEvents disparam
            domain do vencedor comeca do zero, sincronizado com o fade-in
```

---

## 9) Observacoes de manutencao

- O projeto usa configuracao visual em PHP e execucao visual em JS — alteracoes em personagens podem quebrar animacoes sem erro de compilacao. Validar sempre em runtime no browser.
- O frontend e Vue 3 com Vite. O arquivo de entrada e `frontend/index.html` (ou similar). Usar `npm run dev` para desenvolvimento.
- `useGame.js` e o unico lugar onde logica de jogo existe no cliente. Nao duplicar estado ou logica nos componentes Vue.
- Existe historico de ajustes frequentes em beam/clash/audio — trate esses trechos como area de alta volatilidade.
- `domainImageVersion` e um contador que forca o Vue a re-renderizar a imagem de domain mesmo quando o src nao muda.

---

## 10) Resumo operacional

- Backend decide regras, danos, ordem, clash e estado final.
- Frontend interpreta o estado e reproduz animacoes sincronizadas.
- No modo QTE, o frontend e co-responsavel pela decisao do clash: roda o mini-game e comunica o resultado via `resolve_clash`.
- Contratos JSON, campos `visual` e flag `clashQtePending` sao o acoplamento principal.
- Se preservar contratos e invariantes acima, outra IA consegue iterar sem quebrar o jogo.
