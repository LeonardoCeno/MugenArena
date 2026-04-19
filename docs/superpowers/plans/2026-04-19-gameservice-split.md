# GameService Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dividir `backend/GameService.php` em `backend/GameService/` com 6 arquivos por responsabilidade usando PHP Traits, sem alterar nenhuma interface pública.

**Architecture:** Cada grupo lógico vira um trait PHP. A classe `GameService` usa todos os traits via `use`. O arquivo original `backend/GameService.php` vira um proxy com um único `require_once`. `self::` em todos os métodos continua resolvendo para `GameService` normalmente.

**Tech Stack:** PHP 8+ com `declare(strict_types=1)`, traits estáticos, sem autoloader (require_once manual).

---

## Estrutura de Arquivos

```
backend/GameService/           ← pasta nova
├── Helpers.php                ← criar — trait GameHelpers
├── TurnOrder.php              ← criar — trait TurnOrder
├── TurnExecution.php          ← criar — trait TurnExecution
├── GameSetup.php              ← criar — trait GameSetup
├── StateExport.php            ← criar — trait GameStateExport
└── GameService.php            ← criar — classe GameService (API pública)
backend/GameService.php        ← modificar — vira proxy de 1 linha
```

---

### Task 1: Criar trait GameHelpers

**Files:**
- Create: `backend/GameService/Helpers.php`

- [ ] **Step 1: Criar o arquivo do trait**

```php
<?php

declare(strict_types=1);

trait GameHelpers
{
    private static function validarChave(?string $key): string {
        return $key === 'p2' ? 'p2' : 'p1';
    }

    private static function chaveOposta(string $key): string {
        return $key === 'p1' ? 'p2' : 'p1';
    }

    private static function jogadorPorChave(array $game, string $key): Personagem {
        return self::validarChave($key) === 'p1' ? $game['p1'] : $game['p2'];
    }

    private static function domainVazio(): array {
        return [
            'turnsRemaining' => 0,
            'casterKey'      => null,
        ];
    }

    private static function resetarDomain(array &$game): void {
        $game['domain'] = self::domainVazio();
    }

    private static function decrementarDomain(array &$game): void {
        $novo = (int)$game['domain']['turnsRemaining'] - 1;
        $game['domain']['turnsRemaining'] = $novo;
        if ($novo <= 0) {
            self::resetarDomain($game);
        }
    }

    private static function existeDomainAtivo(array $game): bool {
        return (int)($game['domain']['turnsRemaining'] ?? 0) > 0;
    }

    private static function metodoSkill(Personagem $current, ?int $skillIndex): ?string {
        if ($skillIndex === null) {
            return null;
        }

        $habilidades = $current->getHabilidades();
        if (!isset($habilidades[$skillIndex])) {
            return null;
        }

        $metodo = (string)($habilidades[$skillIndex]['metodo'] ?? '');
        return $metodo !== '' ? $metodo : null;
    }

    private static function habilidadeDaAcao(Personagem $p, array $acao): ?array {
        if (($acao['actionType'] ?? null) !== 'skill') {
            return null;
        }

        $skillIndex = $acao['skillIndex'] ?? null;
        $habilidades = $p->getHabilidades();
        if ($skillIndex === null || !isset($habilidades[$skillIndex])) {
            return null;
        }

        return $habilidades[$skillIndex];
    }

    private static function efeitosVazio(): array {
        return ['skipTurns' => 0, 'skipTurnsChance' => 0, 'activatesDomain' => false];
    }

    private static function efeitosDaSkill(?array $skill): array {
        if ($skill === null) {
            return self::efeitosVazio();
        }

        return [
            'skipTurns'       => (int)($skill['skipTurns'] ?? 0),
            'skipTurnsChance' => (int)($skill['skipTurnsChance'] ?? 0),
            'activatesDomain' => (bool)($skill['activatesDomain'] ?? false),
        ];
    }

    private static function aplicarParalisia(array &$game, string $casterKey, int $turnosToSkip, bool $activatesDomain): void {
        $targetKey = self::chaveOposta($casterKey);

        if ($turnosToSkip > 0) {
            $game['skipTurns'][$targetKey] = $turnosToSkip;
        }

        if ($activatesDomain) {
            $game['domain'] = [
                'turnsRemaining' => $turnosToSkip,
                'casterKey'      => $casterKey,
            ];
        }
    }
}
```

- [ ] **Step 2: Verificar sintaxe**

```bash
php -l backend/GameService/Helpers.php
```
Esperado: `No syntax errors detected in backend/GameService/Helpers.php`

- [ ] **Step 3: Commit**

```bash
git add backend/GameService/Helpers.php
git commit -m "refactor: add GameHelpers trait (internal utilities)"
```

---

### Task 2: Criar trait TurnOrder

**Files:**
- Create: `backend/GameService/TurnOrder.php`

