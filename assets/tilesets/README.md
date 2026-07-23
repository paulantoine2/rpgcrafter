# Tileset du jeu de référence

`outside-a2.png` est la planche extérieure A2 source fournie par le projet (768 × 576 px), organisée en 32 blocs de terrain 2 × 3. Chaque bloc produit les 47 formes d’autotile à partir de quarts de 24 × 24 px.

Les planches RPG Maker MZ A1 utilisent leur découpage natif de 16 terrains : surfaces animées horizontalement, deux surfaces statiques aux colonnes 7–8, et cascades animées verticalement. Les surfaces suivent la séquence `0 → 1 → 2 → 1`; les cascades suivent `0 → 1 → 2` et utilisent leurs quatre raccords horizontaux dédiés.

Les planches A4 de 768 × 720 px contiennent trois bandes de 5 tiles. Chacune expose huit autotiles de surface 2 × 3 utilisant les 47 formes de sol, puis huit autotiles de mur 2 × 2 utilisant les 16 raccords cardinaux RPG Maker.

Les planches A3 de 768 × 384 px exposent 32 autotiles de toiture et de mur 2 × 2. Elles utilisent les 16 raccords cardinaux natifs de RPG Maker, sans être aplaties en grille de tiles indépendants.

Les planches A5 de 384 × 768 px sont de simples grilles de 8 × 16 tiles indépendants. Elles n'utilisent ni autotiling ni animation et conservent donc les collisions cellule et arête du format `grid`.

La copie utilisée par le jeu se trouve dans `content/reference-game/tilesets/`. Son association, ses terrains exposés et les recettes de transition sont déclarés dans `content/reference-game/tilesets.json`, afin que le Studio et le Player consomment exactement les mêmes données.

Les données de map conservent uniquement `{ x, y, terrainId }`. La forme graphique n’est jamais persistée : elle est résolue depuis les huit voisins au rendu.

## Package RPG Maker MZ

`rpg-maker-mz/` contient les 31 planches MZ avec un fichier JSON de même nom pour chacune. Chaque configuration conserve uniquement les noms anglais issus des TXT sources et déclare la collision initiale de chaque terrain. `library.json` est le manifeste consommé par l’Assets Library : il déclare le type et les tags de recherche de chaque asset. Les planches restent importables individuellement dans l’onglet **Tilesets**, tandis que le manifeste complet est proposé dans l’onglet **Bundles**.

Lors d’un import depuis la librairie, le Studio copie le PNG et son JSON dans le projet sous `tilesets/rpg-maker-mz/`. Le JSON local est ensuite maintenu à jour lorsque le nom, la catégorie ou les collisions sont modifiés, et les deux fichiers sont inclus dans l’archive exportée.

Le package peut être régénéré avec :

```sh
node scripts/generate-rpg-maker-mz-assets.mjs /chemin/vers/les/tilesets
```
