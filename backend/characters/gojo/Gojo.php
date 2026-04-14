<?php

require_once __DIR__ . '/../../Personagem.php';

class Gojo extends Personagem {

    const VELOCIDADE = 90;
    const CUSTO_INFINITO = 300;
    const CUSTO_REVERSE = 200;
    const CUSTO_VAZIO_ROXO = 200;
    const CUSTO_AZUL = 100;
    const DANO_AZUL = 40;
    const DANO_VAZIO_ROXO = 100;
    const CURA_REVERSE = 100;
    const REGENERACAO_PROPRIA = 50;

    public function __construct(string $nome) {
        parent::__construct($nome, 300, 20, 1000);
    }

    public static function getDescricao(): string {
        return "Gojo (HP alto, energia muito alta, habilidades: Azul, Vazio Roxo, Reverse Energy e Domain)";
    }

    public function vazioRoxo(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_VAZIO_ROXO);

        $resultado = $this->executarAtaqueDireto($alvo, "Vazio Roxo", self::DANO_VAZIO_ROXO);

        return $resultado['mensagem'];
    }

    public function azul(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_AZUL);

        $resultado = $this->executarAtaqueDireto($alvo, "Azul", self::DANO_AZUL);

        return $resultado['mensagem'];
    }

    public function reverseEnergy(): string {
        $this->consumirEnergia(self::CUSTO_REVERSE);
        $this->curarVida(self::CURA_REVERSE);

        return $this->formatarMensagemAcaoSemAlvo("Reverse Energy");
    }

    public function infinityVoid(): string {
        $this->consumirEnergia(self::CUSTO_INFINITO);

        return $this->formatarMensagemAcaoSemAlvo("Domain");
    }

    public function usarHabilidadeEspecial(Personagem $alvo): string {
        return $this->vazioRoxo($alvo);
    }

    public function getHabilidades(): array {
        return [
            ["nome" => "Azul",          "metodo" => "azul",          "precisaAlvo" => true,  "energyCost" => self::CUSTO_AZUL],
            ["nome" => "Vazio Roxo",    "metodo" => "vazioRoxo",     "precisaAlvo" => true,  "energyCost" => self::CUSTO_VAZIO_ROXO, "priority" => true, "clashable" => true],
            ["nome" => "Reverse Energy","metodo" => "reverseEnergy", "precisaAlvo" => false, "energyCost" => self::CUSTO_REVERSE],
            ["nome" => "Domain",        "metodo" => "infinityVoid",  "precisaAlvo" => false, "energyCost" => self::CUSTO_INFINITO, "skipTurns" => 2, "activatesDomain" => true, "domainClash" => true, "priority" => true]
        ];
    }

    public function getDescricoesAcoes(): array {
        return array_merge(parent::getDescricoesAcoes(), [
            'Azul' => 'Cria um ponto de atração que comprime o inimigo.' . "\n" . 'Dano: ' . self::DANO_AZUL . " " . 'Custo: ' . self::CUSTO_AZUL,
            'Vazio Roxo' => 'Combina atração e repulsão em um projétil que apaga tudo.' . "\n" . 'Dano: ' . self::DANO_VAZIO_ROXO . " " . 'Custo: ' . self::CUSTO_VAZIO_ROXO,
            'Reverse Energy' => 'Inverte a energia amaldiçoada para curar ferimentos.' . "\n" . 'Cura: ' . self::CURA_REVERSE . " " . 'Custo: ' . self::CUSTO_REVERSE,
            'Domain' => 'Expande o Vazio Infinito, paralisando o inimigo por 2 turnos.' . "\n" . 'Custo: ' . self::CUSTO_INFINITO,
        ]);
    }

    public function getConfiguracaoVisual(): array {
        return [
            'baseSprite' => './assets/gojo/sprites/GOJOBASEFINAL.png',
            'winMessage' => 'Nah, id win',
            'winImage' => './assets/gojo/sprites/gojowin.jpg',
            'actions' => [
                'Ataque' => [
                    'audio' => [
                        [
                            'file' => './assets/audiosgerais/punchs2.mp3',
                            'startMs' => 0,
                            'durationMs' => 1300,
                        ],
                    ],
                    'frames' => [
                        [
                            'sprite' => './assets/gojo/sprites/gojopancadafinalmenor.png',
                            'durationMs' => 500,
                            'scale' => 0.95,
                        ],
                        [
                            'sprite' => './assets/gojo/sprites/gojohitpt2.png',
                            'durationMs' => 500,
                            'scale' => 0.95,
                        ],
                    ],
                ],
                'Azul' => [
                    'audio' => [
                        [ 
                            'file' => './assets/gojo/audios/Azul.mp3',
                            'startMs' => 0,
                            
                        ],
                    ],
                    'frames' => [
                        [
                            'sprite' => './assets/gojo/sprites/gojoazulfinalreal.png',
                            'durationMs' => 1500,
                        ],
                        [
                            'sprite' => './assets/gojo/sprites/gojoblockrealreal.png',
                            'durationMs' => 200,
                        ],
                    ],
                    'overlays' => [
                        [
                            'target' => 'opponent',
                            'sprite' => './assets/gojo/sprites/AZUL.png',
                            'startMs' => 1500,
                            'durationMs' => 1000,
                            'x' => 0,
                            'y' => 0,
                            'scale' => 1,
                        ],
                    ],
                ],
                'Vazio Roxo' => [
                    'audio' => [
                        [
                            'file'    => './assets/gojo/audios/gojoroxo.mp3',
                            'startMs' => 0,
                        ],
                        [
                            'file'    => './assets/audiosgerais/bomba.mp3',
                            'startMs' => 2700,
                        ],
                    ],
                    'frames' => [
                        [
                            'sprite' => './assets/gojo/sprites/GOJOROXOFASE1FINAL.png',
                            'durationMs' => 1000,
                        ],
                        [
                            'sprite' => './assets/gojo/sprites/gojoROXOFINALFINALVERDADEIRO.png',
                            'durationMs' => 650,
                        ],
                        [
                            'sprite' => './assets/gojo/sprites/gojoroxolast.png',
                            'durationMs' => 700,
                        ],
                    ],
                    'overlays' => [
                        [
                            'mode' => 'projectile',
                            'target' => 'opponent',
                            'sprite' => './assets/gojo/sprites/ROXO.png',
                            'startMs' => 2000,
                            'durationMs' => 600,
                            'sizePx' => 260,
                            'frontOffsetPx' => 130,
                            'startOffsetX' => 0,
                            'startOffsetY' => -20,
                            'endOffsetX' => 0,
                            'endOffsetY' => 50,
                        ],
                        [
                            'target' => 'opponent',
                            'sprite' => './assets/gojo/sprites/roxocabum.gif',
                            'startMs' => 2700,
                            'durationMs' => 975,
                            'x' => 0,
                            'y' => -40,
                            'scale' => 2.2,
                        ],
                    ],
                ],
                'Reverse Energy' => [
                    'frames' => [
                        [
                            'sprite' => './assets/gojo/sprites/gojoreversofinal.png',
                            'durationMs' => 1500,
                        ],
                    ],
                ],
                'Domain' => [
                    'audio' => [
                        [
                            'file'    => './assets/gojo/audios/domainrealgojo.mp3',
                            'startMs' => 0,
                            'durationMs' => 2000,
                        ],
                    ],
                    'domainDelayMs' => 3000,
                    'domainImage' => './assets/gojo/sprites/DomainGojo.gif',
                    'frames' => [
                        [
                            'sprite' => './assets/gojo/sprites/gojodomainfinal.png',
                            'durationMs' => 3400,
                        ],
                    ],
                ],
            ],
            'reactions' => [
                'defendingHit' => [
                    'frames' => [
                        [
                            'sprite' => './assets/gojo/sprites/gojoblockrealreal.png',
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