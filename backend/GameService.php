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

    private static function normalizarChaveJogador(?string $key): string {
        return $key === 'p2' ? 'p2' : 'p1';
    }

    private static function obterJogadorPorChave(array $game, string $key): Personagem {
        $chaveNormalizada = self::normalizarChaveJogador($key);
        return $chaveNormalizada === 'p1' ? $game['p1'] : $game['p2'];
    }

    private static function getDomainVazio(): array {
        return [
            'turnsRemaining'       => 0,
            'casterKey'            => null,
            'targetKey'            => null,
            'extraCasterTurnPending' => false,
        ];
    }

    private static function resetarDomain(array &$game): void {
        $game['domain'] = self::getDomainVazio();
    }

    private static function obterMetodoSkill(Personagem $current, ?int $skillIndex): ?string {
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

    private static function getEfeitosVazio(): array {
        return ['skipTurns' => 0, 'skipTurnsChance' => 0, 'activatesDomain' => false];
    }

    private static function obterEfeitosSkill(Personagem $current, ?int $skillIndex): array {
        $vazio = self::getEfeitosVazio();

        if ($skillIndex === null) {
            return $vazio;
        }

        $skill = $current->getHabilidades()[$skillIndex] ?? null;
        if ($skill === null) {
            return $vazio;
        }

        return [
            'skipTurns'       => (int)($skill['skipTurns'] ?? 0),
            'skipTurnsChance' => (int)($skill['skipTurnsChance'] ?? 0),
            'activatesDomain' => (bool)($skill['activatesDomain'] ?? false),
        ];
    }

    private static function aplicarEfeitoParalisia(array &$game, string $currentKey, int $turnsToSkip, bool $activatesDomain): void {
        $targetKey = $currentKey === 'p1' ? 'p2' : 'p1';

        if ($turnsToSkip > 0) {
            $game['skipTurns'][$targetKey] = $turnsToSkip;
        }

        if ($activatesDomain) {
            $game['domain'] = [
                'turnsRemaining'       => $turnsToSkip + 1,
                'casterKey'            => $currentKey,
                'targetKey'            => $targetKey,
                'extraCasterTurnPending' => true,
            ];
        }
    }

    private static function consumirTurnoExtraDoLancador(array &$game, string $currentKey): void {
        $domainTurns   = (int)($game['domain']['turnsRemaining'] ?? 0);
        $domainCaster  = (string)($game['domain']['casterKey'] ?? '');
        $domainTarget  = (string)($game['domain']['targetKey'] ?? '');
        $extraPendente = (bool)($game['domain']['extraCasterTurnPending'] ?? false);

        if (!$extraPendente || $domainTurns <= 0 || $domainCaster !== $currentKey) {
            return;
        }

        if ($domainTarget === '' || ((int)($game['skipTurns'][$domainTarget] ?? 0)) > 0) {
            return;
        }

        $novoValor = $domainTurns - 1;
        $game['domain']['turnsRemaining'] = $novoValor;
        $game['domain']['extraCasterTurnPending'] = false;

        if ($novoValor <= 0) {
            self::resetarDomain($game);
        }
    }

    private static function avancarParaProximoTurno(array &$game, string $currentKey): void {
        $game['turno']      = ((int)$game['turno']) + 1;
        $game['currentKey'] = $currentKey === 'p1' ? 'p2' : 'p1';

        [, $nextCurrent] = self::getCurrentAndOpponent($game);
        $nextCurrent->iniciarTurno();
    }

    private static function processarTurnosPulados(array &$game): ?string {
        $mensagens       = [];
        $limiteSeguranca = 0;

        while (self::determineWinner($game) === null && $limiteSeguranca < 4) {
            $currentKey = self::normalizarChaveJogador((string)($game['currentKey'] ?? 'p1'));
            $skipAtual  = (int)($game['skipTurns'][$currentKey] ?? 0);

            if ($skipAtual <= 0) {
                break;
            }

            $jogadorPulando = self::obterJogadorPorChave($game, $currentKey);
            $game['skipTurns'][$currentKey] = $skipAtual - 1;

            $domainTurns = (int)($game['domain']['turnsRemaining'] ?? 0);
            if ((string)($game['domain']['targetKey'] ?? '') === $currentKey && $domainTurns > 0) {
                $novoValor = $domainTurns - 1;
                $game['domain']['turnsRemaining'] = $novoValor;
                if ($novoValor <= 0) {
                    self::resetarDomain($game);
                }
            }

            $mensagens[] = $jogadorPulando->getNome() . ' teve o turno pulado por Domain.';
            self::avancarParaProximoTurno($game, $currentKey);
            $limiteSeguranca++;
        }

        return count($mensagens) > 0 ? implode(' ', $mensagens) : null;
    }

    // ── Setup ────────────────────────────────────────────────────────────

    public static function getClassMap(): array {
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

    public static function getCharacterCatalog(): array {
        $catalogo = [];
        foreach (self::getClassMap() as $key => $className) {
            $personagem = new $className('_');
            $visual = $personagem->getConfiguracaoVisual();
            $catalogo[] = [
                'key'          => $key,
                'label'        => $personagem->getClasseNome(),
                'selectSprite' => $visual['selectSprite'] ?? $visual['baseSprite'] ?? null,
            ];
        }
        return $catalogo;
    }

    public static function createCharacter(string $classKey, string $name): Personagem {
        $normalizedKey = strtolower(trim($classKey));
        $className = self::getClassMap()[$normalizedKey] ?? null;

        if ($className === null) {
            throw new EntradaInvalidaException();
        }

        $normalizedName = trim($name);
        if ($normalizedName === '') {
            $normalizedName = 'Jogador';
        }

        return new $className($normalizedName);
    }

    public static function createGameState(Personagem $p1, Personagem $p2): array {
        return [
            'p1'         => $p1,
            'p2'         => $p2,
            'turno'      => 1,
            'currentKey' => 'p1',
            'skipTurns'  => ['p1' => 0, 'p2' => 0],
            'domain'     => self::getDomainVazio(),
        ];
    }

    // ── API de jogo ──────────────────────────────────────────────────────

    public static function determineWinner(array $game): ?string {
        $p1 = self::obterJogadorPorChave($game, 'p1');
        $p2 = self::obterJogadorPorChave($game, 'p2');

        if (!$p1->estaVivo()) return 'p2';
        if (!$p2->estaVivo()) return 'p1';

        return null;
    }

    public static function getCurrentAndOpponent(array $game): array {
        $currentKey  = self::normalizarChaveJogador((string)($game['currentKey'] ?? 'p1'));
        $opponentKey = $currentKey === 'p1' ? 'p2' : 'p1';

        return [
            $currentKey,
            self::obterJogadorPorChave($game, $currentKey),
            self::obterJogadorPorChave($game, $opponentKey),
        ];
    }

    public static function buildAvailableActions(Personagem $current): array {
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
            ];
            $actions[] = [
                'type'            => 'defend',
                'label'           => 'DEFENDER',
                'skillName'       => 'Defesa',
                'description'     => (string)($descricoes['Defesa'] ?? ''),
                'targetsOpponent' => false,
                'energyCost'      => 0,
                'disabled'        => false,
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
            ];
        }

        return $actions;
    }

    public static function retornaAoSetup(array $game, string $actionType, ?int $skillIndex = null): bool {
        if ($actionType !== 'skill') {
            return false;
        }

        [, $current] = self::getCurrentAndOpponent($game);
        $metodoSkill = self::obterMetodoSkill($current, $skillIndex);

        return $metodoSkill !== null && $current->retornaAoSetup($metodoSkill);
    }

    public static function executeAction(Personagem $current, Personagem $opponent, string $actionType, ?int $skillIndex = null): string {
        if ($actionType === 'attack') {
            return $current->atacar($opponent);
        }

        if ($actionType === 'defend') {
            return $current->defender();
        }

        if ($actionType === 'skill') {
            $habilidades = $current->getHabilidades();
            if ($skillIndex === null || !isset($habilidades[$skillIndex])) {
                throw new EntradaInvalidaException();
            }

            $habilidade  = $habilidades[$skillIndex];
            $metodo      = (string)$habilidade['metodo'];
            $precisaAlvo = (bool)$habilidade['precisaAlvo'];

            return $precisaAlvo ? $current->$metodo($opponent) : $current->$metodo();
        }

        throw new EntradaInvalidaException();
    }

    public static function performTurn(array &$game, string $actionType, ?int $skillIndex = null): string {
        [$currentKey, $current, $opponent] = self::getCurrentAndOpponent($game);

        $efeitos = self::getEfeitosVazio();

        if ($actionType === 'skill' && $skillIndex !== null) {
            $habilidades = $current->getHabilidades();
            $efeitos     = self::obterEfeitosSkill($current, $skillIndex);
            $custo       = (int)($habilidades[$skillIndex]['energyCost'] ?? 0);

            if ($custo > 0 && $current->getEnergiaAtual() < $custo) {
                throw new EntradaInvalidaException();
            }
        }

        $message = self::executeAction($current, $opponent, $actionType, $skillIndex);

        $turnosParalisados = $efeitos['skipTurns'];
        if ($efeitos['skipTurnsChance'] > 0 && random_int(1, 100) <= $efeitos['skipTurnsChance']) {
            $turnosParalisados = max($turnosParalisados, 1);
        }

        if ($turnosParalisados > 0 || $efeitos['activatesDomain']) {
            self::aplicarEfeitoParalisia($game, $currentKey, $turnosParalisados, $efeitos['activatesDomain']);
        }

        self::consumirTurnoExtraDoLancador($game, $currentKey);
        $current->processarEfeitosContinuosFimTurno();

        if (self::determineWinner($game) === null) {
            self::avancarParaProximoTurno($game, $currentKey);

            $mensagemTurnosPulados = self::processarTurnosPulados($game);
            if ($mensagemTurnosPulados !== null) {
                $message .= " $mensagemTurnosPulados";
            }
        }

        return $message;
    }

    // ── Export ───────────────────────────────────────────────────────────

    public static function exportCharacter(Personagem $character, string $label): array {
        return [
            'label'          => $label,
            'nome'           => $character->getNome(),
            'classe'         => $character->getClasse(),
            'classeNome'     => $character->getClasseNome(),
            'vidaAtual'      => $character->getVidaAtual(),
            'vidaMaxima'     => $character->getVidaMaxima(),
            'energiaAtual'   => $character->getEnergiaAtual(),
            'energiaMaxima'  => $character->getEnergiaMaxima(),
            'ultimoTipoDano' => $character->getUltimoTipoDano(),
            'defendendo'     => $character->estaDefendendo(),
            'visual'         => $character->getConfiguracaoVisual(),
        ];
    }

    public static function exportState(array $game, ?string $message = null): array {
        /** @var Personagem $p1 */
        $p1 = $game['p1'];
        /** @var Personagem $p2 */
        $p2 = $game['p2'];

        [$currentKey, $current] = self::getCurrentAndOpponent($game);
        $winner = self::determineWinner($game);

        return [
            'started'              => true,
            'turno'                => (int)$game['turno'],
            'currentKey'           => $currentKey,
            'winner'               => $winner,
            'domainTurnsRemaining' => (int)($game['domain']['turnsRemaining'] ?? 0),
            'domainCasterKey'      => $game['domain']['casterKey'] ?? null,
            'p1'                   => self::exportCharacter($p1, 'Jogador 1'),
            'p2'                   => self::exportCharacter($p2, 'Jogador 2'),
            'availableActions'     => $winner ? [] : self::buildAvailableActions($current),
            'message'              => $message,
        ];
    }
}
