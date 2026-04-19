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
