# Reference Game Sprites

Files named `*-source.png` preserve the generated sprite sheet with a chroma magenta background. Files without that suffix are alpha-enabled PNG versions intended for use by the renderer.

| File | Layout | Contents |
| --- | --- | --- |
| `rpg-maker-mz/Actor1.png` | 4 × 2 character groups; 3 frames × 4 directions per character | 8 RPG Maker characters. The Player currently uses the first character. |
| `reference-characters.png` | 4 columns × 3 rows | Hero, Mayor Elian, Drowned Warden, and spring spirit; idle, movement, and action poses. |
| `reference-creatures.png` | 3 columns × 2 rows | Mist slime, thorn beetle, and merchant; idle and action/movement poses. |
| `reference-props.png` | 4 columns × 3 rows | Wall, chest, rune door, crystal heart, mist decoration, lantern, column, spring, tree, and rune. |

These sheets are intended to be sliced into atlases by the future asset pipeline. They are deliberately kept separate from the JSON content package: the package describes entities, while the renderer selects their textures.

## RPG Maker MZ Bundle

`rpg-maker-mz/` contains RPG Maker MZ character, creature, vehicle, and animated-object sheets. Its `library.json` records the character count, exact frame size, four directions, and MZ naming conventions for each PNG:

- `$` identifies a single-character sheet;
- `!` identifies a grid-aligned object with no vertical offset.

The bundle can be regenerated from an MZ Characters directory:

```sh
node scripts/generate-rpg-maker-mz-character-assets.mjs /path/to/characters
```
