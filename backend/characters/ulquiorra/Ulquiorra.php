<?php

require_once __DIR__ . '/../../Personagem.php';

class Ulquiorra extends Personagem {

    const CUSTO_CERO = 90;
    const CUSTO_TRUE_CERO = 90;
    const CUSTO_BARRAGE = 75;
    const CUSTO_HEAL = 170;
    const DANO_CERO = 70;
    const DANO_TRUE_CERO = 110;
    const DANO_BARRAGE = 60;
    const BARRAGE_BLEED_PERCENTUAL = 0.30;
    const BARRAGE_BLEED_TURNOS = 2;
    const CURA_HEAL = 100;
    const REGENERACAO_PROPRIA = 40;

    public function __construct(string $nome) {
        parent::__construct($nome, 240, 30, 400);
    }

    public static function getDescricao(): string {
        return "Ulquiorra (HP alto, ataque alto, energia média, habilidades: Cero, cero oscuras, Barrage e Heal)";
    }

    public function cero(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_CERO);
        $resultado = $this->executarAtaqueDireto($alvo, "Cero", self::DANO_CERO);

        return $resultado['mensagem'];
    }

    public function heal(): string {
        $this->consumirEnergia(self::CUSTO_HEAL);
        $this->curarVida(self::CURA_HEAL);

        return $this->formatarMensagemAcaoSemAlvo("Heal");
    }

    public function trueCero(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_TRUE_CERO);
        $resultado = $this->executarAtaqueDireto($alvo, "cero oscuras", self::DANO_TRUE_CERO);

        return $resultado['mensagem'];
    }

    public function barrage(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_BARRAGE);
        $resultado = $this->executarAtaqueDireto($alvo, "Barrage", self::DANO_BARRAGE);

        if (!$resultado['acertou']) {
            return $resultado['mensagem'];
        }

        $danoBleed = (int) ceil(self::DANO_BARRAGE * self::BARRAGE_BLEED_PERCENTUAL);
        if ($danoBleed > 0) {
            $alvo->aplicarSangramento($danoBleed, self::BARRAGE_BLEED_TURNOS);
        }

        $mensagem = $resultado['mensagem'];

        if ($danoBleed > 0) {
            $mensagem .= " Sangramento aplicado por " . self::BARRAGE_BLEED_TURNOS . " turnos ({$danoBleed} por turno).";
        }

        return $mensagem;
    }

    public function usarHabilidadeEspecial(Personagem $alvo): string {
        return $this->cero($alvo);
    }

    public function getHabilidades(): array {
        return [
            ["nome" => "Cero",        "metodo" => "cero",     "precisaAlvo" => true,  "energyCost" => self::CUSTO_CERO],
            ["nome" => "cero oscuras","metodo" => "trueCero", "precisaAlvo" => true,  "energyCost" => self::CUSTO_TRUE_CERO],
            ["nome" => "Barrage",     "metodo" => "barrage",  "precisaAlvo" => true,  "energyCost" => self::CUSTO_BARRAGE],
            ["nome" => "Heal",        "metodo" => "heal",     "precisaAlvo" => false, "energyCost" => self::CUSTO_HEAL]
        ];
    }

    public function getDescricoesAcoes(): array {
        return array_merge(parent::getDescricoesAcoes(), [
            'Cero' => 'Causa ' . self::DANO_CERO . ' de dano. Custo: ' . self::CUSTO_CERO . ' energia.',
            'cero oscuras' => 'Causa ' . self::DANO_TRUE_CERO . ' de dano. Custo: ' . self::CUSTO_TRUE_CERO . ' energia.',
            'Barrage' => 'Causa ' . self::DANO_BARRAGE . ' de dano. Bleed: ' . (int) ceil(self::DANO_BARRAGE * self::BARRAGE_BLEED_PERCENTUAL) . ' por turno por ' . self::BARRAGE_BLEED_TURNOS . ' turnos. Custo: ' . self::CUSTO_BARRAGE . ' energia.',
            'Heal' => 'Cura ' . self::CURA_HEAL . ' de vida. Custo: ' . self::CUSTO_HEAL . ' energia.',
        ]);
    }

    public function getConfiguracaoVisual(): array {
        return [
            'baseSprite' => './assets/ulquiorra/sprites/REALCIFERBASE.png',
            'winImage' => './assets/ulquiorra/sprites/winulq.png',
            'actions' => [
                'Ataque' => [
                    'frames' => [
                        [
                            'sprite' => './assets/ulquiorra/sprites/ciferhit1.png',
                            'durationMs' => 400,
                        ],
                        [
                            'sprite' => './assets/ulquiorra/sprites/ciferhit2.png',
                            'durationMs' => 400,
                        ],
                    ],
                ],
                'Cero' => [
                    'frames' => [
                        [
                            'sprite' => './assets/ulquiorra/sprites/cifercero1.png',
                            'durationMs' => 1000,
                        ],
                        [
                            'sprite' => './assets/ulquiorra/sprites/cifercero2TRUE.png',
                            'durationMs' => 1000,
                        ],
                    ],
                    'overlays' => [
                        [
                            'mode' => 'beam',
                            'target' => 'opponent',
                            'startMs' => 1000,
                            'durationMs' => 650,
                            'thicknessPx' => 38,
                            'frontOffsetPx' => 90,
                            'startOffsetX' => 0,
                            'startOffsetY' => 15,
                            'endOffsetX' => 0,
                            'endOffsetY' => 40,
                        ],
                    ],
                ],
                'cero oscuras' => [
                    'frames' => [
                        [
                            'sprite' => './assets/ulquiorra/sprites/preform.png',
                            'durationMs' => 1000,
                        ],
                        [
                            'sprite' => './assets/ulquiorra/sprites/ciferfinalform.png',
                            'durationMs' => 1250,
                        ],
                        [
                            'sprite' => './assets/ulquiorra/sprites/ciferfinalcero.png',
                            'durationMs' => 1100,
                        ],
                    ],
                    'overlays' => [
                        [
                            'mode' => 'beam',
                            'target' => 'opponent',
                            'startMs' => 2500,
                            'durationMs' => 650,
                            'thicknessPx' => 44,
                            'frontOffsetPx' => 90,
                            'startOffsetX' => 0,
                            'startOffsetY' => 15,
                            'endOffsetX' => 0,
                            'endOffsetY' => 40,
                            'beamTone' => 'dark',
                        ],
                    ],
                ],
                'Barrage' => [
                    'frames' => [
                        [
                            'sprite' => './assets/ulquiorra/sprites/ulqbarrage1.png',
                            'durationMs' => 150,
                        ],
                        [
                            'sprite' => './assets/ulquiorra/sprites/ulqbarrage2.png',
                            'durationMs' => 150,
                        ],
                        [
                            'sprite' => './assets/ulquiorra/sprites/barrage.png',
                            'durationMs' => 150,
                        ],
                        [
                            'sprite' => './assets/ulquiorra/sprites/ulqbarrage1.png',
                            'durationMs' => 150,
                        ],
                        [
                            'sprite' => './assets/ulquiorra/sprites/ulqbarrage2.png',
                            'durationMs' => 150,
                        ],
                        [
                            'sprite' => './assets/ulquiorra/sprites/barrage.png',
                            'durationMs' => 150,
                        ],
                        [
                            'sprite' => './assets/ulquiorra/sprites/ulqbarrage1.png',
                            'durationMs' => 150,
                        ],
                        [
                            'sprite' => './assets/ulquiorra/sprites/ulqbarrage2.png',
                            'durationMs' => 150,
                        ],
                        [
                            'sprite' => './assets/ulquiorra/sprites/barrage.png',
                            'durationMs' => 150,
                        ],
                        [
                            'sprite' => './assets/ulquiorra/sprites/ulqbarrage1.png',
                            'durationMs' => 150,
                        ],
                        [
                            'sprite' => './assets/ulquiorra/sprites/ulqbarrage2.png',
                            'durationMs' => 150,
                        ],
                        [
                            'sprite' => './assets/ulquiorra/sprites/barrage.png',
                            'durationMs' => 150,
                        ],
                    ],
                ],
                'Heal' => [
                    'frames' => [
                        [
                            'sprite' => './assets/ulquiorra/sprites/ulqregen.png',
                            'durationMs' => 1500,
                        ],
                    ],
                ],
            ],
            'reactions' => [
                'defendingHit' => [
                    'frames' => [
                        [
                            'sprite' => './assets/ulquiorra/sprites/ciferdef.png',
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
