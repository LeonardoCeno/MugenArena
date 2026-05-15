<?php

declare(strict_types=1);

trait GameSetup
{
    public static function mapaDeClasses(): array {
        return [
            'sukuna'       => Sukuna::class,
            'gojo'         => Gojo::class,
            'sans'         => Sans::class,
            'ulquiorra'    => Ulquiorra::class,
            'miku'         => Miku::class,
            'labubu'       => Labubu::class,
            'ubuntu'       => Ubuntu::class,
            'ubuntukiller' => UbuntuKiller::class,
            'profe'        => Profe::class,
            'escanor'      => Escanor::class,
        ];
    }

    public static function catalogoDePersonagens(): array {
        $catalogo = [];
        foreach (self::mapaDeClasses() as $key => $className) {
            $personagem = new $className('_');
            $visual = $personagem->getConfiguracaoVisual();
            $catalogo[] = [
                'key'          => $key,
                'label'        => $personagem->getClasseNome(),
                'velocidade'   => $personagem->getVelocidade(),
                'selectSprite' => $visual['selectSprite'] ?? $visual['baseSprite'] ?? null,
            ];
        }
        return $catalogo;
    }

    public static function criarPersonagem(string $classKey, string $nome): Personagem {
        $normalizedKey = strtolower(trim($classKey));
        $className = self::mapaDeClasses()[$normalizedKey] ?? null;

        if ($className === null) {
            throw new EntradaInvalidaException();
        }

        $nome = trim($nome);
        if ($nome === '') {
            $nome = 'Jogador';
        }

        return new $className($nome);
    }

    public static function criarEstadoDeJogo(Personagem $p1, Personagem $p2, string $clashMode = 'random'): array {
        $game = [
            'p1'             => $p1,
            'p2'             => $p2,
            'turno'          => 1,
            'skipTurns'      => ['p1' => 0, 'p2' => 0],
            'pendingActions' => ['p1' => null, 'p2' => null],
            'domain'         => self::domainVazio(),
            'clashMode'      => in_array($clashMode, ['random', 'qte'], true) ? $clashMode : 'random',
            'pendingClash'   => null,
        ];

        self::preencherAcoesSkip($game);

        return $game;
    }
}
