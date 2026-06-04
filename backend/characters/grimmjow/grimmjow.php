<?php

require_once __DIR__ . '/../../Personagem.php';

class Grimmjow extends Personagem {

	public const VELOCIDADE    = 75;
	public const CUSTO_ATAQUE1 = 80;
	public const DANO_ATAQUE1  = 55;
	public const REGENERACAO_PROPRIA = 40;

	public function __construct(string $nome) {
		parent::__construct($nome, 300, 35, 600);
	}

	public static function getDescricao(): string {
		return 'Grimmjow (base inicial para desenvolvimento do personagem).';
	}

	public function ataque1(Personagem $alvo): string {
		$this->consumirEnergia(self::CUSTO_ATAQUE1);
		$resultado = $this->executarAtaqueDireto($alvo, 'Ataque 1', self::DANO_ATAQUE1);
		return $resultado['mensagem'];
	}

	public function usarHabilidadeEspecial(Personagem $alvo): string {
		return $this->ataque1($alvo);
	}

	public function getHabilidades(): array {
		return [
			[
				'nome'        => 'Ataque 1',
				'metodo'      => 'ataque1',
				'precisaAlvo' => true,
				'energyCost'  => self::CUSTO_ATAQUE1,
			],
		];
	}

	public function getDescricoesAcoes(): array {
		return array_merge(parent::getDescricoesAcoes(), [
			'Ataque 1' => 'Ataque base.' . "\n" . 'Dano: ' . self::DANO_ATAQUE1 . ' Custo: ' . self::CUSTO_ATAQUE1,
		]);
	}

	public function getConfiguracaoVisual(): array {
		return [
			'baseSprite'  => './assets/grimmjow/sprites/GrimmjowBASE.png',
			'winMessage'  => 'Grimmjow venceu.',
			'winImage'    => './assets/grimmjow/sprites/grimmjowwin.png',
			'actions'     => [
				'Ataque' => [
					'frames' => [
						[
							'sprite'     => './assets/grimmjow/sprites/GrimmjowBASE.png',
							'durationMs' => 500,
						],
					],
				],
				'Ataque 1' => [
					'frames' => [
						[
							'sprite'     => './assets/grimmjow/sprites/GrimmjowBASE.png',
							'durationMs' => 600,
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
