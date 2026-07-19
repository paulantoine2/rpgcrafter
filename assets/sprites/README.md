# Sprites du jeu de référence

Les fichiers `*-source.png` conservent la planche générée sur fond chroma magenta. Les fichiers sans suffixe sont les versions PNG avec alpha, à utiliser dans le renderer.

| Fichier | Disposition | Contenu |
| --- | --- | --- |
| `reference-characters.png` | 4 colonnes × 3 rangées | Héros, maire Elian, Gardien noyé, esprit des sources ; repos, déplacement, action. |
| `reference-creatures.png` | 3 colonnes × 2 rangées | Slime des brumes, scarabée épineux, marchande ; repos et action/déplacement. |
| `reference-props.png` | 4 colonnes × 3 rangées | Mur, coffre, porte runique, cœur de cristal, décor de brume, lanterne, colonne, source, arbre et rune. |

Les planches sont destinées à une découpe en atlas par le futur pipeline d’assets. Elles sont volontairement séparées du package de contenu JSON : celui-ci décrit les entités, le renderer choisit leurs textures.
