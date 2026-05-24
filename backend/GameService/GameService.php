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
require_once __DIR__ . '/../characters/escanor/escanor.php';
require_once __DIR__ . '/../characters/grimmjow/grimmjow.php';

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

            // QTE pendente: informa o frontend para resolver via quick-time event
            if (!empty($resultado['qtePending'])) {
                return [
                    'resolved'        => false,
                    'mensagem'        => null,
                    'resetJogo'       => false,
                    'clashQtePending' => true,
                    'clash'           => $resultado['clash'],
                ];
            }

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

    public static function resolverClashQTE(array &$game, ?string $winnerKey): array {
        return self::resolverClashPendente($game, $winnerKey);
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