- [ ] **Step 1: Criar o arquivo do trait**

```php
<?php

declare(strict_types=1);

trait TurnOrder
{
    private static function acaoTemPrioridadeBruta(Personagem $p, array $acao): bool {
        $tipo = $acao['actionType'];

        if ($tipo === 'skip') return false;
        if ($tipo === 'defend') return true;

        if ($tipo === 'skill') {
            $skillIndex  = $acao['skillIndex'] ?? null;
            $habilidades = $p->getHabilidades();
            if ($skillIndex !== null && isset($habilidades[$skillIndex])) {
                return (bool)($habilidades[$skillIndex]['priority'] ?? false);
            }
        }

        return false;
    }

    private static function acaoTemPrioridade(Personagem $p, array $acao): bool {
        if (self::acaoDeveExecutarPorUltimo($p, $acao)) {
            return false;
        }

        return self::acaoTemPrioridadeBruta($p, $acao);
    }

    private static function acaoEhClashavel(Personagem $p, array $acao): bool {
        $habilidade = self::habilidadeDaAcao($p, $acao);
        return (bool)($habilidade['clashable'] ?? false);
    }

    private static function acaoAtivaDomain(Personagem $p, array $acao): bool {
        $habilidade = self::habilidadeDaAcao($p, $acao);
        return (bool)($habilidade['activatesDomain'] ?? false);
    }

    private static function acaoPodeEntrarEmDomainClash(Personagem $p, array $acao): bool {
        $habilidade = self::habilidadeDaAcao($p, $acao);
        if ($habilidade === null) {
            return false;
        }

        return (bool)($habilidade['activatesDomain'] ?? false)
            && (bool)($habilidade['domainClash'] ?? false);
    }

    private static function acaoDeveExecutarPorUltimo(Personagem $p, array $acao): bool {
        return self::acaoAtivaDomain($p, $acao) && self::acaoTemPrioridadeBruta($p, $acao);
    }

    private static function obterPenalidadeEnergiaDeDomain(Personagem $p, array $acao): int {
        $habilidade = self::habilidadeDaAcao($p, $acao);
        if ($habilidade === null || !(bool)($habilidade['activatesDomain'] ?? false)) {
            return 0;
        }

        $custoEnergia = (int)($habilidade['energyCost'] ?? 0);
        return (int) ceil(max(0, $custoEnergia) * 0.5);
    }

    private static function aplicarPenalidadeEnergiaDeDomain(array &$game, string $playerKey, array $acao): void {
        $penalidade = self::obterPenalidadeEnergiaDeDomain($game[$playerKey], $acao);
        if ($penalidade <= 0) {
            return;
        }

        $game[$playerKey]->drenarEnergia($penalidade);
    }

    private static function acaoPodeAtingirOponente(Personagem $p, array $acao): bool {
        $tipo = $acao['actionType'] ?? null;

        if ($tipo === 'attack') {
            return true;
        }

        if ($tipo !== 'skill') {
            return false;
        }

        $habilidade = self::habilidadeDaAcao($p, $acao);
        return (bool)($habilidade['precisaAlvo'] ?? false);
    }

    private static function domainFoiInterrompido(array $game, string $attackerKey, string $defenderKey, int $vidaAntesDoAtaque): bool {
        $acaoDefensor = $game['pendingActions'][$defenderKey] ?? null;
        if ($acaoDefensor === null || !self::acaoAtivaDomain($game[$defenderKey], $acaoDefensor)) {
            return false;
        }

        $acaoAtacante = $game['pendingActions'][$attackerKey] ?? null;
        if ($acaoAtacante === null || !self::acaoPodeAtingirOponente($game[$attackerKey], $acaoAtacante)) {
            return false;
        }

        if ($game[$defenderKey]->getVidaAtual() >= $vidaAntesDoAtaque) {
            return false;
        }

        return random_int(1, 100) <= 60;
    }

    /**
     * Retorna true se p1 age antes de p2.
     * Regras: domains prioritários agem por último > prioridade > velocidade > aleatório.
     */
    private static function determinarOrdem(Personagem $p1, array $a1, Personagem $p2, array $a2): bool {
        $p1Last = self::acaoDeveExecutarPorUltimo($p1, $a1);
        $p2Last = self::acaoDeveExecutarPorUltimo($p2, $a2);

        if ($p1Last && !$p2Last) return false;
        if ($p2Last && !$p1Last) return true;

        $p1Prio = self::acaoTemPrioridade($p1, $a1);
        $p2Prio = self::acaoTemPrioridade($p2, $a2);

        if ($p1Prio && !$p2Prio) return true;
        if ($p2Prio && !$p1Prio) return false;

        if ($p1->getVelocidade() > $p2->getVelocidade()) return true;
        if ($p2->getVelocidade() > $p1->getVelocidade()) return false;

        return random_int(0, 1) === 1;
    }
}
```

