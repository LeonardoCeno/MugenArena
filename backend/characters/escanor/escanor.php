<?php

require_once __DIR__ . '/../../Personagem.php';

class Escanor extends Personagem {

	const VELOCIDADE = 65;
	const CUSTO_SOL_CRUEL = 120;
	const DANO_SOL_CRUEL = 65;
	const CUSTO_CURA_SOLAR = 100;
	const CURA_SOLAR = 100;
	const CUSTO_SUN_BARRAGE = 70;
	const DANO_SUN_BARRAGE = 80;
	const REGENERACAO_PROPRIA = 35;

	public function __construct(string $nome) {
		parent::__construct($nome, 340, 40, 650);
	}

	public static function getDescricao(): string {
		return 'Escanor (base inicial para desenvolvimento do personagem).';
	}

	public function solCruel(Personagem $alvo): string {
		$dano = self::DANO_SOL_CRUEL;
		$this->consumirEnergia(self::CUSTO_SOL_CRUEL);

		$resultado = $this->executarAtaqueDireto($alvo, 'Sol Cruel', $dano);

		if (!$resultado['acertou']) {
			return $resultado['mensagem'];
		}

		$danoBurn = (int) ceil($dano * 0.60);
		if ($danoBurn > 0) {
			$alvo->aplicarQueimadura($danoBurn, 2);
		}

		$mensagem = $resultado['mensagem'];
		if ($danoBurn > 0) {
			$mensagem .= " Burn aplicado por 2 turnos ({$danoBurn} por turno).";
		}

		return $mensagem;
	}

	public function sunBarrage(Personagem $alvo): string {
		$this->consumirEnergia(self::CUSTO_SUN_BARRAGE);
		$resultado = $this->executarAtaqueDireto($alvo, 'Sun Barrage', self::DANO_SUN_BARRAGE);
		return $resultado['mensagem'];
	}

	public function usarHabilidadeEspecial(Personagem $alvo): string {
		return $this->solCruel($alvo);
	}

	public function curaSolar(): string {
		$this->consumirEnergia(self::CUSTO_CURA_SOLAR);
		$this->curarVida(self::CURA_SOLAR);

		return $this->formatarMensagemAcaoSemAlvo('Sun Heal');
	}

	public function getHabilidades(): array {
		return [
			[
				'nome' => 'Sol Cruel',
				'metodo' => 'solCruel',
				'precisaAlvo' => true,
				'energyCost' => self::CUSTO_SOL_CRUEL,
				'clashable' => true,
                "priority" => true,
			],
			[
				'nome' => 'Sun Barrage',
				'metodo' => 'sunBarrage',
				'precisaAlvo' => true,
				'energyCost' => self::CUSTO_SUN_BARRAGE,
				"melee" => true
			],
			[
				'nome' => 'Sun Heal',
				'metodo' => 'curaSolar',
				'precisaAlvo' => false,
				'energyCost' => self::CUSTO_CURA_SOLAR,
			],
		];
	}

	public function getDescricoesAcoes(): array {
		return array_merge(parent::getDescricoesAcoes(), [
			'Sol Cruel' => 'Você apagou o meu sol...? quem disse isso? queimadura por 2 turnos.' . "\n" . 'Dano: ' . self::DANO_SOL_CRUEL . ' Custo: ' . self::CUSTO_SOL_CRUEL,
			'Sun Barrage' => 'Uma rajada de golpes imbuídos do calor do sol.' . "\n" . 'Dano: ' . self::DANO_SUN_BARRAGE . ' Custo: ' . self::CUSTO_SUN_BARRAGE,
			'Sun Heal' => 'Você me deu dano? quem disse isso?.' . "\n" . 'Cura: ' . self::CURA_SOLAR . ' Custo: ' . self::CUSTO_CURA_SOLAR,
		]);
	}

	public function getConfiguracaoVisual(): array {
		return [
			'baseSprite' => './assets/escanor/sprites/EscanorBASE.png',
            'dodgeSprite' => './assets/escanor/sprites/escanoresquiva.png',
            'winMessage' => 'O único que decide algo aqui... sou EU.',
            'winImage' => './assets/escanor/sprites/escanorwin.jpg',
			'actions' => [
				'Ataque' => [
					'audio' => [
						[
							'file' => './assets/audiosgerais/punchs2.mp3',
							'startMs' => 0,
							'durationMs' => 1100,
						],
					],
					'frames' => [
						[
							'sprite' => './assets/escanor/sprites/ESCANORHIT1.png',
							'durationMs' => 500,
						],
						[
							'sprite' => './assets/escanor/sprites/ESCANORHIT2.png',
							'durationMs' => 500,
                            'scale' => 1.2,
						],
					],
				],
				'Sol Cruel' => [
                    'audio' => [
                        [
                            'file' => './assets/escanor/audios/quemdisseisso.mp3',
                            'startMs' => 0,
                            'durationMs' => 3900,
                            'volumeLevel' => 0.9,
                        ],
                        ['file' => './assets/audiosgerais/bomba.mp3',    'startMs' => 4950, 'volumeLevel' => 0.6],
                    ],
					'frames' => [
						[
							'sprite' => './assets/escanor/sprites/SUN0.png',
							'durationMs' => 2000,
						],
						[
							'sprite' => './assets/escanor/sprites/SUN.png',
							'durationMs' => 2150,
                            'scale' => 1.3,
						],
                        [
							'sprite' => './assets/escanor/sprites/ESCANORHIT2.png',
							'durationMs' => 1000,
                            'scale' => 1.3,
						],
					],
                    'overlays' => [
                        [
                            'mode' => 'projectile',
                            'target' => 'opponent',
                            'sprite' => './assets/escanor/sprites/solcruel.gif',
                            'startMs' => 4150,
                            'durationMs' => 700,
                            'sizePx' => 260,
                            'frontOffsetPx' => 130,
                            'startOffsetX' => 0,
                            'startOffsetY' => -20,
                            'endOffsetX' => 0,
                            'endOffsetY' => 50,
                            'scale' => 0.7,
                        ],
                        [
                            'target' => 'opponent',
                            'sprite' => './assets/sukuna/sprites/boom-explosion.gif',
                            'startMs' => 4955,
                            'durationMs' => 1750,
                            'x' => 0,
                            'y' => -40,
                            'scale' => 2.5,
                        ],
                    ],
				],
				'Sun Barrage' => [
					'audio' => [
						[
							'file' => './assets/audiosgerais/punchs2.mp3',
							'startMs' => 0,
							'durationMs' => 1200,
						],
					],
					'frames' => [
						[
							'sprite' => './assets/escanor/sprites/ESCANORHIT1.png',
							'durationMs' => 200,
						],
						[
							'sprite' => './assets/escanor/sprites/ESCANORHIT2.png',
							'durationMs' => 200,
							'scale' => 1.1,
						],
					],
					'repeatFrames' => 5,
				],
				'Sun Heal' => [
					'frames' => [
						[
							'sprite' => './assets/escanor/sprites/escaheal1.png',
							'durationMs' => 200,
                             'scale' => 1.05,
						],
						[
							'sprite' => './assets/escanor/sprites/esheal2.png',
							'durationMs' => 200,
                            'scale' => 1.05,
						],
					],
                    'repeatFrames' => 4,
				],
			],
		];
	}

	protected function getRegeneracaoEnergia(): int {
		return self::REGENERACAO_PROPRIA;
	}
}
