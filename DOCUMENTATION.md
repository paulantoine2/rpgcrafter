# Guide de création — Runtime Action-JRPG V0.6

Ce document explique comment produire le contenu d’un jeu compatible avec le
runtime V0.6. Le moteur est un jeu web top-down en temps réel : il charge un
package JSON, le valide avant de démarrer, puis applique les règles communes de
déplacement, combat, progression, interface et sauvegarde.

> **Portée de cette version.** Le Studio V1 sait ouvrir et modifier le jeu de
> référence embarqué, puis exporter `maps.json`, `events.json` et `tilesets.json`. Le Player reste
> une application séparée. L’ouverture d’un dossier arbitraire sera ajoutée dans
> une version ultérieure.

Pour apprendre à manipuler visuellement les plans, les calques, les collisions et les connexions, consultez [le guide pratique du Studio](STUDIO_GUIDE.md). Le présent document décrit surtout le format JSON et le runtime.

## 1. Démarrage rapide

1. Copiez `content/reference-game/` vers un nouveau dossier, par exemple
   `content/mon-jeu/`.
2. Donnez un `gameId` et un `version` propres dans `manifest.json`.
3. Créez ou modifiez vos maps, ennemis, compétences, objets, quêtes et
   événements.
4. Faites pointer `apps/player/src/content-loader.ts` vers votre dossier de contenu.
5. Lancez `npm run dev:player`, puis ouvrez `http://localhost:4173`.
6. Vérifiez le package avec `npm run check` puis `npm run build`.

Le chargement est volontairement strict : une référence inconnue, un champ
invalide ou une version non compatible bloque le jeu avec un message d’erreur.

## 2. Arborescence d’un package

Chaque package comprend les fichiers suivants :

```text
content/mon-jeu/
├── manifest.json       # identité et compatibilité
├── maps.json           # zones, obstacles, events placés et ennemis
├── actors.json         # héros jouable
├── enemies.json        # modèles d’ennemis et comportements
├── skills.json         # attaques et capacités
├── items.json          # objets, consommables et équipement
├── quests.json         # définitions de quêtes et états autorisés
├── events.json         # dialogues, choix et logique événementielle
├── initial-state.json  # état d’une nouvelle partie
└── ui.json             # thème et menu pause
```

Tous les fichiers sont requis. Les identifiants sont des chaînes non vides. Il
est recommandé de les préfixer par leur nature : `skill.fireball`,
`item.key-cellar`, `quest.rescue`.

## 3. Manifeste

`manifest.json` décrit le package :

```json
{
  "schemaVersion": "0.5",
  "engineRange": ">=0.5 <0.6",
  "gameId": "game.mon-aventure",
  "version": "0.5.0",
  "entryPoint": { "mapId": "village", "spawnId": "spawn.start" },
  "title": "Mon aventure",
  "contentRating": "all"
}
```

- `schemaVersion` doit être `"0.5"`. Les packages `"0.4"` sont migrés au chargement vers un plan unique de couverture `bounds`.
- `engineRange` accepte des comparaisons séparées par des espaces (`>=`, `<=`,
  `>`, `<` ou `=`). Le moteur actuel est en `0.5.0`.
- `entryPoint.mapId` doit référencer une map existante.
- `entryPoint.spawnId` est actuellement informatif : le point réel est défini
  par `actors.player.start`.
- `gameId` et `version` participent à la clé de sauvegarde locale. Changer l’un
  des deux démarre donc une nouvelle sauvegarde.

## 4. Maps et coordonnées

Les maps sont réunies dans un objet dont chaque clé est l’identifiant de la
map. Les coordonnées de contenu sont exprimées en **tuiles**, puis converties
en pixels au chargement. Utilisez la même unité dans `maps.json` et dans les
positions des actions `teleport`.

```json
{
  "village": {
    "id": "village",
    "name": "Village",
    "ground": "#365d49",
    "accent": "#49765a",
    "tileSize": 48,
    "bounds": { "x": 0, "y": 0, "w": 30, "h": 18 },
    "planes": [
      { "id": "plane-1", "name": "Mon plan", "order": 0, "surfaceLayerId": "surface", "surfaceCoverage": "bounds" }
    ],
    "tileLayers": [
      {
        "id": "surface",
        "name": "Surface",
        "tileset": "outside-a2",
        "planeId": "plane-1",
        "renderPhase": "belowActors",
        "tiles": [{ "x": 4, "y": 3, "terrainId": "dirt-on-grass" }]
      }
    ],
    "planeConnections": [],
    "navigationOverrides": [],
    "blockedRegions": [],
    "events": [],
    "enemySpawns": []
  }
}
```