- [ ] **Step 2: Verificar sintaxe**

```bash
php -l backend/GameService/TurnOrder.php
```
Esperado: `No syntax errors detected in backend/GameService/TurnOrder.php`

- [ ] **Step 3: Commit**

```bash
git add backend/GameService/TurnOrder.php
git commit -m "refactor: add TurnOrder trait (priority and speed system)"
```

---

### Task 3: Criar trait TurnExecution

**Files:**
- Create: `backend/GameService/TurnExecution.php`

- [ ] **Step 1: Criar o arquivo do trait**

```php
<?php

declare(strict_types=1);

trait TurnExecution
{
    /**
     * Preenche automaticamente a ação de jogadores paralisados com 'skip'.
     * Retorna true se algum skip foi preenchido.
     */
    private static function preencherAcoesSkip(array &$game): bool {
        $preencheu = false;
        foreach (['p1', 'p2'] as $key) {
            if ((int)($game['skipTurns'][$key] ?? 0) > 0 && $game['pendingActions'][$key] === null) {
                $game['pendingActions'][$key] = ['actionType' => 'skip', 'skillIndex' => null];
                $preencheu = true;
            }
        }
        return $preencheu;
    }

    public static function executarAcao(Personagem $current, Personagem $opponent, string $actionType, ?int $skillIndex = null, ?array $habilidade = null): string {
        if ($actionType === 'attack') {
            return $current->atacar($opponent);
        }

        if ($actionType === 'defend') {
            return $current->defender();
        }

        if ($actionType === 'skill') {
            if ($habilidade === null) {
                $habilidades = $current->getHabilidades();
                if ($skillIndex === null || !isset($habilidades[$skillIndex])) {
                    throw new EntradaInvalidaException();
                }
                $habilidade = $habilidades[$skillIndex];
            }

            $metodo      = (string)$habilidade['metodo'];
            $precisaAlvo = (bool)$habilidade['precisaAlvo'];

            return $precisaAlvo ? $current->$metodo($opponent) : $current->$metodo();
        }

        throw new EntradaInvalidaException();
    }

    /**
     * Executa uma ação pendente de um jogador e aplica efeitos de paralisia/domínio.
     * Retorna a mensagem resultante.
     */
    private static function executarAcaoPendente(array &$game, string $playerKey): string {
        $acao        = $game['pendingActions'][$playerKey];
        $player      = $game[$playerKey];
        $opponentKey = self::chaveOposta($playerKey);
        $opponent    = $game[$opponentKey];

        if ($acao['actionType'] === 'skip') {
            $game['skipTurns'][$playerKey] = max(0, (int)($game['skipTurns'][$playerKey] ?? 0) - 1);

            if ((int)($game['domain']['turnsRemaining'] ?? 0) > 0 && $game['domain']['casterKey'] !== $playerKey) {
                self::decrementarDomain($game);
            }

            return $player->getNome() . ' está paralisado e perdeu o turno.';
        }

        $habilidadeAtual = null;
        if ($acao['actionType'] === 'skill' && $acao['skillIndex'] !== null) {
            $habilidades     = $player->getHabilidades();
            $habilidadeAtual = $habilidades[$acao['skillIndex']] ?? null;
        }

        $efeitos  = self::efeitosDaSkill($habilidadeAtual);
        $mensagem = self::executarAcao($player, $opponent, $acao['actionType'], $acao['skillIndex'] ?? null, $habilidadeAtual);

        $turnosParalisados = $efeitos['skipTurns'];
        if ($efeitos['skipTurnsChance'] > 0 && random_int(1, 100) <= $efeitos['skipTurnsChance']) {
            $turnosParalisados = max($turnosParalisados, 1);
        }

        if ($turnosParalisados > 0 || $efeitos['activatesDomain']) {
            self::aplicarParalisia($game, $playerKey, $turnosParalisados, $efeitos['activatesDomain']);
        }

        return $mensagem;
    }

    private static function deveResetarJogo(Personagem $player, array $acao): bool {
        if ($acao['actionType'] !== 'skill') return false;
        $metodo = self::metodoSkill($player, $acao['skillIndex'] ?? null);
        return $metodo !== null && $player->retornaAoSetup($metodo);
    }

    private static function decidirVencedorDoClash(bool $p1HasPriority, bool $p2HasPriority, string $kind = 'projectile'): array {
        if ($kind === 'domain' && $p1HasPriority === $p2HasPriority) {
            $roll = random_int(1, 100);
            if ($roll <= 40) {
                return ['p1', 3000, false];
            }
            if ($roll <= 80) {
                return ['p2', 3000, false];
            }

            return [null, 3000, true];
        }

        if ($p1HasPriority && $p2HasPriority) {
            return [random_int(0, 1) === 0 ? 'p1' : 'p2', 3000, false];
        }

        if ($p1HasPriority) {
            return ['p1', 1000, false];
        }

        if ($p2HasPriority) {
            return ['p2', 1000, false];
        }

        return [random_int(0, 1) === 0 ? 'p1' : 'p2', 3000, false];
    }

    /**
     * Processa efeitos contínuos, avança o turno e reinicia ambos os jogadores.
     */
    private static function avancarTurno(array &$game): void {
        if ($game['p1']->estaVivo()) $game['p1']->processarEfeitosContinuosFimTurno();
        if ($game['p2']->estaVivo()) $game['p2']->processarEfeitosContinuosFimTurno();

        $game['turno']++;
        $game['pendingActions'] = ['p1' => null, 'p2' => null];
        $game['p1']->iniciarTurno();
        $game['p2']->iniciarTurno();
    }

    /**
     * Resolve um turno onde ambas as ações são clashable.
     * Apenas o vencedor executa sua ação; o perdedor é cancelado.
     * Retorna o array de resultado padrão + chave 'clash'.
     */
    private static function resolverClash(array &$game, array $a1, array $a2, string $kind): array {
        [$winnerKey, $durationMs, $bothFailed] = self::decidirVencedorDoClash(
            self::acaoTemPrioridadeBruta($game['p1'], $a1),
            self::acaoTemPrioridadeBruta($game['p2'], $a2),
            $kind
        );

        if ($bothFailed) {
            $game['p1']->receberDano(20);
            $game['p2']->receberDano(20);

            self::avancarTurno($game);

            self::aplicarPenalidadeEnergiaDeDomain($game, 'p1', $a1);
            self::aplicarPenalidadeEnergiaDeDomain($game, 'p2', $a2);

            return [
                'mensagem'            => 'Os dois domains colapsaram. Ambos sofreram 20 de dano.',
                'resetJogo'           => false,
                'resolucaoOrdem'      => [],
                'mensagensResolucao'  => ['Os dois domains colapsaram. Ambos sofreram 20 de dano.'],
                'estadoIntermediario' => null,
                'domainCancel'        => null,
                'clash' => [
                    'occurred'    => true,
                    'winner'      => null,
                    'durationMs'  => $durationMs,
                    'kind'        => $kind,
                    'bothFailed'  => true,
                    'damageEach'  => 20,
                    'effectGif'   => './assets/efeitos/domainbreak.gif',
                ],
            ];
        }

        $loserKey = $winnerKey === 'p1' ? 'p2' : 'p1';

        $mensagem = self::executarAcaoPendente($game, $winnerKey);
        $game['pendingActions'][$loserKey] = null;

        self::avancarTurno($game);

        return [
            'mensagem'            => $mensagem,
            'resetJogo'           => false,
            'resolucaoOrdem'      => [$winnerKey, $loserKey],
            'mensagensResolucao'  => [$mensagem],
            'estadoIntermediario' => null,
            'domainCancel'        => null,
            'clash' => [
                'occurred'   => true,
                'winner'     => $winnerKey,
                'durationMs' => $durationMs,
                'kind'       => $kind,
                'bothFailed' => false,
            ],
        ];
    }

    /**
     * Executa as duas ações pendentes em ordem (prioridade + velocidade),
     * processa efeitos contínuos, avança o turno.
     * Retorna ['mensagem' => string, 'resetJogo' => bool].
     */
    private static function executarTurnoSimultaneo(array &$game): array {
        $a1 = $game['pendingActions']['p1'];
        $a2 = $game['pendingActions']['p2'];

        // Domain clash: ambos ativaram domínio — apenas o vencedor age
        if (self::acaoPodeEntrarEmDomainClash($game['p1'], $a1) && self::acaoPodeEntrarEmDomainClash($game['p2'], $a2)) {
            return self::resolverClash($game, $a1, $a2, 'domain');
        }

        // Projectile clash: ambos usaram skills clashable — apenas o vencedor age
        if (self::acaoEhClashavel($game['p1'], $a1) && self::acaoEhClashavel($game['p2'], $a2)) {
            return self::resolverClash($game, $a1, $a2, 'projectile');
        }

        $p1First        = self::determinarOrdem($game['p1'], $a1, $game['p2'], $a2);
        $firstKey       = $p1First ? 'p1' : 'p2';
        $secondKey      = $p1First ? 'p2' : 'p1';
        $resolucaoOrdem = [$firstKey, $secondKey];

        $mensagens           = [];
        $resetJogo           = false;
        $estadoIntermediario = null;

        $vidaSegundoAntesDoPrimeiroAtaque = $game[$secondKey]->getVidaAtual();
        $msg1 = self::executarAcaoPendente($game, $firstKey);
        $mensagens[] = $msg1;

        if (self::deveResetarJogo($game[$firstKey], $game['pendingActions'][$firstKey])) {
            $resetJogo = true;
        }

        $domainCancelado = false;
        if (self::determinarVencedor($game) === null && self::domainFoiInterrompido($game, $firstKey, $secondKey, $vidaSegundoAntesDoPrimeiroAtaque)) {
            $domainCancelado = true;
            $mensagens[] = $game[$secondKey]->getNome() . ' teve o domain cancelado ao ser interrompido antes da execução.';
            $resolucaoOrdem = [$firstKey];
        }

        if (self::determinarVencedor($game) !== null) {
            $resolucaoOrdem = [$firstKey];
        }

        if (!$domainCancelado && self::determinarVencedor($game) === null) {
            $estadoIntermediario = self::exportarEstado($game);

            $msg2 = self::executarAcaoPendente($game, $secondKey);
            $mensagens[] = $msg2;

            if (self::deveResetarJogo($game[$secondKey], $game['pendingActions'][$secondKey])) {
                $resetJogo = true;
            }
        }

        self::avancarTurno($game);

        if ($domainCancelado) {
            $acaoCancelada = $secondKey === 'p1' ? $a1 : $a2;
            self::aplicarPenalidadeEnergiaDeDomain($game, $secondKey, $acaoCancelada);
        }

        return [
            'mensagem'            => implode(' ', array_filter($mensagens)),
            'resetJogo'           => $resetJogo,
            'resolucaoOrdem'      => $resolucaoOrdem,
            'mensagensResolucao'  => $mensagens,
            'estadoIntermediario' => $estadoIntermediario,
            'domainCancel'        => $domainCancelado ? [
                'cancelled' => true,
                'playerKey' => $secondKey,
                'text'      => 'domain failed',
            ] : null,
            'clash'               => null,
        ];
    }

    /**
     * Resolve a rodada completa (incluindo turnos auto-skip encadeados).
     * Retorna ['mensagem' => string, 'resetJogo' => bool].
     */
    private static function resolverRodada(array &$game): array {
        $mensagens = [];
        $resetJogo = false;

        $resultado           = self::executarTurnoSimultaneo($game);
        $mensagens[]         = $resultado['mensagem'];
        $resolucaoOrdem      = $resultado['resolucaoOrdem'];
        $estadoIntermediario = $resultado['estadoIntermediario'];
        $clashResultado      = $resultado['clash'] ?? null;
        if ($resultado['resetJogo']) {
            $resetJogo = true;
        }

        // Se ambos ficaram paralisados após o turno, resolve automaticamente
        $seguranca = 0;
        while (self::determinarVencedor($game) === null && $seguranca < 6) {
            self::preencherAcoesSkip($game);

            if ($game['pendingActions']['p1'] === null || $game['pendingActions']['p2'] === null) {
                break;
            }

            $resultado = self::executarTurnoSimultaneo($game);
            $mensagens[] = $resultado['mensagem'];
            if ($resultado['resetJogo']) {
                $resetJogo = true;
            }
            $seguranca++;
        }

        return [
            'mensagem'            => implode(' ', array_filter($mensagens)),
            'resetJogo'           => $resetJogo,
            'resolucaoOrdem'      => $resolucaoOrdem,
            'mensagensResolucao'  => $resultado['mensagensResolucao'] ?? [],
            'estadoIntermediario' => $estadoIntermediario,
            'domainCancel'        => $resultado['domainCancel'] ?? null,
            'clash'               => $clashResultado,
        ];
    }
}
```

