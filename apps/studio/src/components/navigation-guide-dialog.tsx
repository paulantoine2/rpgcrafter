import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function NavigationGuideDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Plans, calques et navigation</DialogTitle>
        <DialogDescription>Le modèle mental et les gestes essentiels du Studio V0.6.</DialogDescription>
      </DialogHeader>

      <div className="space-y-5 text-xs leading-5">
        <section className="border bg-muted/20 p-3">
          <h3 className="font-medium text-foreground">À retenir</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Un <strong className="text-foreground">plan</strong> est une surface de gameplay indépendante.</li>
            <li>Un <strong className="text-foreground">calque</strong> est une image rattachée à un seul plan.</li>
            <li>Le <strong className="text-foreground">calque surface</strong> indique où un plan existe.</li>
            <li>Le joueur conserve son plan jusqu'à ce qu'il traverse une connexion explicite.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-medium">Drawing</h3>
          <p className="mt-1 text-muted-foreground"><strong className="text-foreground">Whole map</strong> rend toutes les cellules de la map praticables sur le plan. <strong className="text-foreground">Painted cells</strong> limite le plan aux cellules peintes dans son calque surface.</p>
          <p className="mt-1 text-muted-foreground"><strong className="text-foreground">Below actors</strong> est dessiné avant les acteurs du plan ; <strong className="text-foreground">Above actors</strong> après eux. Les plans sont ensuite rendus dans l'ordre indiqué par leur numéro.</p>
          <p className="mt-1 text-muted-foreground">Les collisions globales se dessinent avec <strong className="text-foreground">Cell</strong> et <strong className="text-foreground">Edge</strong> dans l’<strong className="text-foreground">Asset Manager</strong>. Sur un A2, Edge ferme uniquement le périmètre extérieur de chaque surface auto-tuilée. Repeindre ou gommer une cellule remet ses exceptions Nav à l'état automatique.</p>
        </section>

        <section>
          <h3 className="font-medium">Nav</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div className="border p-2"><span className="mr-2 inline-block size-3 bg-red-500/50 align-middle" />Rouge : cellule bloquée</div>
            <div className="border p-2"><span className="mr-2 inline-block h-1 w-4 bg-amber-500 align-middle" />Orange : bord infranchissable</div>
            <div className="border p-2"><span className="mr-2 inline-block size-3 rounded-full bg-cyan-400 align-middle" />Cyan : connexion</div>
          </div>
          <p className="mt-2 text-muted-foreground">Les brosses <strong className="text-foreground">Block/Open</strong> créent une exception locale prioritaire sur la collision du terrain. Un bord orange peut aussi simplement signaler qu'aucune surface voisine n'existe.</p>
        </section>

        <section>
          <h3 className="font-medium">Créer une connexion</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Sélectionnez le plan de départ dans <strong className="text-foreground">Planes</strong>.</li>
            <li>Indiquez la cellule de départ X/Y et le bord traversé.</li>
            <li>Choisissez le plan d'arrivée et cochez <strong className="text-foreground">Bidirectional</strong> si nécessaire.</li>
            <li>La cellule adjacente doit exister sur le plan d'arrivée, mais pas sur le plan de départ.</li>
          </ol>
          <p className="mt-2 border-l-2 border-primary pl-3 text-muted-foreground">Le moteur préfère toujours continuer sur le plan courant. Si ce plan est en <strong className="text-foreground">Whole map</strong>, bloquez souvent sa cellule voisine avec <strong className="text-foreground">Block cell</strong> pour que la connexion soit utilisée.</p>
        </section>

        <section>
          <h3 className="font-medium">Exemple du toit</h3>
          <p className="mt-1 text-muted-foreground">Créez le toit sur un second plan en <strong className="text-foreground">Painted cells</strong>, rendu après le plan inférieur. Sa surface reste en <strong className="text-foreground">Below actors</strong> ; un parapet peut utiliser un autre calque en <strong className="text-foreground">Above actors</strong>. Reliez les deux plans à la rampe ou à l'escalier.</p>
        </section>

        <p className="border-t pt-3 text-muted-foreground">Le guide détaillé, les recettes complètes et le diagnostic des erreurs se trouvent dans <strong className="text-foreground">STUDIO_GUIDE.md</strong> à la racine du projet.</p>
      </div>
    </DialogContent>
  </Dialog>;
}
