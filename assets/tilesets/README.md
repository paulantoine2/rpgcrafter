# Reference Game Tilesets

`outside-a2.png` is the source A2 outdoor sheet provided by the project (768 × 576 px), arranged as 32 terrain blocks of 2 × 3 tiles. Each block produces the 47 autotile shapes from 24 × 24 px quarters.

RPG Maker MZ A1 sheets use their native 16-terrain layout: horizontally animated surfaces, two static surfaces in columns 7–8, and vertically animated waterfalls. Surfaces follow the `0 → 1 → 2 → 1` sequence; waterfalls follow `0 → 1 → 2` and use their four dedicated horizontal connections.

The 768 × 720 px A4 sheets contain three bands of 5 tiles. Each band exposes eight 2 × 3 surface autotiles using the 47 floor shapes, followed by eight 2 × 2 wall autotiles using RPG Maker's 16 cardinal connections.

The 768 × 384 px A3 sheets expose 32 roof and wall autotiles of 2 × 2 tiles. They use RPG Maker's native 16 cardinal connections without being flattened into a grid of independent tiles.

The 384 × 768 px A5 sheets are simple 8 × 16 grids of independent tiles. They use neither autotiling nor animation, so they retain the cell and edge collisions of the `grid` format.

The copy used by the game is located in `content/reference-game/tilesets/`. Its mapping, exposed terrains, and transition recipes are declared in `content/reference-game/tilesets.json` so that the Studio and Player consume exactly the same data.

Map data stores only `{ x, y, terrainId }`. The rendered shape is never persisted; it is resolved from the eight neighboring cells at render time.

## Package RPG Maker MZ

`rpg-maker-mz/` contains the 31 MZ sheets, each with a same-named JSON file. Each configuration preserves only the English names from the source TXT files and declares the initial collision settings for every terrain. `library.json` is the manifest consumed by the Assets Library; it declares each asset's type and search tags. Sheets remain individually importable from the **Tilesets** tab, while the complete manifest is available from the **Bundles** tab.

When an asset is imported from the library, the Studio copies its PNG and JSON files into the project under `tilesets/rpg-maker-mz/`. The local JSON file is then kept up to date when its name, category, or collision settings change, and both files are included in the exported archive.

The package can be regenerated with:

```sh
node scripts/generate-rpg-maker-mz-assets.mjs /path/to/tilesets
```