- [ ] **Step 2: Verificar sintaxe**

```bash
php -l backend/GameService/TurnExecution.php
```
Esperado: `No syntax errors detected in backend/GameService/TurnExecution.php`

- [ ] **Step 3: Commit**

```bash
git add backend/GameService/TurnExecution.php
git commit -m "refactor: add TurnExecution trait (auto-skip, clash, turn resolution)"
```

---

### Task 4: Criar trait GameSetup

**Files:**
- Create: `backend/GameService/GameSetup.php`

- [ ] **Step 1: Criar o arquivo do trait**

```php
<?php

declare(strict_types=1);

trait GameSetup
{
    public static function mapaDeClasses(): array {
        return [
            'sukuna'       => Sukuna::class,
            'gojo'         => Gojo::class,
            'sans'         => Sans::class,
            'ulquiorra'    => Ulquiorra::class,
            'miku'         => Miku::class,
            'labubu'       => Labubu::class,
            'ubuntu'       => Ubuntu::class,
            'ubuntukiller' => UbuntuKiller::class,
            'profe'        => Profe::class,
        ];
    }

    public static function catalogoDePersonagens(): array {
        $catalogo = [];
        foreach (self::mapaDeClasses() as $key => $className) {
            $personagem = new $className('_');
            $visual = $personagem->getConfiguracaoVisual();
            $catalogo[] = [
                'key'          => $key,
                'label'        => $personagem->getClasseNome(),
                'velocidade'   => $personagem->getVelocidade(),
                'selectSprite' => $visual['selectSprite'] ?? $visual['baseSprite'] ?? null,
            ];
        }
        return $catalogo;
    }

    public static function criarPersonagem(string $classKey, string $nome): Personagem {
        $normalizedKey = strtolower(trim($classKey));
        $className = self::mapaDeClasses()[$normalizedKey] ?? null;

        if ($className === null) {
            throw new EntradaInvalidaException();
        }

        $nome = trim($nome);
        if ($nome === '') {
            $nome = 'Jogador';
        }

        return new $className($nome);
    }

    public static function criarEstadoDeJogo(Personagem $p1, Personagem $p2): array {
        $game = [
            'p1'             => $p1,
            'p2'             => $p2,
            'turno'          => 1,
            'skipTurns'      => ['p1' => 0, 'p2' => 0],
            'pendingActions' => ['p1' => null, 'p2' => null],
            'domain'         => self::domainVazio(),
        ];

        self::preencherAcoesSkip($game);

        return $game;
    }
}
```

