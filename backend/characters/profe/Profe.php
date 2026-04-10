<?php

require_once __DIR__ . '/../../Personagem.php';

class Profe extends Personagem {

	const CUSTO_RED_BILL = 120;
	const CUSTO_APELACAO = 180;
	const CUSTO_VIBECODE = 140;
	const CURA_RED_BILL = 67;
	const DANO_APELACAO = 100;
	const DANO_VIBECODE = 70;
	const REGENERACAO_PROPRIA = 35;

	public function __construct(string $nome) {
		parent::__construct($nome, 220, 24, 500);
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

	public function getHabilidades(): array {
		return [
			["nome" => "Red bill", "metodo" => "redBill", "precisaAlvo" => false, "energyCost" => self::CUSTO_RED_BILL],
			["nome" => "Apelação", "metodo" => "apelacao", "precisaAlvo" => true,  "energyCost" => self::CUSTO_APELACAO],
			["nome" => "VibeCode", "metodo" => "vibeCode", "precisaAlvo" => true,  "energyCost" => self::CUSTO_VIBECODE],
		];
	}

	public function getDescricoesAcoes(): array {
		return array_merge(parent::getDescricoesAcoes(), [
			'Red bill' => 'Cura ' . self::CURA_RED_BILL . ' de vida. Custo: ' . self::CUSTO_RED_BILL . ' energia.',
			'Apelação' => 'Causa ' . self::DANO_APELACAO . ' de dano. Custo: ' . self::CUSTO_APELACAO . ' energia.',
			'VibeCode' => 'Causa ' . self::DANO_VIBECODE . ' de dano. Custo: ' . self::CUSTO_VIBECODE . ' energia.',
		]);
	}

	public function getConfiguracaoVisual(): array {
		return [
			'baseSprite' => './assets/profe/sprites/smurfprofe.png',
			'winImage' => './assets/profe/sprites/WINWIN.png',
			'actions' => [
				'Ataque' => [
					'frames' => [
						[
							'sprite' => './assets/profe/sprites/PANCADA.png',
							'durationMs' => 550,
						],
						[
							'sprite' => './assets/profe/sprites/PANCADADOIS.png',
							'durationMs' => 550,
						],
					],
				],
				'Red bill' => [
					'frames' => [
						[
							'sprite' => './assets/profe/sprites/redbil.png',
							'durationMs' => 700,
						],
					],
				],
				'Apelação' => [
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
							'startOffsetY' => 15,
							'endOffsetX' => 0,
							'endOffsetY' => 75,
						],
					],
				],
				'VibeCode' => [
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
