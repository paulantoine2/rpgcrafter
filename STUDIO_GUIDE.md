# Guide du Studio — plans, calques et navigation

Ce guide explique les outils **Drawing** et **Nav** du Studio V0.6. Les libellés de l’interface sont en anglais, mais aucun nom de plan n’est réservé : choisissez les noms qui correspondent à votre jeu.

## Le modèle mental en une minute

Une map contient trois notions différentes :

- un **plan** est une surface de gameplay indépendante sur laquelle un acteur peut se trouver ;
- un **calque** est une image composée de tuiles et rattachée à un seul plan ;
- le **calque surface** indique où le plan existe et où ses acteurs peuvent se déplacer.

Le joueur possède toujours un `planeId`. Voir une tuile d’un autre plan ne le fait pas changer de plan. Il change uniquement en traversant une **connexion explicite**.

```text
Map
├── Plan A
│   ├── calques Below actors
│   ├── joueur, ennemis et événements du plan A
│   └── calques Above actors
└── Plan B, rendu ensuite
    ├── calques Below actors
    ├── joueur, ennemis et événements du plan B
    └── calques Above actors
```

Deux plans peuvent exister aux mêmes coordonnées. Ils restent deux réseaux de déplacement séparés. C’est ce qui permet, par exemple, d’avoir un chemin derrière une maison et un toit praticable au-dessus de ce chemin.

## Repères dans l’interface

Après avoir ouvert le jeu de référence avec **File > Open…** :

1. choisissez la map dans la liste en bas à gauche ;
2. utilisez **Drawing** pour créer des plans, gérer leurs calques et peindre les tuiles ;
3. utilisez **Nav** pour voir la navigation finale, poser des exceptions et connecter les plans ;
4. utilisez **Events** pour choisir le plan d’un événement ou d’une téléportation ;
5. utilisez **Play** pour tester le projet courant dans le Player.

Le plan actif est déterminé par le calque sélectionné. Cliquer sur un plan dans le panneau **Planes** sélectionne automatiquement son calque surface.

## 1. Créer et configurer un plan

Dans **Drawing**, le panneau **Planes** montre les plans de la map dans leur ordre de rendu.

### Ajouter un plan

1. Cliquez sur `+` à droite de **Planes**.
2. Saisissez un nom parlant pour votre jeu.
3. Validez avec **Create**.

Le Studio crée en même temps un calque surface vide et utilise la couverture **Painted cells**.

### Ordre des plans

Le nombre affiché à droite d’un plan est son ordre. Les boutons fléchés changent cet ordre.

- le plan d’ordre `0` est rendu en premier ;
- un plan d’ordre supérieur est rendu par-dessus les précédents ;
- l’ordre influence l’image, pas le choix automatique du plan du joueur.

Pour un toit praticable qui doit masquer le joueur resté dessous, rendez le plan du toit après le plan inférieur.

### Couverture du plan

Le premier menu sous le nom du plan choisit sa couverture :

| Interface | Signification | Usage conseillé |
| --- | --- | --- |
| **Whole map** | Toutes les cellules comprises dans les limites de la map existent sur ce plan, même si aucune tuile n’y est peinte. | Plan principal unique ou grande surface continue. |
| **Painted cells** | Seules les cellules peintes dans le calque surface existent sur ce plan. | Toit, passerelle, plateforme ou autre surface locale. |

Une tuile peinte sur un calque décoratif ne crée pas de surface navigable. Pour une couverture **Painted cells**, la cellule doit être peinte dans le calque choisi par le second menu du panneau **Planes**.

## 2. Comprendre les calques

Le panneau **Layers** apparaît dans **Drawing**. Chaque calque possède :

- un nom ;
- un plan, choisi dans le menu de gauche ;
- une phase de rendu, choisie dans le menu de droite ;
- un tileset et une liste de tuiles peintes.

