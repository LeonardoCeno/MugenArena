<?php

require_once __DIR__ . '/../../Personagem.php';

class Sukuna extends Personagem {

    const CUSTO_DESMANTELAR = 550;
    const CUSTO_KAMINO_FUGA = 800;
    const CUSTO_DOMAIN = 1900;
    const CUSTO_REVERSE = 700;
    const DANO_DESMANTELAR = 40;
    const DANO_KAMINO_FUGA = 50;
    const DANO_DOMAIN = 70;
    const CURA_REVERSE = 100;
    const REGENERACAO_PROPRIA = 70;

    public function __construct(string $nome) {
        parent::__construct($nome, 300, 25, 4000);
    }

    public static function getDescricao(): string {
        return "Sukuna (Alto HP, ataque médio, habilidades: Desmantelar, Kamino Fuga, Reverse Energy e Domain)";
    }

    public function usarHabilidadeEspecial(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_DESMANTELAR);
        $resultado = $this->executarAtaqueDireto($alvo, "Desmantelar", self::DANO_DESMANTELAR);

        if (!$resultado['acertou']) {
            return $resultado['mensagem'];
        }

        $danoBleed = (int) ceil(self::DANO_DESMANTELAR * 0.40);
        if ($danoBleed > 0) {
            $alvo->aplicarSangramento($danoBleed, 1);
        }

        $mensagem = $resultado['mensagem'];

        if ($danoBleed > 0) {
            $mensagem .= " Sangramento aplicado por 2 turnos ({$danoBleed} por turno).";
        }

