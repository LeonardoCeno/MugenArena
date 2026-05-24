<?php

require_once __DIR__ . '/../../Personagem.php';

class Profe extends Personagem {

	const CUSTO_RED_BILL = 120;
	const CUSTO_APELACAO = 180;
	const CUSTO_VIBECODE = 140;

	const CUSTO_MYWORLD = 200;
	const DANO_MYWORLD = 110;
	const CURA_RED_BILL = 67;
	const DANO_APELACAO = 85;
	const DANO_VIBECODE = 70;
	const REGENERACAO_PROPRIA = 35;

	const VELOCIDADE = 60;

	public function __construct(string $nome) {
		parent::__construct($nome, 267, 24, 500);
	}

	public static function getDescricao(): string {
		return 'Profe (balanceado, habilidades: Red bill, Apelação e VibeCode)';
	}

	public function redBill(): string {
		$this->consumirEnergia(self::CUSTO_RED_BILL);
		$this->curarVida(self::CURA_RED_BILL);

		return $this->formatarMensagemAcaoSemAlvo('Red bill');
	}

	public function apelacao(Personagem $alvo): string {
		$this->consumirEnergia(self::CUSTO_APELACAO);
		$resultado = $this->executarAtaqueDireto($alvo, 'Apelação', self::DANO_APELACAO);

		return $resultado['mensagem'];
	}

	public function vibeCode(Personagem $alvo): string {
		$this->consumirEnergia(self::CUSTO_VIBECODE);
		$resultado = $this->executarAtaqueDireto($alvo, 'VibeCode', self::DANO_VIBECODE);

		return $resultado['mensagem'];
	}

	public function usarHabilidadeEspecial(Personagem $alvo): string {
		return $this->apelacao($alvo);
	}

	    public function MyWorld(Personagem $alvo): string {
        $this->consumirEnergia(self::CUSTO_MYWORLD);
	        $resultado = $this->executarAtaqueDeDomain($alvo, "DOOCKER", self::DANO_MYWORLD);

        return $resultado['mensagem'];
    }

	public function getHabilidades(): array {
		return [
			["nome" => "Red bill", "metodo" => "redBill", "precisaAlvo" => false, "energyCost" => self::CUSTO_RED_BILL],
			["nome" => "Apelação", "metodo" => "apelacao", "precisaAlvo" => true,  "energyCost" => self::CUSTO_APELACAO],
			["nome" => "VibeCode", "metodo" => "vibeCode", "precisaAlvo" => true,  "energyCost" => self::CUSTO_VIBECODE, "clashable" => true, "priority" => true,],
			["nome" => "DOOCKER",  "metodo" => "MyWorld",  "precisaAlvo" => true,  "energyCost" => self::CUSTO_MYWORLD, "skipTurns" => 1, "activatesDomain" => true, "domainClash" => true, "priority" => true, ]
		];
	}

	public function getDescricoesAcoes(): array {
		return array_merge(parent::getDescricoesAcoes(), [
			'Red bill' => 'Toma um Red Bull e recupera energia vital.' . "\n" . 'Cura: ' . self::CURA_RED_BILL . " " . 'Custo: ' . self::CUSTO_RED_BILL,
			'Apelação' => 'Apela à autoridade máxima e dispara no inimigo.' . "\n" . 'Dano: ' . self::DANO_APELACAO . " " . 'Custo: ' . self::CUSTO_APELACAO,
			'VibeCode' => 'Lança ferramentas de desenvolvimento como projéteis.' . "\n" . 'Dano: ' . self::DANO_VIBECODE . " " . 'Custo: ' . self::CUSTO_VIBECODE,
			'DOOCKER' => 'Invoca o godDOCKER, mogando e dockerizando o beta por 1 turno.' . "\n" . 'Dano: ' . self::DANO_MYWORLD . " " . 'Custo: ' . self::CUSTO_MYWORLD,
		]);
	}