Champs de map :

- `id` doit être identique à la clé de l’objet.
- `name` est affiché lors d’une transition.
- `ground` et `accent` font partie du thème de terrain. Le renderer fourni
  sélectionne également ses visuels selon les identifiants de map connus.
- `tileSize` est un entier positif, généralement `48`.
- `bounds` est le rectangle jouable `{ x, y, w, h }`.
- `planes` décrit les surfaces de gameplay. Leur nom est libre et n’a aucune sémantique moteur. Chaque plan possède exactement un calque surface et une couverture `bounds` ou `painted`.
- `tileLayers` contient les calques peints. Chaque calque appartient à un seul `planeId` et choisit la phase `belowActors` ou `aboveActors`. Une coordonnée peut posséder une surface sur plusieurs plans.
- Le Studio et le Player calculent l’autotile séparément dans chaque calque depuis les huit voisins de même `terrainId` ; un autre terrain ou l’extérieur de la map forme un bord. Les règles de collision du terrain contribuent à la navigation du plan, quel que soit le calque qui le porte.
- `planeConnections` est la seule manière de changer de plan en se déplaçant. Sans connexion, une surface superposée ou adjacente n’est jamais choisie automatiquement.
- `blockedRegions` conserve les anciennes régions de cellules solides, rattachées à un plan. `navigationOverrides` force localement une cellule ou un bord ouvert/fermé.
- Le déplacement résout le cercle des acteurs contre les bords cardinaux et conserve le glissement le long d’un obstacle.
- `deathDestination`, facultatif, donne une destination `{ mapId, spawn }` en
  cas de mort. Sans elle, le dernier point de transition devient le checkpoint.

### Events placés

Chaque event possède un identifiant unique dans sa map, une position, un
déclencheur, une politique d’exécution et la référence d’un script de
`events.json`. `activeWhen` désactive à la fois son déclenchement et son visuel.

```json
{
  "id": "captain",
  "position": { "x": 10, "y": 5 },
  "scriptId": "event.captain",
  "trigger": { "type": "interact", "radius": 1.25 },
  "execution": { "mode": "repeat", "cooldown": 0.2 },
  "activeWhen": [{ "kind": "flag", "id": "captainLeft", "equals": false }],
  "visual": {
    "type": "npc", "name": "Capitaine",
    "color": "#e4b677", "radius": 18
  }
}
```

Déclencheurs disponibles :

- `playerEnter` ajoute `size: { w, h }` et se déclenche au passage de
  l’extérieur vers l’intérieur de la zone centrée sur `position` ;
- `interact` ajoute un `radius` en tuiles et répond à `E` ou `Entrée` ;
- `interval` ajoute `every` et éventuellement `initialDelay`, en secondes ;
- `mapEnter` ajoute un `delay` en secondes après le début de la visite.

Les timers sont suspendus pendant les dialogues, la pause et lorsque la page
est masquée. Une frame longue ne rattrape jamais plusieurs intervalles.

`execution.mode` vaut `repeat`, `oncePerVisit` ou `oncePerGame`. Le dernier
mode est sauvegardé avec la partie ; les deux autres sont propres à la visite
courante. `cooldown`, facultatif, est exprimé en secondes.

`visual` est facultatif : un event automatique peut donc être invisible. Les
visuels `npc`, `chest` et `door` demandent `name`, `color` et un rayon de rendu
en pixels. Un visuel `{ "type": "exit" }` dessine la zone d’un déclencheur
`playerEnter`.

### Spawns d’ennemis

Ajoutez une entrée par ennemi initial :

```json
"enemySpawns": [
  { "enemyId": "slime", "x": 12, "y": 5 },
  { "enemyId": "archer", "x": 18, "y": 9 }
]
```

Les ennemis vaincus restent morts dans la sauvegarde. Ils ne réapparaissent que
lorsqu’une nouvelle partie est créée.

## 5. Héros, progression et commandes

`actors.json` contient un seul acteur jouable :

```json
{
  "player": {
    "id": "actor.hero",
    "name": "Héroïne",
    "start": { "x": 4, "y": 8 },
    "stats": { "maxHp": 100, "level": 1, "xp": 0 },
    "primaryAttack": "skill.sword",
    "skillSlots": { "skill1": "skill.bolt", "skill2": "skill.wave" },
    "unlockedSkills": ["skill.sword", "skill.bolt"]
  }
}
```

