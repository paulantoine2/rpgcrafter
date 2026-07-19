# Tileset du jeu de référence

`outside-a2.png` est la planche extérieure A2 source fournie par le projet (768 × 576 px), organisée en 32 blocs de terrain 2 × 3. Chaque bloc produit les 47 formes d’autotile à partir de quarts de 24 × 24 px.

La copie utilisée par le jeu se trouve dans `content/reference-game/tilesets/`. Son association, ses terrains exposés et les recettes de transition sont déclarés dans `content/reference-game/tilesets.json`, afin que le Studio et le Player consomment exactement les mêmes données.

Les données de map conservent uniquement `{ x, y, terrainId }`. La forme graphique n’est jamais persistée : elle est résolue depuis les huit voisins au rendu.