	public function getConfiguracaoVisual(): array {
		return [
			'baseSprite' => './assets/profe/sprites/smurfprofe.png',
			'winMessage' => 'Claude, faça os tiros valerem a pena...',
			'winImage' => './assets/profe/sprites/profefarmo.png',
			'actions' => [
				'Ataque' => [
					'audio' => [
						[
							'file'    => './assets/profe/audios/pancada.mp3',
							'startMs' => 0,
						],
                    ],
					'frames' => [
						[
							'sprite' => './assets/profe/sprites/PANCADA.png',
							'durationMs' => 1000,
						],
						[
							'sprite' => './assets/profe/sprites/PANCADADOIS.png',
							'durationMs' => 950,
						],
					],
				],
				'Red bill' => [
					'audio' => [
						[
							'file'    => './assets/profe/audios/beber.mp3',
							'startMs' => 0,
						],
                    ],
					'frames' => [
						[
							'sprite' => './assets/profe/sprites/redbil.png',
							'durationMs' => 1400,
						],
					],
				],
				'Apelação' => [
					'audio' => [
						[
							'file'    => './assets/profe/audios/shot.mp3',
							'startMs' => 800,
						],
					],
					'frames' => [
						[
							'sprite' => './assets/profe/sprites/THELAST.png',
							'durationMs' => 700,
						],
						[
							'sprite' => './assets/profe/sprites/ATIRO.png',
							'durationMs' => 700,
						],
					],
					'overlays' => [
						[
							'mode' => 'projectile',
							'target' => 'opponent',
							'sprite' => './assets/profe/sprites/sla.webp',
							'startMs' => 700,
							'durationMs' => 200,
							'sizePx' => 40,
							'frontOffsetPx' => 140,
							'projectileAngleDeg' => -12,
							'startOffsetX' => 10,
							'startOffsetY' => 0,
							'endOffsetX' => 0,
							'endOffsetY' => 10,
						],
					],
				],
				'VibeCode' => [
					'audio' => [
                        [
                            'file' => './assets/profe/audios/vibecodigo.mp3',
                            'startMs' => 700,
                            'durationMs' => 1900,
                        ],
                    ],
					'frames' => [
						[
							'sprite' => './assets/profe/sprites/PROGRAMA.png',
							'durationMs' => 750,
						],
						[
							'sprite' => './assets/profe/sprites/PROGRAMAPRIME.png',
							'durationMs' => 700,
						],
					],
					'overlays' => [
						[
							'mode' => 'projectile',
							'target' => 'opponent',
							'sprite' => './assets/profe/sprites/DOCKERR.png',
							'startMs' => 750,
							'durationMs' => 900,
							'sizePx' => 200,
							'frontOffsetPx' => 120,
							'projectileAngleDeg' => -10,
							'startOffsetX' => 10,
							'startOffsetY' => -10,
							'endOffsetX' => 0,
							'endOffsetY' => 45,
						],
                        [
							'mode' => 'projectile',
							'target' => 'opponent',
							'sprite' => './assets/profe/sprites/LINUXX.png',
							'startMs' => 1000,
							'durationMs' => 900,
							'sizePx' => 200,
							'frontOffsetPx' => 120,
							'projectileAngleDeg' => -10,
							'startOffsetX' => 10,
							'startOffsetY' => -10,
							'endOffsetX' => 0,
							'endOffsetY' => 45,
						],
                        [
							'mode' => 'projectile',
							'target' => 'opponent',
							'sprite' => './assets/profe/sprites/gpt.png',
							'startMs' => 1200,
							'durationMs' => 900,
							'sizePx' => 200,
							'frontOffsetPx' => 120,
							'projectileAngleDeg' => -10,
							'startOffsetX' => 10,
							'startOffsetY' => -10,
							'endOffsetX' => 0,
							'endOffsetY' => 45,
						],
						[
							'mode' => 'projectile',
							'target' => 'opponent',
							'sprite' => './assets/profe/sprites/claude.png',
							'startMs' => 1400,
							'durationMs' => 900,
							'sizePx' => 200,
							'frontOffsetPx' => 120,
							'projectileAngleDeg' => -10,
							'startOffsetX' => 10,
							'startOffsetY' => -10,
							'endOffsetX' => 0,
							'endOffsetY' => 45,
						],
					],
				],
				'DOOCKER' => [
					'audio' => [
                        [
                            'file'    => './assets/audiosgerais/bomba.mp3',
                            'startMs' => 5150,
                        ],
                    ],
					'domainDelayMs' => 1500,
					'domainImage' => './assets/profe/sprites/domainprofe.png',
					'frames' => [
						[
							'sprite' => './assets/profe/sprites/DOOOCKER.png',
							'durationMs' => 2300,
							'scale' => 1.1,
						],
						[
							'sprite' => './assets/profe/sprites/prepara.png',
							'durationMs' => 1800,
							'scale' => 1.1,
						],
						[
							'sprite' => './assets/profe/sprites/atirar.png',
							'durationMs' => 1500,
							'scale' => 1.1,
						],
					],
					'overlays' => [
						[
							'mode' => 'projectile',
							'target' => 'opponent',
							'sprite' => './assets/profe/sprites/DOCKERPRIME.png',
							'startMs' => 4100,
							'durationMs' => 950,
							'sizePx' => 300,
							'frontOffsetPx' => 130,
							'projectileAngleDeg' => -15,
							'startOffsetX' => 0,
							'startOffsetY' => -20,
							'endOffsetX' => 0,
							'endOffsetY' => 50,
							'scale' => 1.1,
						],
						[
                            'target' => 'opponent',
                            'sprite' => './assets/profe/sprites/dockercabum.gif',
                            'startMs' => 5150,
                            'durationMs' => 2000,
                            'x' => 0,
                            'y' => 0,
                            'scale' => 2.7,
                        ],
					],
				],
			],
			'reactions' => [
				'defendingHit' => [
					'frames' => [
						[
							'sprite' => './assets/profe/sprites/SAVIOR.png',
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
