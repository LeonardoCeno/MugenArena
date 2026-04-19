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