Le héros se déplace avec `WASD` ou les flèches. `Espace` active l’attaque
principale, `K` le dash, `L` le slot `skill1` et `I` le slot `skill2`.

Le système actuel donne de l’XP à chaque ennemi vaincu. Quand l’XP atteint
`niveau × 35`, le héros gagne un niveau, reçoit 15 PV maximum supplémentaires
et est entièrement soigné. Il n’existe pas encore de table d’expérience ou de
classes configurables dans les données.

## 6. Compétences et combat

Les compétences sont déclarées dans `skills.json`. Chaque compétence a un nom,
des dégâts et un cooldown en secondes.

```json
{
  "skill.sword": {
    "name": "Épée", "type": "melee",
    "damage": 26, "cooldown": 0.38, "range": 86
  },
  "skill.bolt": {
    "name": "Éclat", "type": "projectile",
    "damage": 23, "cooldown": 0.7,
    "projectileSpeed": 390, "color": "#88d9ff"
  },
  "skill.wave": {
    "name": "Onde", "type": "area",
    "damage": 19, "cooldown": 2.2,
    "range": 96, "color": "#8ef3ff"
  }
}
```

- `melee` touche les ennemis proches, en privilégiant ceux dans la direction
  regardée. `range` définit la portée.
- `projectile` se déplace dans la direction regardée, disparaît au contact d’un
  obstacle, d’un ennemi ou à la fin de sa durée de vie. `projectileSpeed` est
  sa vitesse.
- `area` touche tous les ennemis dans `range` autour du héros.

Une compétence doit être présente dans `unlockedSkills` pour être utilisable.
L’action `unlockSkill` permet de l’ajouter pendant la partie. Les bonus
d’attaque de l’équipement sont ajoutés aux dégâts des compétences.

## 7. Ennemis et boss

Dans `enemies.json`, un modèle décrit les attributs et l’IA :

```json
{
  "beetle": {
    "name": "Scarabée", "color": "#c99055",
    "hp": 58, "speed": 48, "damage": 12, "radius": 19, "xp": 11,
    "behavior": "charge"
  }
}
```

Comportements disponibles :

- `chase` : poursuit le héros lorsqu’il est à portée.
- `charge` : approche puis exécute une charge courte.
- `ranged` : tire à distance et recule quand le héros est trop proche.
- `boss` : poursuit comme `chase` ; ses phases peuvent modifier sa vitesse et
  lui ajouter un tir.

Exemple de boss à phase :

```json
{
  "guardian": {
    "name": "Gardien", "color": "#b68cec",
    "hp": 180, "speed": 42, "damage": 8, "radius": 34, "xp": 60,
    "behavior": "boss",
    "phases": [{
      "atHpRatio": 0.5,
      "speedMultiplier": 1.28,
      "projectile": {
        "cooldown": 1.05, "speed": 285, "damage": 17, "color": "#ffb2d6"
      }
    }],
    "onDefeated": [{ "type": "giveItem", "id": "item.relic" }]
  }
}
```

Une phase s’active lorsque `PV actuels / PV maximum` est inférieur ou égal à
`atHpRatio`. Le moteur utilise la première phase correspondante. `onDefeated`
exécute des actions événementielles à la mort de l’ennemi.

Quand le héros est touché, il est brièvement invulnérable. Le dash évite aussi
les dégâts pendant sa durée. La défense d’équipement réduit les dégâts, avec un
minimum de 1 dégât reçu.

## 8. Objets, inventaire et équipement

Les objets de `items.json` ont l’un des trois types suivants :

```json
{
  "item.key": { "name": "Clé rouillée", "type": "quest" },
  "item.potion": { "name": "Potion", "type": "consumable", "healing": 30 },
  "item.sword": {
    "name": "Épée", "type": "equipment",
    "equipmentSlot": "weapon", "stats": { "attack": 4 }
  }
}
```

- `quest` sert aux conditions et à la progression, sans utilisation directe.
- `consumable` peut actuellement restaurer des PV avec `healing` ; il est
  consommé depuis l’inventaire du menu pause.
- `equipment` s’équipe depuis l’inventaire dans `equipmentSlot`. Ses statistiques
  `attack` et `defense` sont prises en charge par le runtime.

Les autres noms de statistiques sont stockables, mais n’ont pas d’effet dans la
V0. Équiper un objet ne le retire pas de l’inventaire : le même exemplaire reste
compté et peut être rééquipé.

## 9. Quêtes, conditions et état initial

Les quêtes déclarent leurs états permis :

```json
{
  "quest.main": {
    "name": "Le phare éteint",
    "states": ["inactive", "find-key", "open-gate", "completed"],
    "reward": { "story": "Le phare brille de nouveau." }
  }
}
```

