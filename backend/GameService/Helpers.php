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
