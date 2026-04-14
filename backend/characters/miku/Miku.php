<?php

require_once __DIR__ . '/../../Personagem.php';

class Miku extends Personagem {

    const VELOCIDADE = 75;
    const CUSTO_MIKUPOWER = 100;
    const CUSTO_MY_VOICE = 90;
    const CUSTO_MIKU_BEEAM = 120;
    const CUSTO_MAGIC = 130;
    const CURA_MIKUPOWER = 100;
    const DANO_MY_VOICE = 60;
    const DANO_MIKU_BEEAM = 120;
    const DANO_MAGIC = 80;
    const REGENERACAO_PROPRIA = 30;

    public function __construct(string $nome) {
        parent::__construct($nome, 200, 20, 500);
    }

    public static function getDescricao(): string {
        return "Miku (balanceada, habilidades: mikupower, MY VOICE, Miku BEEAM e MAGIC!)";
    }

    public function magic(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_MAGIC);
        $resultado = $this->executarAtaqueDireto($alvo, "MAGIC!", self::DANO_MAGIC);

        return $resultado['mensagem'];
    }

    public function mikuBeeam(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_MIKU_BEEAM);
        $resultado = $this->executarAtaqueDireto($alvo, "Miku BEEAM", self::DANO_MIKU_BEEAM);

        return $resultado['mensagem'];
    }

    public function myVoice(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_MY_VOICE);
        $resultado = $this->executarAtaqueDireto($alvo, "MY VOICE", self::DANO_MY_VOICE);

        return $resultado['mensagem'];
    }

    public function mikupower(): string {
        $this->consumirEnergia(self::CUSTO_MIKUPOWER);
        $this->curarVida(self::CURA_MIKUPOWER);

        return $this->formatarMensagemAcaoSemAlvo("mikupower");
    }

    public function usarHabilidadeEspecial(Personagem $alvo): string {
        return $this->atacar($alvo);
    }

    public function getHabilidades(): array {
        return [
            ["nome" => "MAGIC!",    "metodo" => "magic",      "precisaAlvo" => true,  "energyCost" => self::CUSTO_MAGIC, "clashable" => true    ],
            ["nome" => "Miku BEEAM","metodo" => "mikuBeeam",  "precisaAlvo" => true,  "energyCost" => self::CUSTO_MIKU_BEEAM, "priority" => true],
            ["nome" => "MY VOICE",  "metodo" => "myVoice",    "precisaAlvo" => true,  "energyCost" => self::CUSTO_MY_VOICE],
            ["nome" => "mikupower", "metodo" => "mikupower",  "precisaAlvo" => false, "energyCost" => self::CUSTO_MIKUPOWER]
        ];
    }

    public function getDescricoesAcoes(): array {
        return array_merge(parent::getDescricoesAcoes(), [
            'MAGIC!' => 'Conjura projéteis mágicos em sequência contra o inimigo.' . "\n" . 'Dano: ' . self::DANO_MAGIC . " " . 'Custo: ' . self::CUSTO_MAGIC,
            'Miku BEEAM' => 'Dispara um feixe de energia rosa concentrado.' . "\n" . 'Dano: ' . self::DANO_MIKU_BEEAM . " " . 'Custo: ' . self::CUSTO_MIKU_BEEAM,
            'MY VOICE' => 'Solta um grito poderoso que derruba o inimigo.' . "\n" . 'Dano: ' . self::DANO_MY_VOICE . " " . 'Custo: ' . self::CUSTO_MY_VOICE,
            'mikupower' => 'Canaliza o poder da música para recuperar vida.' . "\n" . 'Cura: ' . self::CURA_MIKUPOWER . " " . 'Custo: ' . self::CUSTO_MIKUPOWER,
        ]);
    }

    public function getConfiguracaoVisual(): array {
        return [
            'baseSprite' => './assets/miku/sprites/mikubase.png',
            'winMessage' => 'Miku Miku, you can call me M I K U',
            'winImage' => './assets/miku/sprites/mikuganho.jpeg',
            'actions' => [
                'Ataque' => [
                    'audio' => [
                        [
                            'file' => './assets/miku/audios/dorime.mp3',
                            'startMs' => 0,
                            'durationMs' => 1700,
                        ],
                    ],
                    'frames' => [
                        [
                            'sprite' => './assets/miku/sprites/mikuprebeamreal.png',
                            'durationMs' => 600,
                        ],
                        [
                            'sprite' => './assets/miku/sprites/ATAQUEREAALA.png',
                            'durationMs' => 600,
                        ],
                    ],
                ],
                'MAGIC!' => [
                    'audio' => [
                        [
                            'file' => './assets/miku/audios/mikumiku.mp3',
                            'startMs' => 0,
                            'durationMs' => 1700,
                        ],
                    ],
                    'frames' => [
                        [
                            'sprite' => './assets/miku/sprites/outro.png',
                            'durationMs' => 450,
                        ],
                        [
                            'sprite' => './assets/miku/sprites/MAGIC2REAL.png',
                            'durationMs' => 650,
                        ],
                        [
                            'sprite' => './assets/miku/sprites/MAGIC3.png',
                            'durationMs' => 700,
                        ],
                    ],
                     'overlays' => [
                        [
                            'mode' => 'projectile',
                            'target' => 'opponent',
                            'sprite' => './assets/miku/sprites/mag2.png',
                            'startMs' => 500,
                            'durationMs' => 1000,
                            'sizePx' => 80,
                            'frontOffsetPx' => 130,
                            'projectileAngleDeg' => -15,
                            'startOffsetX' => 0,
                            'startOffsetY' => -5,
                            'endOffsetX' => 0,
                            'endOffsetY' => 50,
                        ],
                         [
                            'mode' => 'projectile',
                            'target' => 'opponent',
                            'sprite' => './assets/miku/sprites/mag1.png',
                            'startMs' => 1000,
                            'durationMs' => 1400,
                            'sizePx' => 80,
                            'frontOffsetPx' => 130,
                            'projectileAngleDeg' => -15,
                            'startOffsetX' => 0,
                            'startOffsetY' => -5,
                            'endOffsetX' => 0,
                            'endOffsetY' => 50,
                        ],
                    ],
                ],
                'Miku BEEAM' => [
                    'audio' => [
                        [
                            'file' => './assets/miku/audios/mikubeam.mp3',
                            'startMs' => 0,
                            'durationMs' => 3000,
                        ],
                    ],
                    'frames' => [
                        [
                            'sprite' => './assets/miku/sprites/MIKUBEEAM1.png',
                            'durationMs' => 600,
                        ],
                         [
                            'sprite' => './assets/miku/sprites/MIKUBEEAM2.png',
                            'durationMs' => 1000,
                        ],
                    ],
                    'overlays' => [
                        [
                            'mode' => 'beam',
                            'target' => 'opponent',
                            'startMs' => 1050,
                            'durationMs' => 1150,
                            'thicknessPx' => 38,
                            'frontOffsetPx' => 90,
                            'startOffsetX' => -60,
                            'startOffsetY' => 15,
                            'endOffsetX' => 0,
                            'endOffsetY' => 10,
                            'beamTone' => 'pink',
                        ],
                    ],
                ],
                'MY VOICE' => [
                    'audio' => [
                        [
                            'file' => './assets/miku/audios/wee.mp3',
                            'startMs' => 0,
                            'durationMs' => 2000,
                        ],
                    ],
                    'frames' => [
                        [
                            'sprite' => './assets/miku/sprites/mikuprebeamreal.png',
                            'durationMs' => 600,
                        ],
                        [
                            'sprite' => './assets/miku/sprites/mikugrito1real.png',
                            'durationMs' => 500,
                        ],
                        [
                            'sprite' => './assets/miku/sprites/mukibeamtrue.png',
                            'durationMs' => 300,
                        ],
                         [
                            'sprite' => './assets/miku/sprites/mikufinalbeamREAL.png',
                            'durationMs' => 600,
                        ],
                    ],
                     'overlays' => [
                        [
                            'target' => 'opponent',
                            'sprite' => './assets/miku/sprites/MIKUHEART.png',
                            'startMs' => 1400,
                            'durationMs' => 400,
                            'x' => 0,
                            'y' => 0,
                            'scale' => 1,
                        ],
                     ],
                ],
                'mikupower' => [
                    'audio' => [
                        [
                            'file' => './assets/miku/audios/charge.mp3',
                            'startMs' => 0,
                            'durationMs' => 2400,
                        ],
                    ],
                    'frames' => [
                        [
                            'sprite' => './assets/miku/sprites/mikupower1.png',
                            'durationMs' => 140,
                        ],
                        [
                            'sprite' => './assets/miku/sprites/mikupower2.png',
                            'durationMs' => 140,
                        ],
                        [
                            'sprite' => './assets/miku/sprites/mikupower3.png',
                            'durationMs' => 140,
                        ],
                        [
                            'sprite' => './assets/miku/sprites/mikupower4.png',
                            'durationMs' => 140,
                        ],
                    ],
                    'repeatFrames' => 4,
                ],
            ],
            'reactions' => [
                'defendingHit' => [
                    'frames' => [
                        [
                            'sprite' => './assets/miku/sprites/defesamiku.png',
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