- [ ] **Step 2: Verificar sintaxe**

```bash
php -l backend/GameService/GameSetup.php
```
Esperado: `No syntax errors detected in backend/GameService/GameSetup.php`

- [ ] **Step 3: Commit**

```bash
git add backend/GameService/GameSetup.php
git commit -m "refactor: add GameSetup trait (character creation and game state init)"
```

---

### Task 5: Criar trait GameStateExport

**Files:**
- Create: `backend/GameService/StateExport.php`

- [ ] **Step 1: Criar o arquivo do trait**

```php
<?php

declare(strict_types=1);

trait GameStateExport
{
    public static function acoesDisponiveis(Personagem $current, bool $jaSubmeteu = false, bool $domainAtivo = false): array {
        if ($jaSubmeteu) {
            return [];
        }

        $descricoes = $current->getDescricoesAcoes();
        $actions    = [];

        if (!$current->usaSomenteHabilidades()) {
            $actions[] = [
                'type'            => 'attack',
                'label'           => 'ATACAR',
                'skillName'       => 'Ataque',
                'description'     => (string)($descricoes['Ataque'] ?? ''),
                'targetsOpponent' => true,
                'energyCost'      => 0,
                'disabled'        => false,
                'melee'           => true,
                'priority'        => false,
                'activatesDomain' => false,
                'domainClash'     => false,
            ];
            $actions[] = [
                'type'            => 'defend',
                'label'           => 'DEFENDER',
                'skillName'       => 'Defesa',
                'description'     => (string)($descricoes['Defesa'] ?? ''),
                'targetsOpponent' => false,
                'energyCost'      => 0,
                'disabled'        => false,
                'priority'        => true,
                'activatesDomain' => false,
                'domainClash'     => false,
            ];
        }

        foreach ($current->getHabilidades() as $index => $habilidade) {
            $custoEnergia = (int)($habilidade['energyCost'] ?? 0);
            $bloqueadaPorDomain = $domainAtivo && (bool)($habilidade['activatesDomain'] ?? false);
            $actions[] = [
                'type'            => 'skill',
                'label'           => strtoupper((string)$habilidade['nome']),
                'skillName'       => (string)$habilidade['nome'],
                'description'     => (string)($descricoes[(string)$habilidade['nome']] ?? ''),
                'skillIndex'      => $index,
                'targetsOpponent' => (bool)$habilidade['precisaAlvo'],
                'energyCost'      => $custoEnergia,
                'disabled'        => $current->getEnergiaAtual() < $custoEnergia || $bloqueadaPorDomain,
                'melee'           => (bool)($habilidade['melee'] ?? false),
                'priority'        => (bool)($habilidade['priority'] ?? false),
                'activatesDomain' => (bool)($habilidade['activatesDomain'] ?? false),
                'domainClash'     => (bool)($habilidade['domainClash'] ?? false),
            ];
        }

        return $actions;
    }

    public static function exportarPersonagem(Personagem $character, string $label): array {
        return array_merge([
            'label'          => $label,
            'nome'           => $character->getNome(),
            'classe'         => $character->getClasse(),
            'classeNome'     => $character->getClasseNome(),
            'velocidade'     => $character->getVelocidade(),
            'vidaAtual'      => $character->getVidaAtual(),
            'vidaMaxima'     => $character->getVidaMaxima(),
            'energiaAtual'   => $character->getEnergiaAtual(),
            'energiaMaxima'  => $character->getEnergiaMaxima(),
            'ultimoTipoDano' => $character->getUltimoTipoDano(),
            'defendendo'     => $character->estaDefendendo(),
            'bleedTurnos'    => $character->getSangramentoTurnos(),
            'burnTurnos'     => $character->getQueimaduraTurnos(),
            'visual'         => $character->getConfiguracaoVisual(),
        ], $character->getEstadoExtra());
    }

    public static function exportarEstado(array $game, ?string $mensagem = null): array {
        $vencedor   = self::determinarVencedor($game);
        $waitingFor = [];

        foreach (['p1', 'p2'] as $key) {
            if ($game['pendingActions'][$key] === null) {
                $waitingFor[] = $key;
            }
        }

        $p1Submeteu = $game['pendingActions']['p1'] !== null;
        $p2Submeteu = $game['pendingActions']['p2'] !== null;

        // currentKey = quem ainda precisa escolher (compat com frontend)
        $currentKey = count($waitingFor) > 0 ? $waitingFor[0] : null;

        $availableActionsFlat = [];
        $domainAtivo = self::existeDomainAtivo($game);
        if (!$vencedor && $currentKey !== null) {
            $availableActionsFlat = self::acoesDisponiveis($game[$currentKey], false, $domainAtivo);
        }

        return [
            'started'              => true,
            'turno'                => (int)$game['turno'],
            'currentKey'           => $currentKey,
            'winner'               => $vencedor,
            'waitingFor'           => $waitingFor,
            'p1Submeteu'           => $p1Submeteu,
            'p2Submeteu'           => $p2Submeteu,
            'domainTurnsRemaining' => (int)($game['domain']['turnsRemaining'] ?? 0),
            'domainCasterKey'      => $game['domain']['casterKey'] ?? null,
            'p1'                   => self::exportarPersonagem($game['p1'], 'Jogador 1'),
            'p2'                   => self::exportarPersonagem($game['p2'], 'Jogador 2'),
            'availableActions'     => $availableActionsFlat,
            'availableActionsPorJogador' => $vencedor ? [] : [
                'p1' => self::acoesDisponiveis($game['p1'], $p1Submeteu, $domainAtivo),
                'p2' => self::acoesDisponiveis($game['p2'], $p2Submeteu, $domainAtivo),
            ],
            'message'              => $mensagem,
        ];
    }
}
```