Le calque surface ne peut pas changer de plan ni être supprimé tant que son plan existe. Un calque décoratif peut être déplacé vers un autre plan.

### Below actors et Above actors

| Phase | Résultat |
| --- | --- |
| **Below actors** | Le calque est dessiné avant les acteurs de son plan. Sols, surfaces et objets sous les pieds utilisent généralement cette phase. |
| **Above actors** | Le calque est dessiné après les acteurs de son plan. Utilisez-la pour un parapet, une cime ou un élément qui doit cacher un acteur de ce plan. |

La phase ne modifie pas la navigation. Une collision déclarée par une tuile contribue au plan même si son calque est en **Above actors**.

### Ordre de rendu exact

Pour chaque plan, dans l’ordre affiché par **Planes**, le moteur rend :

1. tous ses calques **Below actors** ;
2. ses acteurs, événements, projectiles et effets, triés en Y ;
3. tous ses calques **Above actors** ;
4. puis il passe au plan suivant.

Conséquence importante : la surface **Below actors** d’un plan rendu plus tard peut masquer les acteurs d’un plan précédent. En revanche, un acteur appartenant à ce plan tardif est rendu après sa propre surface et reste visible dessus.

## 3. Définir les collisions d’un terrain

Dans **Assets > Asset Manager** :

1. repérez le tileset déjà importé dans **Project Assets** ;
2. cliquez sur **Edit obstacles** ;
3. choisissez l’outil **Cell** ou **Edge** ;
4. cliquez sur une tuile logique ou sur le bord à modifier.

Cette règle appartient au tileset. Elle s’applique donc à **toutes les utilisations de ce terrain dans toutes les maps**.

| Outil | Effet |
| --- | --- |
| **Cell** | Le clic active ou retire le blocage de toute la cellule. Adapté à un rocher, un mur plein ou un trou. |
| **Edge** sur une grille | Le clic active ou retire le bord cardinal le plus proche. Adapté à une barrière ou un rebord orienté. |
| **Edge** sur un A2 | Le clic active ou retire la frontière complète de la surface auto-tuilée. Les côtés entre deux tuiles identiques restent ouverts ; seuls les côtés extérieurs sont bloqués. |

Une cellule bloquée est recouverte en rouge et un bord bloqué est orange. Utiliser **Edge** sur une cellule entièrement bloquée la convertit en collision par bords. Pour une grille, un déplacement est bloqué dès que l’une des deux tuiles adjacentes ferme leur bord commun. Pour un A2, le moteur recalcule le périmètre depuis les voisins du même terrain dans le même calque, comme l’auto-tiling visuel.

Un PNG local est importé avec toutes ses collisions à **None**. Un tileset copié depuis la bibliothèque conserve les collisions déclarées dans sa configuration JSON.

## 4. Lire et modifier la navigation

Ouvrez **Nav**, puis sélectionnez le plan à inspecter dans **Planes**.

### Légende de la map

- une cellule remplie en **rouge** est bloquée ;
- un segment **orange** indique qu’aucun passage n’est possible par ce bord ;
- un point **cyan** indique l’extrémité d’une connexion entre plans.

Un segment orange n’est pas forcément une collision de tileset. Il peut aussi indiquer la limite de la map, l’absence de surface voisine sur le plan courant ou une exception locale.

### Exceptions propres à la map

Choisissez une brosse, puis cliquez sur la cellule concernée dans la map :

| Brosse | Effet |
| --- | --- |
| **Block cell** | Force la cellule à être bloquée sur le plan actif. |
| **Open cell** | Force la cellule à exister et à être accessible sur le plan actif. |
| **N/E/S/W ×** | Force le bord correspondant à être fermé. |
| **N/E/S/W ↔** | Force le bord correspondant à être ouvert. |

Les exceptions de map sont prioritaires sur les collisions du tileset. Elles servent à traiter un cas unique sans modifier toutes les occurrences d’un terrain.

