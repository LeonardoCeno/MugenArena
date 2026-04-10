<?php

require_once __DIR__ . '/GameService.php';

function limparTela(): void {
    system('clear');
}

function exibirStatus(array $game): void {
    [$currentKey, $atual] = GameService::getCurrentAndOpponent($game);

    /** @var Personagem $p1 */
    $p1 = $game['p1'];
    /** @var Personagem $p2 */
    $p2 = $game['p2'];

    $jogadorDaVez = $currentKey === 'p1' ? 'Jogador 1' : 'Jogador 2';

    echo "=== Turno {$game['turno']} de {$jogadorDaVez} ({$atual->getNome()}) ===\n";
    echo "Jogador 1: {$p1->getNome()} (HP: {$p1->getVidaAtual()}/{$p1->getVidaMaxima()}, Energia: {$p1->getEnergiaAtual()}/{$p1->getEnergiaMaxima()})\n";
    echo "Jogador 2: {$p2->getNome()} (HP: {$p2->getVidaAtual()}/{$p2->getVidaMaxima()}, Energia: {$p2->getEnergiaAtual()}/{$p2->getEnergiaMaxima()})\n";
}

function exibirAcoesDisponiveis(array $acoes): void {
    echo "\nAções disponíveis:\n";

    foreach ($acoes as $index => $acao) {
        echo $index + 1 . ". " . $acao['label'] . "\n";
    }

    echo "Escolha uma ação: ";
}

function escolherPersonagem(int $jogador): Personagem {
    $catalogo = GameService::getCharacterCatalog();

    echo "Jogador {$jogador}, escolha seu personagem:\n";

    foreach ($catalogo as $index => $item) {
        echo $index + 1 . ". " . $item['label'] . "\n";
    }

    do {

        echo "Escolha: ";

        $input = trim((string)fgets(STDIN));
        $escolha = is_numeric($input) ? (int)$input : -1;

        if ($escolha < 1 || $escolha > count($catalogo)) {
            echo "Opção inválida. Escolha um personagem existente.\n";
        }

    } while ($escolha < 1 || $escolha > count($catalogo));

    echo "Digite o nome do personagem: ";

    $nome = trim((string)fgets(STDIN));
    $item = $catalogo[$escolha - 1];

    return GameService::createCharacter($item['key'], $nome !== '' ? $nome : "Jogador {$jogador}");
}

function main(): void {

    do {

        limparTela();

        echo "Bem-vindo ao Jogo de Combate por Turnos!\n\n";

        $p1 = escolherPersonagem(1);
        $p2 = escolherPersonagem(2);
        $game = GameService::createGameState($p1, $p2);

        while (GameService::determineWinner($game) === null) {

            limparTela();

            [, $atual] = GameService::getCurrentAndOpponent($game);
            exibirStatus($game);
            $acoes = GameService::buildAvailableActions($atual);
            exibirAcoesDisponiveis($acoes);

            try {

                $input = trim((string)fgets(STDIN));

                if (!is_numeric($input)) {
                    throw new EntradaInvalidaException();
                }

                $acaoIndex = (int)$input - 1;

                if (!isset($acoes[$acaoIndex])) {
                    throw new EntradaInvalidaException();
                }

                $acaoSelecionada = $acoes[$acaoIndex];
                $resultado = GameService::performTurn(
                    $game,
                    (string)$acaoSelecionada['type'],
                    isset($acaoSelecionada['skillIndex']) ? (int)$acaoSelecionada['skillIndex'] : null
                );

                echo "\n{$resultado}\n";

            } catch (ExcecaoJogo $e) {

                echo "Erro: " . $e->getMessage() . "\n";
                continue;
            }

            echo "\nPressione Enter para continuar...";
            fgets(STDIN);
        }

        limparTela();

        $winner = GameService::determineWinner($game);
        if ($winner === 'p2') {
            echo "Jogador 2 venceu!\n";
        } else {
            echo "Jogador 1 venceu!\n";
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