- [ ] **Step 2: Verificar sintaxe**

```bash
php -l backend/GameService/StateExport.php
```
Esperado: `No syntax errors detected in backend/GameService/StateExport.php`

- [ ] **Step 3: Commit**

```bash
git add backend/GameService/StateExport.php
git commit -m "refactor: add GameStateExport trait (state serialization and available actions)"
```

---

### Task 6: Criar GameService/GameService.php (classe principal)

**Files:**
- Create: `backend/GameService/GameService.php`

- [ ] **Step 1: Criar a classe principal com os traits e a API pública**

```php
<?php

declare(strict_types=1);

require_once __DIR__ . '/../Personagem.php';
require_once __DIR__ . '/../characters/sukuna/Sukuna.php';
require_once __DIR__ . '/../characters/gojo/Gojo.php';
require_once __DIR__ . '/../characters/sans/Sans.php';
require_once __DIR__ . '/../characters/ulquiorra/Ulquiorra.php';
require_once __DIR__ . '/../characters/miku/Miku.php';
require_once __DIR__ . '/../characters/ubuntu/Ubuntu.php';
require_once __DIR__ . '/../characters/ubuntukiller/UbuntuKiller.php';
require_once __DIR__ . '/../characters/labubu/Labubu.php';
require_once __DIR__ . '/../characters/profe/Profe.php';

require_once __DIR__ . '/Helpers.php';
require_once __DIR__ . '/TurnOrder.php';
require_once __DIR__ . '/TurnExecution.php';
require_once __DIR__ . '/GameSetup.php';
require_once __DIR__ . '/StateExport.php';

class GameService {
    use GameHelpers, TurnOrder, TurnExecution, GameSetup, GameStateExport;

    public static function determinarVencedor(array $game): ?string {
        if (!$game['p1']->estaVivo()) return 'p2';
        if (!$game['p2']->estaVivo()) return 'p1';
        return null;
    }

    /**
     * Submete a ação de um jogador para o turno atual.
     * Quando ambos submetem, o turno é resolvido automaticamente.
     *
     * Retorna:
     *   ['resolved' => false, 'mensagem' => null,    'resetJogo' => false] — aguardando o outro
     *   ['resolved' => true,  'mensagem' => string,  'resetJogo' => bool]  — turno resolvido
     */
    public static function submeterAcao(array &$game, string $playerKey, string $actionType, ?int $skillIndex = null): array {
        $playerKey = self::validarChave($playerKey);

        if (self::determinarVencedor($game) !== null) {
            throw new EntradaInvalidaException();
        }

        if ($game['pendingActions'][$playerKey] !== null) {
            throw new EntradaInvalidaException();
        }

        $player = $game[$playerKey];

        if ($actionType === 'skill') {
            $habilidades = $player->getHabilidades();
            if ($skillIndex === null || !isset($habilidades[$skillIndex])) {
                throw new EntradaInvalidaException();
            }

            if (self::existeDomainAtivo($game) && (bool)($habilidades[$skillIndex]['activatesDomain'] ?? false)) {
                throw new EntradaInvalidaException();
            }

            $custo = (int)($habilidades[$skillIndex]['energyCost'] ?? 0);
            if ($custo > 0 && $player->getEnergiaAtual() < $custo) {
                throw new EntradaInvalidaException();
            }
        }

        $game['pendingActions'][$playerKey] = [
            'actionType' => $actionType,
            'skillIndex' => $skillIndex,
        ];

        self::preencherAcoesSkip($game);

        if ($game['pendingActions']['p1'] !== null && $game['pendingActions']['p2'] !== null) {
            $resultado = self::resolverRodada($game);
            return [
                'resolved'            => true,
                'mensagem'            => $resultado['mensagem'],
                'resetJogo'           => $resultado['resetJogo'],
                'resolucaoOrdem'      => $resultado['resolucaoOrdem'],
                'mensagensResolucao'  => $resultado['mensagensResolucao'] ?? [],
                'estadoIntermediario' => $resultado['estadoIntermediario'],
                'domainCancel'        => $resultado['domainCancel'] ?? null,
                'clash'               => $resultado['clash'] ?? null,
            ];
        }

        return ['resolved' => false, 'mensagem' => null, 'resetJogo' => false];
    }

    public static function retornaAoSetup(array $game, string $playerKey, string $actionType, ?int $skillIndex = null): bool {
        if ($actionType !== 'skill') {
            return false;
        }

        $player = self::jogadorPorChave($game, $playerKey);
        $metodo = self::metodoSkill($player, $skillIndex);

        return $metodo !== null && $player->retornaAoSetup($metodo);
    }
}
```

