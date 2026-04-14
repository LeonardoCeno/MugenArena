<?php

declare(strict_types=1);

require_once __DIR__ . '/Personagem.php';
require_once __DIR__ . '/characters/sukuna/Sukuna.php';
require_once __DIR__ . '/characters/gojo/Gojo.php';
require_once __DIR__ . '/characters/sans/Sans.php';
require_once __DIR__ . '/characters/ulquiorra/Ulquiorra.php';
require_once __DIR__ . '/characters/miku/Miku.php';
require_once __DIR__ . '/characters/ubuntu/Ubuntu.php';
require_once __DIR__ . '/characters/ubuntukiller/UbuntuKiller.php';
require_once __DIR__ . '/characters/labubu/Labubu.php';
require_once __DIR__ . '/characters/profe/Profe.php';

class GameService {

    // ── Helpers internos ─────────────────────────────────────────────────

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

    // ── Ordem de turno (sistema de prioridade + velocidade) ──────────────

    private static function acaoTemPrioridade(Personagem $p, array $acao): bool {
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

    private static function acaoEhClashavel(Personagem $p, array $acao): bool {
        $habilidade = self::habilidadeDaAcao($p, $acao);
        return (bool)($habilidade['clashable'] ?? false);
    }

    private static function acaoAtivaDomain(Personagem $p, array $acao): bool {
        $habilidade = self::habilidadeDaAcao($p, $acao);
        return (bool)($habilidade['activatesDomain'] ?? false);
    }

    private static function decidirVencedorDoClash(bool $p1HasPriority, bool $p2HasPriority): array {
        if ($p1HasPriority && $p2HasPriority) {
            return [random_int(0, 1) === 0 ? 'p1' : 'p2', 3000];
        }

        if ($p1HasPriority) {
            return ['p1', 1000];
        }

        if ($p2HasPriority) {
            return ['p2', 1000];
        }

        return [random_int(0, 1) === 0 ? 'p1' : 'p2', 3000];
    }

    /**
     * Resolve um turno onde ambas as ações são clashable.
     * Apenas o vencedor executa sua ação; o perdedor é cancelado.
     * Retorna o array de resultado padrão + chave 'clash'.
     */
    private static function resolverClash(array &$game, array $a1, array $a2, string $kind): array {
        [$winnerKey, $durationMs] = self::decidirVencedorDoClash(
            self::acaoTemPrioridade($game['p1'], $a1),
            self::acaoTemPrioridade($game['p2'], $a2)
        );

        $loserKey = $winnerKey === 'p1' ? 'p2' : 'p1';

        // Execute only winner's action
        $mensagem = self::executarAcaoPendente($game, $winnerKey);

        // Clear loser without executing
        $game['pendingActions'][$loserKey] = null;

        // Continuous effects, turn advance, energy regen
        if ($game['p1']->estaVivo()) $game['p1']->processarEfeitosContinuosFimTurno();
        if ($game['p2']->estaVivo()) $game['p2']->processarEfeitosContinuosFimTurno();

        $game['turno']++;
        $game['pendingActions'] = ['p1' => null, 'p2' => null];
        $game['p1']->iniciarTurno();
        $game['p2']->iniciarTurno();

        return [
            'mensagem'            => $mensagem,
            'resetJogo'           => false,
            'resolucaoOrdem'      => [$winnerKey, $loserKey],
            'mensagensResolucao'  => [$mensagem],
            'estadoIntermediario' => null,
            'clash' => [
                'occurred'   => true,
                'winner'     => $winnerKey,
                'durationMs' => $durationMs,
                'kind'       => $kind,
            ],
        ];
    }

    /**
     * Retorna true se p1 age antes de p2.
     * Regras: prioridade > velocidade > aleatório.
     */
    private static function determinarOrdem(Personagem $p1, array $a1, Personagem $p2, array $a2): bool {
        $p1Prio = self::acaoTemPrioridade($p1, $a1);
        $p2Prio = self::acaoTemPrioridade($p2, $a2);

        if ($p1Prio && !$p2Prio) return true;
        if ($p2Prio && !$p1Prio) return false;

        if ($p1->getVelocidade() > $p2->getVelocidade()) return true;
        if ($p2->getVelocidade() > $p1->getVelocidade()) return false;

        return random_int(0, 1) === 1;
    }

    // ── Auto-skip ────────────────────────────────────────────────────────

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

    // ── Execução de uma ação individual ─────────────────────────────────

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
        $acao       = $game['pendingActions'][$playerKey];
        $player     = $game[$playerKey];
        $opponentKey = self::chaveOposta($playerKey);
        $opponent   = $game[$opponentKey];

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

    // ── Resolução do turno simultâneo ────────────────────────────────────

    /**
     * Executa as duas ações pendentes em ordem (prioridade + velocidade),
     * processa efeitos contínuos, avança o turno.
     * Retorna ['mensagem' => string, 'resetJogo' => bool].
     */
    private static function executarTurnoSimultaneo(array &$game): array {
        $a1 = $game['pendingActions']['p1'];
        $a2 = $game['pendingActions']['p2'];

        // Domain clash: ambos ativaram domínio — apenas o vencedor age
        if (self::acaoAtivaDomain($game['p1'], $a1) && self::acaoAtivaDomain($game['p2'], $a2)) {
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

        $mensagens          = [];
        $resetJogo          = false;
        $estadoIntermediario = null;

        // Primeiro a agir
        $msg1 = self::executarAcaoPendente($game, $firstKey);
        $mensagens[] = $msg1;

        // Checa reset (Ubuntu sudo apt install)
        if (self::deveResetarJogo($game[$firstKey], $game['pendingActions'][$firstKey])) {
            $resetJogo = true;
        }

        // Segundo só age se o jogo não acabou
        if (self::determinarVencedor($game) === null) {
            // Snapshot do estado após o 1º ataque (antes do 2º)
            $estadoIntermediario = self::exportarEstado($game);

            $msg2 = self::executarAcaoPendente($game, $secondKey);
            $mensagens[] = $msg2;

            if (self::deveResetarJogo($game[$secondKey], $game['pendingActions'][$secondKey])) {
                $resetJogo = true;
            }
        }

        // Efeitos contínuos (sangramento/queimadura) ao fim do turno
        if ($game['p1']->estaVivo()) {
            $game['p1']->processarEfeitosContinuosFimTurno();
        }
        if ($game['p2']->estaVivo()) {
            $game['p2']->processarEfeitosContinuosFimTurno();
        }

        // Avança turno e regenera energia
        $game['turno']++;
        $game['pendingActions'] = ['p1' => null, 'p2' => null];

        $game['p1']->iniciarTurno();
        $game['p2']->iniciarTurno();

        return [
            'mensagem'           => implode(' ', array_filter($mensagens)),
            'resetJogo'          => $resetJogo,
            'resolucaoOrdem'     => $resolucaoOrdem,
            'mensagensResolucao' => $mensagens,
            'estadoIntermediario' => $estadoIntermediario,
            'clash'              => null,
        ];
    }

    private static function deveResetarJogo(Personagem $player, array $acao): bool {
        if ($acao['actionType'] !== 'skill') return false;
        $metodo = self::metodoSkill($player, $acao['skillIndex'] ?? null);
        return $metodo !== null && $player->retornaAoSetup($metodo);
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
            'mensagem'           => implode(' ', array_filter($mensagens)),
            'resetJogo'          => $resetJogo,
            'resolucaoOrdem'     => $resolucaoOrdem,
            'mensagensResolucao' => $resultado['mensagensResolucao'] ?? [],
            'estadoIntermediario' => $estadoIntermediario,
            'clash'              => $clashResultado,
        ];
    }

    // ── Setup ────────────────────────────────────────────────────────────

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

        // Auto-fill skip se algum começar paralisado (improvável, mas seguro)
        self::preencherAcoesSkip($game);

        return $game;
    }