La priorité finale est :

1. exception de la map ;
2. collision du terrain dans le tileset ;
3. topologie du plan, donc présence ou absence d’une surface voisine.

Une exception reste persistante tant que la cellule n’est pas redessinée. Peindre, repeindre ou gommer une cellule en mode **Drawing** supprime ses exceptions de cellule et de quatre bords, puis rétablit le résultat automatique calculé depuis tous les calques de son plan. Une tuile décorative sans collision n’efface donc pas l’obstacle fourni par un autre calque.

Le compteur **blocked regions** correspond aux anciennes régions rectangulaires importées. Elles sont affichées par la vue Nav, mais ne sont pas encore éditables visuellement.

## 5. Connecter deux plans

Une connexion décrit le franchissement d’un bord entre une cellule du plan actif et la cellule adjacente d’un autre plan.

### Procédure

1. Dans **Nav**, sélectionnez le plan de départ dans **Planes**.
2. Dans **Explicit connection**, saisissez `X` et `Y` pour la cellule de départ.
3. Choisissez le bord traversé : `north`, `east`, `south` ou `west`.
4. Choisissez le plan d’arrivée.
5. Laissez **Bidirectional** coché si le joueur doit pouvoir revenir.
6. Cliquez sur **Add connection**.

Le Studio calcule automatiquement la cellule d’arrivée située juste de l’autre côté du bord. Par exemple, depuis `(13, 8)` vers `east`, l’arrivée est `(14, 8)`.

### Conditions à respecter

- la cellule de départ doit être accessible sur le plan de départ ;
- la cellule d’arrivée doit être accessible sur le plan d’arrivée ;
- la cellule d’arrivée ne doit pas déjà être accessible sur le plan de départ ;
- pour une connexion bidirectionnelle, la cellule de départ ne doit pas déjà être accessible sur le plan d’arrivée.

La raison des deux dernières règles est essentielle : le moteur cherche toujours d’abord une cellule voisine sur le plan courant. Une connexion n’est consultée que si cette voisine n’existe pas ou est bloquée.

Avec un plan en **Whole map**, il faut souvent utiliser **Block cell** sur la cellule située après la connexion pour rendre la transition possible. Sur un plan en **Painted cells**, il suffit généralement de ne pas peindre cette cellule dans la surface du plan de départ.

## 6. Recette : une passerelle entre deux plans

Supposons que le premier plan s’arrête à `(13, 8)` et que la passerelle commence à `(14, 8)`.

1. Créez le second plan et gardez **Painted cells**.
2. Peignez la surface du premier plan jusqu’à `x = 13`.
3. Peignez la surface du second plan à partir de `x = 14`.
4. Vérifiez que `(14, 8)` n’existe pas sur le premier plan et que `(13, 8)` n’existe pas sur le second.
5. Dans **Nav**, sélectionnez le premier plan.
6. Ajoutez une connexion bidirectionnelle depuis `(13, 8)`, bord `east`, vers le second plan.
7. Testez l’aller et le retour avec **Play**.

Le **Sentier brumeux** du jeu de référence utilise cette structure entre **Sentier des brumes** et **Passerelle ancienne**.

## 7. Recette : un toit praticable au-dessus d’un chemin

1. Conservez le chemin sur un premier plan.
2. Créez un second plan pour le toit, rendu après le premier.
3. Réglez ce plan sur **Painted cells**.
4. Peignez les tuiles du toit dans son calque surface, en **Below actors**.
5. Si nécessaire, ajoutez sur le même plan un calque **Above actors** pour le parapet ou le devant du toit.
6. Placez la rampe ou l’escalier à une frontière où une cellule du premier plan touche une cellule du toit.
7. Ajoutez une connexion entre ces deux cellules.
8. Si le premier plan est en **Whole map**, bloquez sur ce plan la cellule d’arrivée sur le toit afin que la connexion soit utilisée.

