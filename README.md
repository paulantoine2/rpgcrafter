# RPG Crafter

**A modern, web-based RPG Maker clone for building and playing 2D action RPGs.**

RPG Crafter reimagines the familiar RPG Maker workflow for the web. It combines a visual game editor, a browser-based runtime, and a portable JSON game format in a single open-source project. The goal is to make creating, testing, and sharing an RPG feel immediate: edit a project in the Studio, click **Play**, and run it directly in the browser.

The project takes inspiration from RPG Maker's approachable, data-driven authoring experience while modernizing the technology and workflow. RPG Crafter is independently developed and does not use RPG Maker source code or proprietary assets.

> [!IMPORTANT]
> RPG Crafter is an independent project. It is not affiliated with, endorsed by, or sponsored by Gotcha Gotcha Games, KADOKAWA, or the owners of the RPG Maker trademark. “RPG Maker” is used only to describe the type of product and the project's inspiration.

## Why RPG Crafter?

- **Web-based:** the editor and player run in a modern browser.
- **Fast iteration:** launch the game from the Studio and test changes immediately.
- **Visual authoring:** create maps, paint terrain, place events, and configure navigation without editing engine code.
- **Data-driven games:** maps, actors, enemies, skills, items, quests, events, and UI configuration live in validated JSON files.
- **Portable projects:** export a standalone ZIP containing the complete game package and its assets.
- **Modern stack:** React, TypeScript, PixiJS, Vite, Zod, and npm workspaces.
- **Renderer-independent runtime:** gameplay rules and save data are kept separate from the PixiJS renderer.

## Current features

RPG Crafter currently includes:

- a three-panel Studio with a map hierarchy, canvas, and property inspector;
- layered top-down maps with multiple overlapping gameplay planes;
- terrain painting and A1/A2/A4 autotile, A5, or arbitrary 48 px grid tileset imports;
- per-cell and per-edge collision editing;
- explicit navigation connections between floors, bridges, roofs, and other overlapping surfaces;
- visual event placement with conditional pages and reusable JSON actions;
- dialogue, choices, quests, flags, inventory, healing, notifications, and teleportation;
- real-time combat with melee attacks, dashes, projectiles, area attacks, and multi-phase bosses;
- local browser saves and Studio drafts backed by IndexedDB;
- keyboard and touch controls;
- project validation, automated tests, and production builds across the monorepo.

The repository also contains a small reference game demonstrating the editor, runtime, combat system, events, quests, layered maps, and navigation model.

## Project structure

```text
rpgcrafter/
├── apps/
│   ├── studio/          # React-based visual editor
│   └── player/          # PixiJS game runtime
├── packages/
│   └── game-schema/     # Shared types, validation, migrations, and navigation
├── content/
│   └── reference-game/  # Example game package
├── assets/              # Reference sprites and tilesets
└── scripts/             # Development tooling
```

The Studio and Player are separate applications. Both consume the same game-package format defined by `packages/game-schema`.

## Getting started

### Requirements

- A current LTS version of Node.js
- npm

### Install and run

```bash
npm install
npm start
```

This starts:

- the Studio at <http://localhost:4174>;
- the Player at <http://localhost:4173>.

In the Studio, choose **File > Open…** to load the bundled reference game. The **Play** button opens a validated preview in a new browser tab.

You can also run each application separately:

```bash
npm run dev:studio
npm run dev:player
```

## Development commands

```bash
npm run check   # Type-check all workspaces
npm test        # Run the test suites
npm run build   # Build every application and package
```

## How game projects work

A game is a collection of JSON documents and image assets. The runtime validates every document before starting, so broken references and incompatible data fail early with a useful error instead of causing unpredictable gameplay behavior.

```text
my-game/
├── manifest.json
├── maps.json
├── actors.json
├── enemies.json
├── skills.json
├── items.json
├── quests.json
├── events.json
├── initial-state.json
├── tilesets.json
└── ui.json
```

The engine contains no scenario-specific logic. Game behavior is described with event triggers, conditional pages, and generic actions. This keeps authored games portable and allows the Studio, Player, and future renderers to share the same content.

For the complete format reference, see [DOCUMENTATION.md](DOCUMENTATION.md). For a practical guide to map planes, layers, collisions, and navigation, see [STUDIO_GUIDE.md](STUDIO_GUIDE.md).

## Controls

| Action | Keyboard |
| --- | --- |
| Move | `WASD` or arrow keys |
| Interact | `E` |
| Attack | `Space` |
| Dash | `K` |
| Special abilities | `L` and `I` |
| Save | `Ctrl/Command + S` |
| Restart | `R` |
| Developer grid | `F2` |

## Project status

RPG Crafter is under active development and is not yet a drop-in replacement for RPG Maker. The current version focuses on the core workflow: editing maps and events, managing assets, previewing a project, and running a complete action-RPG reference game in the browser.

File formats and editor behavior may still change between releases. If you build a project with the current version, keep the source package under version control.

## Contributing

Issues, design discussions, documentation improvements, tests, and pull requests are welcome. Before contributing a feature, please open an issue describing the use case and how it fits the data-driven architecture.

Only contribute code and assets that you created or have permission to redistribute. Do not submit RPG Maker code, graphics, audio, sample projects, or other proprietary material.

## Trademark notice

RPG Maker is a trademark of its respective owners. RPG Crafter is an independent open-source project and is not affiliated with the RPG Maker product or its publishers. All other trademarks belong to their respective owners.