    // ── API pública de jogo ──────────────────────────────────────────────

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

        // Já submeteu neste turno
        if ($game['pendingActions'][$playerKey] !== null) {
            throw new EntradaInvalidaException();
        }

        $player = $game[$playerKey];

        // Valida skill
        if ($actionType === 'skill') {
            $habilidades = $player->getHabilidades();
            if ($skillIndex === null || !isset($habilidades[$skillIndex])) {
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

        // Preenche skip do oponente se necessário
        self::preencherAcoesSkip($game);

        // Se ambos prontos, resolve
        if ($game['pendingActions']['p1'] !== null && $game['pendingActions']['p2'] !== null) {
            $resultado = self::resolverRodada($game);
            return [
                'resolved'           => true,
                'mensagem'           => $resultado['mensagem'],
                'resetJogo'          => $resultado['resetJogo'],
                'resolucaoOrdem'     => $resultado['resolucaoOrdem'],
                'mensagensResolucao' => $resultado['mensagensResolucao'] ?? [],
                'estadoIntermediario' => $resultado['estadoIntermediario'],
                'clash'              => $resultado['clash'] ?? null,
            ];
        }

        return ['resolved' => false, 'mensagem' => null, 'resetJogo' => false];
    }

    public static function acoesDisponiveis(Personagem $current, bool $jaSubmeteu = false): array {
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
            ];
        }

        foreach ($current->getHabilidades() as $index => $habilidade) {
            $custoEnergia = (int)($habilidade['energyCost'] ?? 0);
            $actions[] = [
                'type'            => 'skill',
                'label'           => strtoupper((string)$habilidade['nome']),
                'skillName'       => (string)$habilidade['nome'],
                'description'     => (string)($descricoes[(string)$habilidade['nome']] ?? ''),
                'skillIndex'      => $index,
                'targetsOpponent' => (bool)$habilidade['precisaAlvo'],
                'energyCost'      => $custoEnergia,
                'disabled'        => $current->getEnergiaAtual() < $custoEnergia,
                'melee'           => (bool)($habilidade['melee'] ?? false),
                'priority'        => (bool)($habilidade['priority'] ?? false),
            ];
        }

        return $actions;
    }

    public static function retornaAoSetup(array $game, string $playerKey, string $actionType, ?int $skillIndex = null): bool {
        if ($actionType !== 'skill') {
            return false;
        }

        $player = self::jogadorPorChave($game, $playerKey);
        $metodo = self::metodoSkill($player, $skillIndex);

        return $metodo !== null && $player->retornaAoSetup($metodo);
    }

    // ── Export ───────────────────────────────────────────────────────────

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

        // availableActions flat = ações do jogador atual (compat com frontend)
        $availableActionsFlat = [];
        if (!$vencedor && $currentKey !== null) {
            $availableActionsFlat = self::acoesDisponiveis($game[$currentKey], false);
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
                'p1' => self::acoesDisponiveis($game['p1'], $p1Submeteu),
                'p2' => self::acoesDisponiveis($game['p2'], $p2Submeteu),
            ],
            'message'              => $mensagem,
        ];
    }
}