Le résultat est le suivant :

- le joueur resté sur le premier plan est rendu avant le toit et peut être masqué par celui-ci ;
- le joueur passé sur le plan du toit est rendu après la surface du toit et apparaît dessus ;
- les deux surfaces peuvent occuper les mêmes coordonnées sans provoquer de changement automatique de plan.

Le **Sanctuaire** du jeu de référence montre ce montage avec **Galerie noyée** et **Terrasse des cloches**.

## 8. Événements, téléportations et interactions

Chaque élément de gameplay doit appartenir au bon plan.

- Dans **Events**, sélectionnez un événement, puis choisissez son **Plane** dans la section **Position** de l’inspecteur droit.
- Une action de téléportation possède elle aussi un plan de destination, en plus de la map et des coordonnées.
- Les ennemis, projectiles, attaques, événements et déclencheurs n’interagissent qu’avec les éléments du même plan.

Un événement peut donc être visible parce qu’un plan est rendu, mais rester impossible à déclencher si le joueur se trouve sur un autre plan. Dans ce cas, vérifiez d’abord les deux `Plane`.

## 9. Explorer la démonstration de référence

### Sentier brumeux

1. Sélectionnez **Sentier brumeux** dans la liste des maps.
2. Dans **Drawing**, alternez entre **Sentier des brumes** et **Passerelle ancienne**.
3. Regardez quel calque est choisi comme surface et quelles cellules sont peintes.
4. Dans **Nav**, sélectionnez chaque plan : le point cyan à leur jonction représente la connexion.
5. Observez la case rouge du trou, les bords orange des barrières et l’ouverture locale créée par une exception.

### Sanctuaire

1. Sélectionnez **Sanctuaire noyé**.
2. Dans **Drawing**, comparez **Galerie noyée** et **Terrasse des cloches**.
3. Vérifiez que la terrasse est en **Painted cells** et rendue après la galerie.
4. Sélectionnez le calque du parapet : il appartient à la terrasse et utilise **Above actors**.
5. Dans **Nav**, observez la connexion et la cellule bloquée sur la galerie qui force le passage vers la terrasse.
6. Lancez **Play** pour comparer le joueur sous la terrasse et sur la terrasse.

## 10. Diagnostic rapide

| Problème | Vérification |
| --- | --- |
| Je peins mais le joueur ne peut pas marcher. | La tuile est-elle dans le calque surface ? Le plan est-il en **Painted cells** ? La cellule est-elle rouge dans **Nav** ? |
| Le joueur ne change pas de plan. | Une connexion existe-t-elle ? Le plan courant possède-t-il encore une cellule voisine qui prend la priorité ? |
| Le Studio refuse une connexion. | Vérifiez les quatre conditions de la section « Connecter deux plans », surtout les surfaces présentes de chaque côté. |
| Le joueur est devant le toit alors qu’il devrait être caché. | Le plan du toit est-il rendu après l’autre plan ? Sa surface est-elle en **Below actors** ? |
| Le joueur sur le toit est caché par tout le toit. | Le calque surface du toit est probablement en **Above actors** ; passez-le en **Below actors**. |
| Une barrière bloque partout dans le jeu. | Vous avez modifié une collision de terrain globale. Utilisez une exception **Open edge** pour le cas local. |
| Un événement visible ne répond pas. | L’événement et le joueur doivent être sur le même plan. |
| Je ne peux pas supprimer un plan. | Un calque, événement, spawn, connexion, exception ou téléportation le référence encore. |

## Règle pratique

Commencez avec un seul plan en **Whole map**. Ajoutez un nouveau plan en **Painted cells** uniquement lorsqu’une seconde surface jouable doit passer au-dessus, au-dessous ou indépendamment de la première. Utilisez les collisions de terrain pour les règles répétées, les exceptions pour les cas uniques et les connexions uniquement aux endroits où le joueur change réellement de surface.
