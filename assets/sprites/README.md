# Sprites du jeu de référence

Les fichiers `*-source.png` conservent la planche générée sur fond chroma magenta. Les fichiers sans suffixe sont les versions PNG avec alpha, à utiliser dans le renderer.

| Fichier | Disposition | Contenu |
| --- | --- | --- |
| `rpg-maker-mz/Actor1.png` | 4 groupes × 2 groupes ; 3 frames × 4 directions par personnage | 8 personnages RPG Maker. Le Player utilise actuellement le premier personnage. |
| `reference-characters.png` | 4 colonnes × 3 rangées | Héros, maire Elian, Gardien noyé, esprit des sources ; repos, déplacement, action. |
| `reference-creatures.png` | 3 colonnes × 2 rangées | Slime des brumes, scarabée épineux, marchande ; repos et action/déplacement. |
| `reference-props.png` | 4 colonnes × 3 rangées | Mur, coffre, porte runique, cœur de cristal, décor de brume, lanterne, colonne, source, arbre et rune. |

Les planches sont destinées à une découpe en atlas par le futur pipeline d’assets. Elles sont volontairement séparées du package de contenu JSON : celui-ci décrit les entités, le renderer choisit leurs textures.

## Bundle RPG Maker MZ

`rpg-maker-mz/` contient les planches de personnages, créatures, véhicules et objets animés de RPG Maker MZ. Son `library.json` conserve pour chaque PNG le nombre de personnages, la taille exacte d’une frame, les quatre directions et les conventions de nommage MZ :

- `$` indique une planche à personnage unique ;
- `!` indique un objet aligné sur la grille, sans décalage vertical.

Le bundle peut être régénéré depuis un dossier Characters MZ :

```sh
node scripts/generate-rpg-maker-mz-character-assets.mjs /chemin/vers/characters
```