- [ ] **Step 2: Verificar sintaxe**

```bash
php -l backend/GameService/GameService.php
```
Esperado: `No syntax errors detected in backend/GameService/GameService.php`

- [ ] **Step 3: Commit**

```bash
git add backend/GameService/GameService.php
git commit -m "refactor: add GameService main class with trait composition"
```

---

### Task 7: Atualizar proxy e verificar funcionamento

**Files:**
- Modify: `backend/GameService.php`

- [ ] **Step 1: Substituir conteúdo do GameService.php original pelo proxy**

Substituir todo o conteúdo de `backend/GameService.php` por:

```php
<?php

declare(strict_types=1);

require_once __DIR__ . '/GameService/GameService.php';
```

- [ ] **Step 2: Verificar sintaxe do proxy**

```bash
php -l backend/GameService.php
```
Esperado: `No syntax errors detected in backend/GameService.php`

- [ ] **Step 3: Verificar que web_api.php carrega sem erros**

```bash
php -r "
require_once 'backend/GameService.php';
\$p1 = GameService::criarPersonagem('sukuna', 'Teste1');
\$p2 = GameService::criarPersonagem('gojo', 'Teste2');
\$game = GameService::criarEstadoDeJogo(\$p1, \$p2);
\$estado = GameService::exportarEstado(\$game);
echo 'turno=' . \$estado['turno'] . PHP_EOL;
echo 'p1=' . \$estado['p1']['classe'] . PHP_EOL;
echo 'p2=' . \$estado['p2']['classe'] . PHP_EOL;
echo 'OK' . PHP_EOL;
"
```
Esperado:
```
turno=1
p1=sukuna
p2=gojo
OK
```