`reward.story` est informatif dans cette version. Les objectifs affichés sont
dans `events.json`, et non dans `quests.json`.

L’état d’une nouvelle partie est défini par `initial-state.json` :

```json
{
  "flags": { "gateOpen": false, "chestOpened": false },
  "quests": { "quest.main": "inactive" },
  "inventory": { "item.potion": 2, "item.sword": 1 },
  "equipment": { "weapon": "item.sword", "armor": null, "accessory": null }
}
```

Les conditions disponibles partout où elles sont acceptées sont :

```json
{ "kind": "flag",  "id": "gateOpen",    "equals": true }
{ "kind": "item",  "id": "item.key",   "amount": 1 }
{ "kind": "quest", "id": "quest.main", "state": "open-gate" }
```

- Une condition `flag` vérifie `true` par défaut ; utilisez `equals: false`
  pour tester un état non déclenché.
- Une condition `item` demande au moins `amount`, ou 1 par défaut.
- Une condition `quest` compare l’état exact de la quête.
- Une liste de conditions est un **ET logique** : toutes doivent être vraies.

## 10. Événements, dialogues et actions

`events.json` contient les événements et les objectifs. Un événement possède
une ou plusieurs pages. La première page dont les conditions sont satisfaites
est jouée ; mettez donc les cas spécifiques avant la page de secours.

```json
{
  "objectives": [
    {
      "conditions": [{ "kind": "quest", "id": "quest.main", "state": "inactive" }],
      "text": "Parlez au capitaine."
    }
  ],
  "events": {
    "event.captain": {
      "id": "event.captain",
      "pages": [
        {
          "conditions": [{ "kind": "quest", "id": "quest.main", "state": "inactive" }],
          "actions": [
            {
              "type": "dialogue",
              "speaker": "Capitaine",
              "text": "Le phare a besoin de vous.",
              "choices": [
                {
                  "label": "J’accepte",
                  "actions": [
                    { "type": "setQuestState", "id": "quest.main", "state": "find-key" },
                    { "type": "toast", "text": "Quête commencée" },
                    { "type": "save" }
                  ]
                }
              ]
            }
          ]
        },
        {
          "actions": [{ "type": "dialogue", "speaker": "Capitaine", "text": "Bonne chance." }]
        }
      ]
    }
  }
}
```

Actions autorisées :

| Action | Champs | Effet |
|---|---|---|
| `dialogue` | `speaker`, `text`, `choices?` | Ouvre un dialogue ; les choix portent une liste d’actions. |
| `setFlag` | `id`, `value` | Modifie un flag déclaré dans l’état initial. |
| `setQuestState` | `id`, `state` | Change l’état d’une quête déclarée. |
| `giveItem` | `id`, `amount?` | Ajoute 1 objet, ou `amount`. |
| `removeItem` | `id`, `amount?` | Retire sans jamais passer sous zéro. |
| `unlockSkill` | `id` | Débloque une compétence si elle ne l’est pas déjà. |
| `healPlayer` | `amount` | Rend des PV sans dépasser le maximum. |
| `toast` | `text` | Affiche une notification temporaire. |
| `teleport` | `mapId`, `position`, `resetMap` | Téléporte le héros vers une position en tuiles. |
| `save` | aucun | Enregistre silencieusement la partie. |

Avec `resetMap: true`, la destination commence une nouvelle visite : timers et
états `oncePerVisit` sont remis à zéro, les effets temporaires sont nettoyés et
le checkpoint est actualisé. Les ennemis vaincus, flags, quêtes et inventaire
ne sont pas réinitialisés. Avec `resetMap: false`, seule la position change et
`mapId` doit obligatoirement être la map qui place le script.

Une action `dialogue` sans choix attend `E`, `Entrée` ou `Espace` pour être
fermée. Les choix peuvent être sélectionnés aux flèches puis validés avec `E`,
`Entrée` ou `Espace`.

## 11. Interface

`ui.json` personnalise le thème et la structure du menu :

```json
{
  "theme": {
    "fontFamily": "Inter, system-ui, sans-serif",
    "pageBackground": "#0d1220",
    "panel": "#121b2d",
    "panelBorder": "#3a4c72",
    "text": "#eff4ff",
    "accent": "#9fc6ff",
    "health": "#f05b75"
  },
  "hud": { "slots": ["health", "level"] },
  "pauseMenu": {
    "title": "Menu",
    "tabs": [
      { "id": "character", "label": "Personnage" },
      { "id": "inventory", "label": "Inventaire" },
      { "id": "equipment", "label": "Équipement" },
      { "id": "quests", "label": "Quêtes" },
      { "id": "settings", "label": "Options" }
    ]
  },
  "equipmentSlots": [
    { "id": "weapon", "label": "Arme" },
    { "id": "armor", "label": "Armure" }
  ]
}
```

