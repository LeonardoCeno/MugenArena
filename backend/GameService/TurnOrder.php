<?php

declare(strict_types=1);

trait TurnOrder
{
    private static function acaoTemPrioridadeBruta(Personagem $p, array $acao): bool {
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

    private static function acaoTemPrioridade(Personagem $p, array $acao): bool {
        if (self::acaoDeveExecutarPorUltimo($p, $acao)) {
            return false;
        }

        return self::acaoTemPrioridadeBruta($p, $acao);
    }

    private static function acaoEhClashavel(Personagem $p, array $acao): bool {
        $habilidade = self::habilidadeDaAcao($p, $acao);
        return (bool)($habilidade['clashable'] ?? false);
    }

    private static function acaoAtivaDomain(Personagem $p, array $acao): bool {
        $habilidade = self::habilidadeDaAcao($p, $acao);
        return (bool)($habilidade['activatesDomain'] ?? false);
    }

    private static function acaoPodeEntrarEmDomainClash(Personagem $p, array $acao): bool {
        $habilidade = self::habilidadeDaAcao($p, $acao);
        if ($habilidade === null) {
            return false;
        }

        return (bool)($habilidade['activatesDomain'] ?? false)
            && (bool)($habilidade['domainClash'] ?? false);
    }

    private static function acaoDeveExecutarPorUltimo(Personagem $p, array $acao): bool {
        return self::acaoAtivaDomain($p, $acao) && self::acaoTemPrioridadeBruta($p, $acao);
    }

    private static function obterPenalidadeEnergiaDeDomain(Personagem $p, array $acao): int {
        $habilidade = self::habilidadeDaAcao($p, $acao);
        if ($habilidade === null || !(bool)($habilidade['activatesDomain'] ?? false)) {
            return 0;
        }

        $custoEnergia = (int)($habilidade['energyCost'] ?? 0);
        return (int) ceil(max(0, $custoEnergia) * 0.5);
    }

    private static function aplicarPenalidadeEnergiaDeDomain(array &$game, string $playerKey, array $acao): void {
        $penalidade = self::obterPenalidadeEnergiaDeDomain($game[$playerKey], $acao);
        if ($penalidade <= 0) {
            return;
        }

        $game[$playerKey]->drenarEnergia($penalidade);
    }

    private static function acaoPodeAtingirOponente(Personagem $p, array $acao): bool {
        $tipo = $acao['actionType'] ?? null;

        if ($tipo === 'attack') {
            return true;
        }

        if ($tipo !== 'skill') {
            return false;
        }

        $habilidade = self::habilidadeDaAcao($p, $acao);
        return (bool)($habilidade['precisaAlvo'] ?? false);
    }

    private static function domainFoiInterrompido(array $game, string $attackerKey, string $defenderKey, int $vidaAntesDoAtaque): bool {
        $acaoDefensor = $game['pendingActions'][$defenderKey] ?? null;
        if ($acaoDefensor === null || !self::acaoAtivaDomain($game[$defenderKey], $acaoDefensor)) {
            return false;
        }

        $acaoAtacante = $game['pendingActions'][$attackerKey] ?? null;
        if ($acaoAtacante === null || !self::acaoPodeAtingirOponente($game[$attackerKey], $acaoAtacante)) {
            return false;
        }

        if ($game[$defenderKey]->getVidaAtual() >= $vidaAntesDoAtaque) {
            return false;
        }

        return random_int(1, 100) <= 60;
    }

    /**
     * Retorna true se p1 age antes de p2.
     * Regras: domains prioritários agem por último > prioridade > velocidade > aleatório.
     */
    private static function determinarOrdem(Personagem $p1, array $a1, Personagem $p2, array $a2): bool {
        $p1Last = self::acaoDeveExecutarPorUltimo($p1, $a1);
        $p2Last = self::acaoDeveExecutarPorUltimo($p2, $a2);

        if ($p1Last && !$p2Last) return false;
        if ($p2Last && !$p1Last) return true;

        $p1Prio = self::acaoTemPrioridade($p1, $a1);
        $p2Prio = self::acaoTemPrioridade($p2, $a2);

        if ($p1Prio && !$p2Prio) return true;
        if ($p2Prio && !$p1Prio) return false;

        if ($p1->getVelocidade() > $p2->getVelocidade()) return true;
        if ($p2->getVelocidade() > $p1->getVelocidade()) return false;

        return random_int(0, 1) === 1;
    }
}
