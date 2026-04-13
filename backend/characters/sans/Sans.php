<?php

require_once __DIR__ . '/../../Personagem.php';

class Sans extends Personagem {

    const CUSTO_BLUESOUL = 150;
    const DANO_BLUESOUL = 90;
    const CUSTO_COMECOU = 120;
    const DANO_COMECOU = 80;
    const CUSTO_BADTIME = 200;
    const DANO_BADTIME = 120;
    const RECUPERACAO_EH_EH = 100;
    const REGENERACAO_PROPRIA = 0;

    public function __construct(string $nome) {
        parent::__construct($nome, 1, 1, 800);
    }

    public static function getDescricao(): string {

        return "Sans (HP baixíssimo, ataque alto, passiva: esquiva usando energia, habilidade: bluesoul)";
    }

    public function receberDano(int $danoReal): void {
        $tipoDano = $this->consumirTipoDanoRecebido();
        $danoReal = $this->aplicarReducaoDanoDefesa($danoReal);

        if ($danoReal <= 0) {
            return;
        }

        if ($this->energiaAtual > 0) {
            $this->energiaAtual -= $danoReal;

            if ($this->energiaAtual < 0) {
                $this->energiaAtual = 0;
            }

            return;
        }

        $this->registrarTipoDanoRecebido($tipoDano);

        $this->vidaAtual -= $danoReal;

        if ($this->vidaAtual < 0) {
            $this->vidaAtual = 0;
        }
    }

    public function bluesoul(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_BLUESOUL);
        $resultado = $this->executarAtaqueDireto($alvo, "bluesoul", self::DANO_BLUESOUL);

        return $resultado['mensagem'];
    }

    public function comecou(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_COMECOU);
        $resultado = $this->executarAtaqueDireto($alvo, "começou", self::DANO_COMECOU);

        return $resultado['mensagem'];
    }

    public function badtime(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_BADTIME);
        $resultado = $this->executarAtaqueDireto($alvo, "BADTIME", self::DANO_BADTIME);

        return $resultado['mensagem'];
    }

    public function ehEh(): string {
        $this->energiaAtual = min($this->energiaMaxima, $this->energiaAtual + self::RECUPERACAO_EH_EH);

        return $this->formatarMensagemAcaoSemAlvo("eh eh");
    }

    public function usarHabilidadeEspecial(Personagem $alvo): string {
        return $this->bluesoul($alvo);
    }

    public function getHabilidades(): array {

        return [
            [
                "nome" => "bluesoul",
                "metodo" => "bluesoul",
                "precisaAlvo" => true,
                "energyCost" => self::CUSTO_BLUESOUL
            ],
            [
                "nome" => "começou",
                "metodo" => "comecou",
                "precisaAlvo" => true,
                "energyCost" => self::CUSTO_COMECOU
            ],
            [
                "nome" => "BADTIME",
                "metodo" => "badtime",
                "precisaAlvo" => true,
                "energyCost" => self::CUSTO_BADTIME
            ],
            [
                "nome" => "eh eh",
                "metodo" => "ehEh",
                "precisaAlvo" => false,
                "energyCost" => 0,
                "melee" => true
            ]
        ];
    }

    public function getDescricoesAcoes(): array {
        return array_merge(parent::getDescricoesAcoes(), [
            'bluesoul' => 'Manipule a gravidade do oponente.' . "\n" . 'Dano: ' . self::DANO_BLUESOUL . "\n" . 'Custo: ' . self::CUSTO_BLUESOUL,
            'começou' => 'Comece bem...' . "\n" . 'Dano: ' . self::DANO_COMECOU . "\n" . 'Custo: ' . self::CUSTO_COMECOU,
            'BADTIME' => 'Mostre ao oponente oque é passar por uns tempos ruins.' . "\n" . 'Dano: ' . self::DANO_BADTIME . "\n" . 'Custo: ' . self::CUSTO_BADTIME,
            'eh eh' => 'Recupera energia da melhor maneira.' . "\n" . 'Recupera: ' . self::RECUPERACAO_EH_EH,
        ]);
    }

    public function getConfiguracaoVisual(): array {
        return [
            'baseSprite' => './assets/sans/sprites/SANSBASEFINAL.png',
            'winMessage' => 'Em dias como esses, crianças como você... deviam queimar no inferno.',
            'winImage' => './assets/sans/sprites/sansrealista.jpg',
            'dodgeSprite' => './assets/sans/sprites/SANSSKILL1FINAL.png',
            'actions' => [
                'bluesoul' => [
                    'domainDelayMs' => 1500,
                    'domainImage' => './assets/sans/sprites/batebate.gif',
                    'frames' => [
                        [
                            'sprite' => './assets/sans/sprites/BADTIMEE.png',
                            'durationMs' => 1500,
                            'scale' => 0.9,
                        ],
                        [
                            'sprite' => './assets/sans/sprites/NADA.png',
                            'durationMs' => 5000,
                        ],
                    ],
                    'overlays' => [
                        [
                            'target' => 'opponent',
                            'sprite' => './assets/sans/sprites/blueheart.png',
                            'startMs' => 1500,
                            'durationMs' => 5000,
                            'x' => -30,
                            'y' => 0,
                            'scale' => 0.12,
                        ],
                     ],
                ],
                'começou' => [
                    'domainDelayMs' => 1500,
                    'domainImage' => './assets/sans/sprites/start.gif',
                    'frames' => [
                        [
                            'sprite' => './assets/sans/sprites/SANSKILL1FINAL.png',
                            'durationMs' => 1500,
                        ],
                        [
                            'sprite' => './assets/sans/sprites/NADA.png',
                            'durationMs' => 7200,
                        ],
                    ],
                    'overlays' => [
                        [
                            'target' => 'opponent',
                            'sprite' => './assets/sans/sprites/heart.png',
                            'startMs' => 1500,
                            'durationMs' => 7200,
                            'x' => -30,
                            'y' => 0,
                            'scale' => 0.11,
                        ],
                     ],
                ],
                'BADTIME' => [
                    'domainDelayMs' => 1500,
                    'domainImage' => './assets/sans/sprites/finalsans.gif',
                    'frames' => [
                        [
                            'sprite' => './assets/sans/sprites/BADTIMEE.png',
                            'durationMs' => 1500,
                            'scale' => 0.9,
                        ],
                        [
                            'sprite' => './assets/sans/sprites/NADA.png',
                            'durationMs' => 2700,
                        ],
                    ],
                    'overlays' => [
                        [
                            'target' => 'opponent',
                            'sprite' => './assets/sans/sprites/heart.png',
                            'startMs' => 1500,
                            'durationMs' => 2700,
                            'x' => -30,
                            'y' => 0,
                            'scale' => 0.11,
                        ],
                     ],
                ],
                'eh eh' => [
                    'frames' => [
                        [
                            'sprite' => './assets/sans/sprites/seguraopassodosans.gif',
                            'durationMs' => 3000,
                            'scale' => 0.57,
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