- [ ] **Step 4: Testar submissão de ação**

```bash
php -r "
require_once 'backend/GameService.php';
\$p1 = GameService::criarPersonagem('sukuna', 'Teste1');
\$p2 = GameService::criarPersonagem('gojo', 'Teste2');
\$game = GameService::criarEstadoDeJogo(\$p1, \$p2);
GameService::submeterAcao(\$game, 'p1', 'attack');
\$resultado = GameService::submeterAcao(\$game, 'p2', 'attack');
echo 'resolved=' . (\$resultado['resolved'] ? 'true' : 'false') . PHP_EOL;
echo 'mensagem=' . \$resultado['mensagem'] . PHP_EOL;
echo 'OK' . PHP_EOL;
"
```
Esperado: `resolved=true`, mensagem com texto de ataque, `OK` no final.

- [ ] **Step 5: Testar catálogo de personagens**

```bash
php -r "
require_once 'backend/GameService.php';
\$catalogo = GameService::catalogoDePersonagens();
echo 'total=' . count(\$catalogo) . PHP_EOL;
echo 'primeiro=' . \$catalogo[0]['key'] . PHP_EOL;
echo 'OK' . PHP_EOL;
"
```
Esperado: `total=9`, `primeiro=sukuna`, `OK`.

- [ ] **Step 6: Commit final**

```bash
git add backend/GameService.php
git commit -m "refactor: convert GameService.php to proxy — logic split into GameService/ folder"
```