        return $mensagem;
    }

    public function kaminoFuga(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_KAMINO_FUGA);
        $resultado = $this->executarAtaqueDireto($alvo, "Kamino Fuga", self::DANO_KAMINO_FUGA);

        if (!$resultado['acertou']) {
            return $resultado['mensagem'];
        }

        $danoBurn = (int) ceil(self::DANO_KAMINO_FUGA * 0.40);
        if ($danoBurn > 0) {
            $alvo->aplicarQueimadura($danoBurn, 1);
        }

        $mensagem = $resultado['mensagem'];

        if ($danoBurn > 0) {
            $mensagem .= " Burn aplicado por 1 turno ({$danoBurn} por turno).";
        }

        return $mensagem;
    }

    public function reverseEnergy(): string {
        $this->consumirEnergia(self::CUSTO_REVERSE);
        $this->curarVida(self::CURA_REVERSE);

        return $this->formatarMensagemAcaoSemAlvo("Reverse Energy");
    }

    public function santuarioMalevolente(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_DOMAIN);
        $resultado = $this->executarAtaqueDireto($alvo, "Domain", self::DANO_DOMAIN);

        if (!$resultado['acertou']) {
            return $resultado['mensagem'];
        }

        $danoBleed = (int) ceil(self::DANO_DOMAIN * 0.50);
        if ($danoBleed > 0) {
            $alvo->aplicarSangramento($danoBleed, 1);
        }

        $mensagem = $resultado['mensagem'];

        if ($danoBleed > 0) {
            $mensagem .= " Sangramento aplicado por 3 turnos ({$danoBleed} por turno).";
        }

        return $mensagem;
    }

    public function getHabilidades(): array {
        return [
            ["nome" => "Desmantelar",   "metodo" => "usarHabilidadeEspecial", "precisaAlvo" => true,  "energyCost" => self::CUSTO_DESMANTELAR,],
            ["nome" => "Kamino Fuga",   "metodo" => "kaminoFuga",             "precisaAlvo" => true,  "energyCost" => self::CUSTO_KAMINO_FUGA],
            ["nome" => "Reverse Energy","metodo" => "reverseEnergy",          "precisaAlvo" => false, "energyCost" => self::CUSTO_REVERSE],
            ["nome" => "Domain",        "metodo" => "santuarioMalevolente",   "precisaAlvo" => true,  "energyCost" => self::CUSTO_DOMAIN]
        ];
    }

    public function getDescricoesAcoes(): array {
        return array_merge(parent::getDescricoesAcoes(), [
            'Desmantelar' => 'Cria cortes contínuos no inimigo, causando sangramento.' . "\n" . 'Dano: ' . self::DANO_DESMANTELAR . "\n" . 'Custo: ' . self::CUSTO_DESMANTELAR,
            'Kamino Fuga' => 'Lança uma explosão que queima o inimigo por 1 turno.' . "\n" . 'Dano: ' . self::DANO_KAMINO_FUGA . "\n" . 'Custo: ' . self::CUSTO_KAMINO_FUGA,
            'Reverse Energy' => 'Inverte a energia maldita para regenerar vida.' . "\n" . 'Cura: ' . self::CURA_REVERSE . "\n" . 'Custo: ' . self::CUSTO_REVERSE,
            'Domain' => 'Expande o Santuário Malevolente, cortando o inimigo repetidamente.' . "\n" . 'Dano: ' . self::DANO_DOMAIN . "\n" . 'Custo: ' . self::CUSTO_DOMAIN,
        ]);
    }

    public function getConfiguracaoVisual(): array {
        return [
            'baseSprite' => './assets/sukuna/sprites/sukunabasefinal.png',
            'winMessage' => 'Até que é forte, mas não o mais forte',
            'winImage' => './assets/sukuna/sprites/sukunawin.jpg',
            'actions' => [
                'Ataque' => [
                    'frames' => [
                        [
                            'sprite' => './assets/sukuna/sprites/sukuachute1.png',
                            'durationMs' => 450,
                        ],
                        [
                            'sprite' => './assets/sukuna/sprites/sukunachute2real.png',
                            'durationMs' => 400,
                        ],
                    ],
                ],
                'Desmantelar' => [
                    'frames' => [
                        [
                            'sprite' => './assets/sukuna/sprites/sukuacleave.png',
                            'durationMs' => 1000,
                        ],
                    ],
                    'overlays' => [
                        [
                            'target' => 'opponent',
                            'sprite' => './assets/sukuna/sprites/CORTE1.png',
                            'startMs' => 0,
                            'durationMs' => 190,
                            'x' => 0,
                            'y' => 0,
                            'scale' => 1.2,
                        ],
                        [
                            'target' => 'opponent',
                            'sprite' => './assets/sukuna/sprites/CORTE2.png',
                            'startMs' => 150,
                            'durationMs' => 190,
                            'x' => 0,
                            'y' => 0,
                            'scale' => 1.2,
                        ],
                    ],
                    'repeatOverlays' => 3,
                ],
                'Kamino Fuga' => [
                    'frames' => [
                        [
                            'sprite' => './assets/sukuna/sprites/sukunafuga1.png',
                            'durationMs' => 400,
                        ],
                        [
                            'sprite' => './assets/sukuna/sprites/sukunafuga2.png',
                            'durationMs' => 400,
                        ],
                        [
                            'sprite' => './assets/sukuna/sprites/FUGAFINAL.png',
                            'durationMs' => 1300,
                            'scale' => 1.1,
                        ],
                        [
                            'sprite' => './assets/sukuna/sprites/sukunabasefinal.png',
                            'durationMs' => 100,
                        ],
                    ],
                    'overlays' => [
                        [
                            'mode' => 'projectile',
                            'target' => 'opponent',
                            'sprite' => './assets/sukuna/sprites/FUGA.png',
                            'startMs' => 2200,
                            'durationMs' => 500,
                            'sizePx' => 260,
                            'frontOffsetPx' => 130,
                            'projectileAngleDeg' => -15,
                            'startOffsetX' => 0,
                            'startOffsetY' => -20,
                            'endOffsetX' => 0,
                            'endOffsetY' => 0,
                        ],
                        [
                            'target' => 'opponent',
                            'sprite' => './assets/sukuna/sprites/boom-explosion.gif',
                            'startMs' => 2750,
                            'durationMs' => 1400,
                            'x' => 0,
                            'y' => 0,
                            'scale' => 2,
                        ],
                    ],
                ],
                'Reverse Energy' => [
                    'frames' => [
                        [
                            'sprite' => './assets/sukuna/sprites/REALSUKUNAREGEN.png',
                            'durationMs' => 1500,
                        ],
                    ],
                ],
                'Domain' => [
                    'domainDelayMs' => 1200,
                    'domainImage' => './assets/sukuna/sprites/DomainSukuna.gif',
                    'domainCutsDelayMs' => 1000,
                    'frames' => [
                        [
                            'sprite' => './assets/sukuna/sprites/DOMAINSUKUNA.png',
                            'durationMs' => 9000,
                        ],
                    ],
                        'overlays' => [
                        [
                            'target' => 'opponent',
                            'sprite' => './assets/sukuna/sprites/docorte2.png',
                            'startMs' => 100,
                            'durationMs' => 100,
                            'x' => 0,
                            'y' => 0,
                            'scale' => 1.2,
                        ],
                        [
                            'target' => 'opponent',
                            'sprite' => './assets/sukuna/sprites/docorte3.png',
                            'startMs' => 200,
                            'durationMs' => 100,
                            'x' => 0,
                            'y' => 0,
                            'scale' => 1.2,
                        ],
                        [
                            'target' => 'opponent',
                            'sprite' => './assets/sukuna/sprites/docorte4.png',
                            'startMs' => 300,
                            'durationMs' => 100,
                            'x' => 0,
                            'y' => 0,
                            'scale' => 1.2,
                        ],
                        [
                            'target' => 'opponent',
                            'sprite' => './assets/sukuna/sprites/docorte5.png',
                            'startMs' => 400,
                            'durationMs' => 100,
                            'x' => 0,
                            'y' => -20,
                            'scale' => 1.2,
                        ],
                                                [
                            'target' => 'opponent',
                            'sprite' => './assets/sukuna/sprites/docorte3.png',
                            'startMs' => 200,
                            'durationMs' => 100,
                            'x' => 0,
                            'y' => 0,
                            'scale' => 1.2,
                        ],
                    ],
                    'repeatOverlaysStartMs' => 2000,
                    'repeatOverlays' => 18,
                ],
            ],
            'reactions' => [
                'defendingHit' => [
                    'frames' => [
                        [
                            'sprite' => './assets/sukuna/sprites/sukunadefreal.png',
                            'durationMs' => 1200,
                        ],
                    ],
                ],
            ],
        ];
    }

    protected function getRegeneracaoEnergia(): int {
        return self::REGENERACAO_PROPRIA;
    }
}
