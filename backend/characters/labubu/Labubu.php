<?php

require_once __DIR__ . '/../../Personagem.php';

class Labubu extends Personagem {

    const CUSTO_MORANGO_DO_AMOR = 600;
    const CUSTO_LABUAURA = 400;
    const DANO_MORANGO_DO_AMOR = 80;
    const CURA_LABUAURA = 67;

    public function __construct(string $nome) {
        parent::__construct($nome, 300, 20, 2067);
    }

    public static function getDescricao(): string {
        return "Labubu (balanced HP, habilidades de bolha e cura, sprite base: LABUBU.png)";
    }

    public function MorangodoAmor(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_MORANGO_DO_AMOR);

        $resultado = $this->executarAtaqueDireto($alvo, "MorangodoAmor", self::DANO_MORANGO_DO_AMOR);

        return $resultado['mensagem'];
    }

    public function labuaura(): string {
        $this->consumirEnergia(self::CUSTO_LABUAURA);

        $this->curarVida(self::CURA_LABUAURA);

        return $this->formatarMensagemAcaoSemAlvo("labuaura (cura " . self::CURA_LABUAURA . ")");
    }

    public function usarHabilidadeEspecial(Personagem $alvo): string {
        return $this->MorangodoAmor($alvo);
    }

    public function getHabilidades(): array {
        return [
            ["nome" => "MorangodoAmor","metodo" => "MorangodoAmor","precisaAlvo" => true,  "energyCost" => self::CUSTO_MORANGO_DO_AMOR],
            ["nome" => "labuaura",     "metodo" => "labuaura",    "precisaAlvo" => false, "energyCost" => self::CUSTO_LABUAURA]
        ];
    }

    public function getDescricoesAcoes(): array {
        return array_merge(parent::getDescricoesAcoes(), [
            'MorangodoAmor' => 'Causa ' . self::DANO_MORANGO_DO_AMOR . ' de dano. Custo: ' . self::CUSTO_MORANGO_DO_AMOR . ' energia.',
            'labuaura' => 'Cura ' . self::CURA_LABUAURA . ' de vida. Custo: ' . self::CUSTO_LABUAURA . ' energia.',
        ]);
    }

    public function getConfiguracaoVisual(): array {
        return [
            'baseSprite' => './assets/labubu/sprites/LABUBU.png',
            'winImage' => './assets/labubu/sprites/labubufarm.png',
            'actions' => [
                'Ataque' => [
                    'frames' => [
                        [
                            'sprite' => './assets/labubu/sprites/labubo.png',
                            'durationMs' => 450,
                        ],
                        [
                            'sprite' => './assets/labubu/sprites/labubo2.png',
                            'durationMs' => 350,
                        ],
                    ],
                ],
                'labuaura' => [
                    'frames' => [
                        [
                            'sprite' => './assets/labubu/sprites/AURALUTRUETRUE.png',
                            'durationMs' => 1900,
                        ],
                    ],
                ],
                'MorangodoAmor' => [
                    'frames' => [
                        [
                            'sprite' => './assets/labubu/sprites/LANCE.png',
                            'durationMs' => 800,
                        ],
                        [
                            'sprite' => './assets/labubu/sprites/MORANGOLABUBU.png',
                            'durationMs' => 600,
                        ],
                    ],
                    'overlays' => [
                        [
                            'mode' => 'projectile',
                            'target' => 'opponent',
                            'sprite' => './assets/labubu/sprites/AMORMORANGO.png',
                            'startMs' => 1100,
                            'durationMs' => 500,
                            'sizePx' => 280,
                            'frontOffsetPx' => 130,
                            'projectileAngleDeg' => -15,
                            'startOffsetX' => 0,
                            'startOffsetY' => -20,
                            'endOffsetX' => 0,
                            'endOffsetY' => 50,
                        ],
                    ],
                ],
            ],
            'reactions' => [
                'defendingHit' => [
                    'frames' => [
                        [
                            'sprite' => './assets/labubu/sprites/DEFENDELABUBU.png',
                            'durationMs' => 1200,
                        ],
                    ],
                ],
            ],
        ];
    }
}
