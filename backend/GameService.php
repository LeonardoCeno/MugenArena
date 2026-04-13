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
            'turnsRemaining'         => 0,
            'casterKey'              => null,
            'targetKey'              => null,
            'extraCasterTurnPending' => false,
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

    private static function aplicarParalisia(array &$game, string $currentKey, int $turnosToSkip, bool $activatesDomain): void {
        $targetKey = self::chaveOposta($currentKey);

        if ($turnosToSkip > 0) {
            $game['skipTurns'][$targetKey] = $turnosToSkip;
        }

        if ($activatesDomain) {
            $game['domain'] = [
                'turnsRemaining'         => $turnosToSkip + 1,
                'casterKey'              => $currentKey,
                'targetKey'              => $targetKey,
                'extraCasterTurnPending' => true,
            ];
        }
    }

    private static function consumirTurnoExtra(array &$game, string $currentKey): void {
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

        $game['domain']['extraCasterTurnPending'] = false;
        self::decrementarDomain($game);
    }

    private static function avancarTurno(array &$game, string $currentKey): void {
        $game['turno']      = ((int)$game['turno']) + 1;
        $game['currentKey'] = self::chaveOposta($currentKey);

        $game[$game['currentKey']]->iniciarTurno();
    }

    private static function processarTurnosPulados(array &$game): ?string {
        $mensagens       = [];
        $limiteSeguranca = 0;

        while (self::determinarVencedor($game) === null && $limiteSeguranca < 4) {
            $currentKey = self::validarChave((string)($game['currentKey'] ?? 'p1'));
            $skipAtual  = (int)($game['skipTurns'][$currentKey] ?? 0);

            if ($skipAtual <= 0) {
                break;
            }

            $jogadorPulando = self::jogadorPorChave($game, $currentKey);
            $game['skipTurns'][$currentKey] = $skipAtual - 1;

            if ((string)($game['domain']['targetKey'] ?? '') === $currentKey && (int)($game['domain']['turnsRemaining'] ?? 0) > 0) {
                self::decrementarDomain($game);
            }

            $mensagens[] = $jogadorPulando->getNome() . ' teve o turno pulado por Domain.';
            self::avancarTurno($game, $currentKey);
            $limiteSeguranca++;
        }

        return count($mensagens) > 0 ? implode(' ', $mensagens) : null;
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
        return [
            'p1'         => $p1,
            'p2'         => $p2,
            'turno'      => 1,
            'currentKey' => 'p1',
            'skipTurns'  => ['p1' => 0, 'p2' => 0],
            'domain'     => self::domainVazio(),
        ];
    }

    // ── API de jogo ──────────────────────────────────────────────────────

    public static function determinarVencedor(array $game): ?string {
        if (!$game['p1']->estaVivo()) return 'p2';
        if (!$game['p2']->estaVivo()) return 'p1';
        return null;
    }

    public static function jogadoresDoTurno(array $game): array {
        $currentKey  = self::validarChave((string)($game['currentKey'] ?? 'p1'));
        $opponentKey = self::chaveOposta($currentKey);

        return [
            $currentKey,
            self::jogadorPorChave($game, $currentKey),
            self::jogadorPorChave($game, $opponentKey),
        ];
    }

    public static function acoesDisponiveis(Personagem $current): array {
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
                'melee'           => (bool)($habilidade['melee'] ?? false),
            ];
        }

        return $actions;
    }

    public static function retornaAoSetup(array $game, string $actionType, ?int $skillIndex = null): bool {
        if ($actionType !== 'skill') {
            return false;
        }

        [, $current] = self::jogadoresDoTurno($game);
        $metodo = self::metodoSkill($current, $skillIndex);

        return $metodo !== null && $current->retornaAoSetup($metodo);
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

    public static function executarTurno(array &$game, string $actionType, ?int $skillIndex = null): string {
        [$currentKey, $current, $opponent] = self::jogadoresDoTurno($game);
        $habilidadeAtual = null;

        if ($actionType === 'skill' && $skillIndex !== null) {
            $habilidades = $current->getHabilidades();
            if (!isset($habilidades[$skillIndex])) {
                throw new EntradaInvalidaException();
            }

            $habilidadeAtual = $habilidades[$skillIndex];
            $custo           = (int)($habilidadeAtual['energyCost'] ?? 0);

            if ($custo > 0 && $current->getEnergiaAtual() < $custo) {
                throw new EntradaInvalidaException();
            }
        }

        $efeitos = self::efeitosDaSkill($habilidadeAtual);
        $mensagem = self::executarAcao($current, $opponent, $actionType, $skillIndex, $habilidadeAtual);

        $turnosParalisados = $efeitos['skipTurns'];
        if ($efeitos['skipTurnsChance'] > 0 && random_int(1, 100) <= $efeitos['skipTurnsChance']) {
            $turnosParalisados = max($turnosParalisados, 1);
        }

        if ($turnosParalisados > 0 || $efeitos['activatesDomain']) {
            self::aplicarParalisia($game, $currentKey, $turnosParalisados, $efeitos['activatesDomain']);
        }

        self::consumirTurnoExtra($game, $currentKey);
        $current->processarEfeitosContinuosFimTurno();

        if (self::determinarVencedor($game) === null) {
            self::avancarTurno($game, $currentKey);

            $mensagemTurnosPulados = self::processarTurnosPulados($game);
            if ($mensagemTurnosPulados !== null) {
                $mensagem .= " $mensagemTurnosPulados";
            }
        }

        return $mensagem;
    }

    // ── Export ───────────────────────────────────────────────────────────

    public static function exportarPersonagem(Personagem $character, string $label): array {
        return [
            'label'        => $label,
            'nome'         => $character->getNome(),
            'classe'       => $character->getClasse(),
            'classeNome'   => $character->getClasseNome(),
            'vidaAtual'    => $character->getVidaAtual(),
            'vidaMaxima'   => $character->getVidaMaxima(),
            'energiaAtual' => $character->getEnergiaAtual(),
            'energiaMaxima'=> $character->getEnergiaMaxima(),
            'ultimoTipoDano' => $character->getUltimoTipoDano(),
            'defendendo'   => $character->estaDefendendo(),
            'bleedTurnos'  => $character->getSangramentoTurnos(),
            'burnTurnos'   => $character->getQueimaduraTurnos(),
            'visual'       => $character->getConfiguracaoVisual(),
        ];
    }

    public static function exportarEstado(array $game, ?string $mensagem = null): array {
        [$currentKey, $current] = self::jogadoresDoTurno($game);
        $vencedor = self::determinarVencedor($game);

        return [
            'started'              => true,
            'turno'                => (int)$game['turno'],
            'currentKey'           => $currentKey,
            'winner'               => $vencedor,
            'domainTurnsRemaining' => (int)($game['domain']['turnsRemaining'] ?? 0),
            'domainCasterKey'      => $game['domain']['casterKey'] ?? null,
            'p1'                   => self::exportarPersonagem($game['p1'], 'Jogador 1'),
            'p2'                   => self::exportarPersonagem($game['p2'], 'Jogador 2'),
            'availableActions'     => $vencedor ? [] : self::acoesDisponiveis($current),
            'message'              => $mensagem,
        ];
    }
}
