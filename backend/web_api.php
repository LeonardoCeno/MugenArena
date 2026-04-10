<?php

declare(strict_types=1);

require_once __DIR__ . '/GameService.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

function responder(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function receberJson(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function exportarEstadoDaSessao(?string $mensagem = null): array {
    if (!isset($_SESSION['game']) || !is_array($_SESSION['game'])) {
        return [
            'started' => false,
            'message' => $mensagem,
        ];
    }

    return GameService::exportState($_SESSION['game'], $mensagem);
}

function obterPartidaAtiva(): array {
    if (!isset($_SESSION['game']) || !is_array($_SESSION['game'])) {
        throw new EntradaInvalidaException();
    }

    return $_SESSION['game'];
}

function iniciarPartida(array $input): void {
    $p1 = GameService::createCharacter(
        (string)($input['p1Class'] ?? 'sukuna'),
        (string)($input['p1Name'] ?? 'Jogador 1')
    );

    $p2 = GameService::createCharacter(
        (string)($input['p2Class'] ?? 'gojo'),
        (string)($input['p2Name'] ?? 'Jogador 2')
    );

    $_SESSION['game'] = GameService::createGameState($p1, $p2);

    responder([
        'ok' => true,
        'state' => exportarEstadoDaSessao('Partida iniciada.'),
    ]);
}

function executarAcao(array $input): void {
    $game = obterPartidaAtiva();

    $actionType = (string)($input['actionType'] ?? '');
    $skillIndex = isset($input['skillIndex']) ? (int)$input['skillIndex'] : null;
    $deveRetornarSetup = GameService::retornaAoSetup($game, $actionType, $skillIndex);

    $mensagem = GameService::performTurn($game, $actionType, $skillIndex);

    if ($deveRetornarSetup) {
        unset($_SESSION['game']);

        responder([
            'ok' => true,
            'message' => $mensagem,
            'state' => exportarEstadoDaSessao($mensagem),
        ]);
    }

    $_SESSION['game'] = $game;

    responder([
        'ok' => true,
        'message' => $mensagem,
        'state' => exportarEstadoDaSessao($mensagem),
    ]);
}

$input = receberJson();
$action = (string)($input['action'] ?? 'state');

try {
    switch ($action) {
        case 'start':
            iniciarPartida($input);
            break;

        case 'state':
            responder([
                'ok' => true,
                'state' => exportarEstadoDaSessao(),
            ]);
            break;

        case 'action':
            executarAcao($input);
            break;

        case 'catalog':
            responder([
                'ok'      => true,
                'catalog' => GameService::getCharacterCatalog(),
            ]);
            break;

        default:
            throw new EntradaInvalidaException();
    }
} catch (ExcecaoJogo $e) {
    responder([
        'ok' => false,
        'message' => $e->getMessage(),
        'state' => exportarEstadoDaSessao($e->getMessage()),
    ], 400);
} catch (Throwable $e) {
    responder([
        'ok' => false,
        'message' => 'Erro interno no servidor.',
    ], 500);
}