Le menu pause est ouvert avec `Échap`. Les onglets `character`, `inventory`,
`equipment`, `quests` et `settings` possèdent des comportements fournis. Les
autres identifiants d’onglets sont acceptés par le schéma, mais n’affichent pas
de contenu actuellement. De même, le HUD rend concrètement les slots `health`
et `level`; les autres noms sont conservés pour l’évolution du Player.

## 12. Sauvegarde et test

La sauvegarde est stockée dans `localStorage`, sous une clé qui dépend du
`gameId` et de la `version`. Elle conserve notamment : position, PV, niveau,
XP, plan courant, flags, quêtes, inventaire, équipement, compétences déverrouillées, ennemis
restants, events `oncePerGame`, checkpoint et effets en cours.

- `Ctrl/⌘ S` sauvegarde avec confirmation.
- Les transitions de map et les actions `save` sauvegardent silencieusement.
- `R` efface la sauvegarde de ce package et relance une nouvelle partie.
- Une sauvegarde incompatible ou invalide est ignorée au profit d’une nouvelle
  partie sûre.

Avant de livrer du contenu, testez au minimum :

1. une nouvelle partie et une partie rechargée ;
2. chaque event de sortie, dans les états bloqué puis autorisé ;
3. chaque page d’événement et chaque choix ;
4. l’activation et le masquage des events conditionnels ;
5. la mort du héros et sa destination de réapparition ;
6. chaque type d’ennemi, chaque compétence et chaque phase de boss ;
7. les consommables et chaque emplacement d’équipement ;
8. `npm test`, `npm run check` et `npm run build`.

### Tilesets et autotiles

`tilesets.json` appartient au package du jeu. Chaque définition référence un PNG relatif, décrit sa grille et énumère les terrains visibles dans la palette. Un terrain A2 pointe vers l’origine d’un bloc source 2 × 3. Les 47 masques canoniques associent ensuite chaque voisinage à quatre quarts de 24 × 24 px. Les diagonales ne comptent que lorsque leurs deux côtés cardinaux sont présents. Chaque terrain déclare aussi une collision `none`, `blockCell` ou `edges`. Pour un tileset `grid`, `edges` contient les bords cardinaux fixes. Pour un A2, un tableau `edges` non vide active une frontière de surface : le moteur bloque seulement le périmètre extérieur du terrain auto-tuilé et laisse ouverts les côtés partagés avec le même terrain dans le même calque.

Le format V0.6 migre automatiquement les packages V0.4 et V0.5. Les calques V0.5 associés à un tileset sont convertis en calques mixtes : chaque placement reçoit son propre `tilesetId`. Les définitions de tileset deviennent discriminées par `kind` (`a2` ou `grid`) et portent un nom ainsi qu’une catégorie.

## 13. Limites de la V0.5

Le format ne prend pas encore en charge les boutiques et prix, monnaie,
récompenses de quête mécaniques, craft, statuts temporaires, compétences
passives, arbres de talents, classes, loot aléatoire, PNJ autonomes,
pathfinding, scripts personnalisés, cinématiques, puzzles spécialisés,
animation définie par les données, audio, manette, tactile, multijoueur ou
réglages effectifs d’accessibilité et d’affichage.

Le renderer de référence possède aussi un catalogue fixe de sprites et de
thèmes de terrain. Ajouter de nouveaux types visuels peut donc demander une
évolution de `apps/player/src/pixi-renderer.ts`, même si les données JSON sont valides.

## 14. Recette de conception recommandée

Commencez par une map de départ, une quête `inactive`, un PNJ qui la fait
passer à son premier état, et une sortie conditionnelle. Ajoutez ensuite les
ennemis, le coffre ou la porte qui modifie l’état suivant, puis une récompense
et un retour au PNJ. Cette boucle simple valide à la fois exploration,
événements, combat, inventaire, quêtes, sauvegarde et fin de partie.

Conservez toujours une page d’événement sans `conditions` en dernière position
pour donner un retour au joueur lorsque les cas spécifiques ne s’appliquent
plus. Sauvegardez après les jalons importants et prévoyez une page de secours
avec un dialogue ou un `toast` pour les passages volontairement inaccessibles.
