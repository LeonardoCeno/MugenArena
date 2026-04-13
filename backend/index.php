<?php

require_once __DIR__ . '/GameService.php';

function limparTela(): void {
    system('clear');
}

function exibirStatus(array $game): void {
    /** @var Personagem $p1 */
    $p1 = $game['p1'];
    /** @var Personagem $p2 */
    $p2 = $game['p2'];

    echo "=== Turno {$game['turno']} — Escolha simultânea ===\n";
    echo "Jogador 1 ({$p1->getNome()}) [Vel:{$p1->getVelocidade()}] HP: {$p1->getVidaAtual()}/{$p1->getVidaMaxima()} | Energia: {$p1->getEnergiaAtual()}/{$p1->getEnergiaMaxima()}\n";
    echo "Jogador 2 ({$p2->getNome()}) [Vel:{$p2->getVelocidade()}] HP: {$p2->getVidaAtual()}/{$p2->getVidaMaxima()} | Energia: {$p2->getEnergiaAtual()}/{$p2->getEnergiaMaxima()}\n";
}

function exibirAcoesDisponiveis(array $acoes, string $prefixo = ''): void {
    echo "\n{$prefixo}Ações disponíveis:\n";
    foreach ($acoes as $index => $acao) {
        $prio = $acao['priority'] ? ' [PRIORIDADE]' : '';
        echo $index + 1 . ". " . $acao['label'] . $prio . "\n";
    }
    echo "{$prefixo}Escolha: ";
}

function escolherPersonagem(int $jogador): Personagem {
    $catalogo    = GameService::catalogoDePersonagens();
    $totalOpcoes = count($catalogo);

    echo "Jogador {$jogador}, escolha seu personagem:\n";
    foreach ($catalogo as $index => $item) {
        echo $index + 1 . ". " . $item['label'] . " [Velocidade: {$item['velocidade']}]\n";
    }

    do {
        echo "Escolha: ";
        $input   = trim((string)fgets(STDIN));
        $escolha = is_numeric($input) ? (int)$input : -1;
        if ($escolha < 1 || $escolha > $totalOpcoes) {
            echo "Opção inválida.\n";
        }
    } while ($escolha < 1 || $escolha > $totalOpcoes);

    echo "Digite o nome do personagem: ";
    $nome = trim((string)fgets(STDIN));
    $item = $catalogo[$escolha - 1];

    return GameService::criarPersonagem($item['key'], $nome !== '' ? $nome : "Jogador {$jogador}");
}

function coletarAcao(array $game, string $playerKey, string $rotulo): ?array {
    $player = $game[$playerKey];

    // Se paralisado, skip automático
    if ((int)($game['skipTurns'][$playerKey] ?? 0) > 0) {
        echo "{$rotulo} ({$player->getNome()}) está PARALISADO — turno pulado automaticamente.\n";
        return ['actionType' => 'skip', 'skillIndex' => null];
    }

    $acoes = GameService::acoesDisponiveis($player);
    exibirAcoesDisponiveis($acoes, "{$rotulo} ({$player->getNome()}) — ");

    while (true) {
        $input = trim((string)fgets(STDIN));
        if (!is_numeric($input)) {
            echo "Opção inválida. Escolha novamente: ";
            continue;
        }

        $acaoIndex = (int)$input - 1;
        if (!isset($acoes[$acaoIndex])) {
            echo "Opção inválida. Escolha novamente: ";
            continue;
        }

        $acao = $acoes[$acaoIndex];
        return [
            'actionType' => (string)$acao['type'],
            'skillIndex' => isset($acao['skillIndex']) ? (int)$acao['skillIndex'] : null,
        ];
    }
}

function main(): void {
    do {
        limparTela();
        echo "Bem-vindo ao Jogo de Combate por Turnos (Simultâneo)!\n\n";

        $p1   = escolherPersonagem(1);
        $p2   = escolherPersonagem(2);
        $game = GameService::criarEstadoDeJogo($p1, $p2);

        $vencedor = null;
        while (($vencedor = GameService::determinarVencedor($game)) === null) {
            limparTela();
            exibirStatus($game);

            // Coleta ação do Jogador 1
            $acao1 = coletarAcao($game, 'p1', 'Jogador 1');

            // Coleta ação do Jogador 2
            $acao2 = coletarAcao($game, 'p2', 'Jogador 2');

            echo "\n--- Resolvendo turno ---\n";

            try {
                // Submete p1
                GameService::submeterAcao($game, 'p1', $acao1['actionType'], $acao1['skillIndex']);

                // Submete p2 → dispara resolução
                $resultado = GameService::submeterAcao($game, 'p2', $acao2['actionType'], $acao2['skillIndex']);

                echo "\n" . $resultado['mensagem'] . "\n";

                if ($resultado['resetJogo']) {
                    echo "\nJogo encerrado por ação especial!\n";
                    $vencedor = 'reset';
                    break;
                }
            } catch (ExcecaoJogo $e) {
                echo "Erro: " . $e->getMessage() . "\n";
            }

            echo "\nPressione Enter para continuar...";
            fgets(STDIN);
        }

        limparTela();

        if ($vencedor === 'reset') {
            echo "Partida encerrada por evento especial.\n";
        } else {
            echo ($vencedor === 'p2' ? "Jogador 2" : "Jogador 1") . " venceu!\n";
        }

        echo "\nDeseja jogar novamente? (s/n): ";
        do {
            $resposta = strtolower(trim(fgets(STDIN)));
            if ($resposta !== 's' && $resposta !== 'n') {
                echo "Resposta inválida. Digite apenas (s/n): ";
            }
        } while ($resposta !== 's' && $resposta !== 'n');
    } while ($resposta === 's');

    echo "\nObrigado por jogar!\n";
}

main();
