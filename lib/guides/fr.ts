import type { GuideChrome, GuideContent, GuideSlug } from './types';

export const chrome: GuideChrome = {
  guides: 'Guides',
  hubTitle: 'Guides BlendPDF',
  hubMetaTitle: 'Utiliser BlendPDF : guides pas à pas avec captures d’écran | BlendPDF',
  hubDescription:
    'Des guides pas à pas, avec captures d’écran : ajouter un en-tête, signer et apposer un cachet, réduire un PDF sous une taille maximale, fusionner et diviser des pages, modifier le texte d’un PDF.',
  hubIntro:
    'Des guides courts et concrets pour ce que l’on fait le plus souvent avec un PDF. Chacun montre les vrais écrans, dans l’ordre où vous les verrez.',
  home: 'Accueil',
  steps: 'Étapes',
  goodToKnow: 'Bon à savoir',
  moreGuides: 'Autres guides',
  minutes: (n) => `${n} min`,
  updated: 'Mis à jour en novembre 2026',
};

export const guides: Record<GuideSlug, GuideContent> = {
  'how-blendpdf-works': {
    title: 'Comment fonctionne BlendPDF : un PDF ouvert une fois, tous les outils',
    metaTitle: 'Utiliser BlendPDF : un fichier, tous les outils PDF | BlendPDF',
    description:
      'Visite rapide de BlendPDF : ouvrez un PDF une seule fois, puis modifiez-le, signez-le, organisez ses pages, compressez-le ou convertissez-le sans l’ouvrir à nouveau. Avec captures d’écran.',
    summary:
      'Ouvrez votre PDF une seule fois. Chaque outil travaille ensuite sur ce même fichier : ajouter du texte ou une signature, déplacer des pages, réduire sa taille ou le transformer en Word. Rien ne change dans votre fichier tant que vous n’avez pas enregistré.',
    steps: [
      {
        title: 'Déposez votre fichier sur la page d’accueil',
        text: 'Faites glisser un PDF sur **Déposez un PDF pour commencer**, ou cliquez n’importe où dans le cadre pour en choisir un. Les fichiers Word, PowerPoint, Excel et les images sont acceptés aussi : ils s’ouvrent dans l’outil qui les transforme en PDF.',
        shot: 1,
        alt: 'Le cadre de la page d’accueil où l’on dépose un PDF pour commencer',
      },
      {
        title: 'Repérez-vous dans la barre d’outils',
        text: 'La première ligne agit sur la page affichée : **Texte**, **Modifier le texte**, **Dessiner**, **Formes**, **Surligner**, **Masquer**, **Recadrer** et **Insérer** (une image, votre signature, la date, un filigrane, des numéros de page, un en-tête ou un autre PDF). La seconde agit sur tout le fichier : **Fusionner**, **Diviser**, **Pivoter**, **Supprimer**, **Signer**, **Filigrane**, **Numéroter**, **Compresser**, **Convertir** et **Protéger**.',
        shot: 2,
        alt: 'Une lettre ouverte dans BlendPDF, avec les deux lignes d’outils au-dessus et les pages à gauche',
      },
      {
        title: 'Vous ne trouvez pas un outil ? Ouvrez « Tous les outils »',
        text: '**Tous les outils** présente tout ce que BlendPDF peut faire avec ce fichier, classé par objectif : modifier les pages, ajouter aux pages, modifier le texte existant, obtenir un autre fichier ou réparer le fichier. Choisissez-en un : il s’ouvre ici même, sur le même fichier.',
        shot: 3,
        alt: 'Le panneau Tous les outils, qui liste chaque outil par groupe',
      },
      {
        title: 'Enregistrez, et choisissez ce que vous obtenez',
        text: '**Enregistrer le PDF** vous donne le PDF avec toutes vos modifications. **Options** présente tous les choix : un fichier Word, Excel, des images ou du texte à la place, seulement certaines pages, un fichier par page, un fichier plus léger, un mot de passe. Le bas de la fenêtre indique toujours ce que vous obtiendrez avant le téléchargement.',
        shot: 4,
        alt: 'La fenêtre Enregistrer votre fichier : PDF, Word, Excel, Images, Texte ou Images du PDF, quelles pages et combien de fichiers',
      },
    ],
    tips: [
      {
        title: 'Vos modifications attendent l’enregistrement',
        text: '« Annuler » et « Rétablir » fonctionnent pour tous les outils, et vous pouvez enregistrer autant de fois que vous le souhaitez.',
      },
      {
        title: 'Où va votre fichier',
        text: 'La modification, la signature et l’organisation des pages se font dans votre navigateur : le fichier reste sur votre appareil. Quelques outils, comme la compression ou la lecture du texte d’un document scanné (OCR), passent par notre serveur ; ces fichiers sont supprimés dans l’heure.',
      },
      {
        title: 'Sur téléphone',
        text: 'Tout fonctionne aussi sur téléphone. La page s’affiche en haut, et le panneau de l’outil choisi s’ouvre en dessous.',
      },
    ],
    cta: 'Ouvrir un PDF',
  },

  'add-letterhead-to-pdf': {
    title: 'Comment ajouter un en-tête à un PDF',
    metaTitle: 'Ajouter un en-tête à un PDF, gratuitement : nom, logo, pied de page | BlendPDF',
    description:
      'Ajoutez votre nom, votre logo et vos coordonnées sur chaque page d’un PDF, en français, en arabe ou en anglais. Créez l’en-tête une fois, réutilisez-le et partagez-le avec votre équipe.',
    summary:
      'Ouvrez le PDF, choisissez **Insérer** puis **En-tête**, et remplissez le haut à gauche, le haut à droite, le logo et le bas de page. L’en-tête s’affiche sur la page au fil de la saisie. BlendPDF le garde sur votre appareil : la prochaine fois, il se pose en un clic.',
    steps: [
      {
        title: 'Choisissez « Insérer », puis « En-tête »',
        text: 'Ouvrez la lettre ou le rapport sur la page Modifier un PDF. Dans la barre d’outils, cliquez sur **Insérer**, puis sur **En-tête**. Un panneau s’ouvre à côté de la page, ou en dessous sur téléphone.',
        shot: 1,
        alt: 'Le menu Insérer ouvert, avec En-tête parmi Image, Signature, Filigrane et Numéros de page',
      },
      {
        title: 'Remplissez les deux côtés, le logo et le bas de page',
        text: 'La première ligne de chaque côté est votre nom, écrit un peu plus grand ; les lignes suivantes sont vos coordonnées. Beaucoup d’en-têtes portent le nom en français à gauche et en arabe à droite. **Choisir un logo** place votre logo au centre. **Bas de page** accueille l’adresse, le téléphone, le courriel ou le numéro de récépissé.',
        shot: 2,
        alt: 'Une lettre avec son en-tête : le nom en français à gauche, en arabe à droite, un logo au centre et un trait fin en dessous',
      },
      {
        title: 'Choisissez les pages, puis enregistrez',
        text: 'Choisissez **Toutes** ou **Première**, puis cliquez sur **Enregistrer le PDF**. Si une page porte du texte là où va l’en-tête, BlendPDF la décale un peu vers le bas, et ne la réduit que s’il n’y a pas d’autre solution : rien n’est masqué.',
        shot: 3,
        alt: 'La fin du panneau En-tête : le bas de page, Toutes ou Première, et Enregistrer dans un fichier',
      },
      {
        title: 'Réutilisez-le, ou partagez-le avec votre équipe',
        text: 'L’en-tête reste sur cet appareil : la prochaine fois que vous choisirez **En-tête**, il se posera tout seul. Pour l’utiliser sur un autre ordinateur ou le transmettre à un collègue, cliquez sur **Enregistrer dans un fichier** et envoyez-lui le fichier ; il l’ouvrira avec **Ouvrir un fichier d’en-tête**.',
      },
    ],
    tips: [
      {
        title: 'Français et arabe sur le même en-tête',
        text: 'Chaque côté suit le sens de son propre texte : l’arabe se lit de droite à gauche et reste du vrai texte, consultable, dans le PDF enregistré.',
      },
      {
        title: 'Un nom long',
        text: 'Il passe sur une deuxième ligne au lieu de rapetisser. Limitez le bas de page à une ligne : c’est plus lisible.',
      },
      {
        title: 'Pages pivotées ou recadrées',
        text: 'Sur une page que vous avez pivotée ou recadrée dans l’éditeur, l’en-tête se place dans la marge du haut sans déplacer la page.',
      },
    ],
    cta: 'Ajouter un en-tête',
  },

  'sign-and-stamp-pdf': {
    title: 'Comment signer un PDF et y apposer un cachet',
    metaTitle: 'Signer un PDF et ajouter un cachet en ligne, gratuitement | BlendPDF',
    description:
      'Dessinez, saisissez ou importez votre signature, ajoutez la photo de votre cachet sans le fond du papier, et gardez-les sur votre appareil pour la prochaine fois. Gratuit, sans compte.',
    summary:
      'Ouvrez le PDF, choisissez **Insérer** puis **Signature**, et dessinez, saisissez ou importez votre signature ou votre cachet. La photo d’un cachet perd son fond de papier : il se pose sur la page comme de l’encre. Cochez **Garder sur cet appareil pour la prochaine fois** et il sera à un clic la prochaine fois.',
    steps: [
      {
        title: 'Ouvrez la fenêtre de signature',
        text: 'Ouvrez le PDF, faites défiler jusqu’à l’endroit de la signature, puis choisissez **Insérer** et **Signature** (ou **Signer** dans la seconde ligne). Avec **Dessiner**, tracez-la à la souris ou au doigt ; avec **Saisir**, tapez votre nom et choisissez un style d’écriture.',
        shot: 1,
        alt: 'La fenêtre Ajouter votre signature ou votre cachet, avec un nom saisi dans un style manuscrit',
      },
      {
        title: 'Ajoutez votre cachet à partir d’une photo ou d’un scan',
        text: 'Sous **Importer**, choisissez une photo ou un scan de votre cachet, ou de votre signature sur papier. BlendPDF efface le papier autour, qu’il soit blanc ou gris comme sur une photo prise au téléphone, et garde la couleur de l’encre. Cochez **Garder sur cet appareil pour la prochaine fois** si vous en aurez de nouveau besoin.',
        shot: 2,
        alt: 'Un cachet photographié dans l’onglet Importer, sans son fond de papier, avec Garder sur cet appareil coché',
      },
      {
        title: 'Placez-le, puis déplacez-le et redimensionnez-le',
        text: 'Cliquez sur **Placer sur la page**. Faites-le glisser à sa place et tirez un coin pour le redimensionner. Les flèches du clavier le déplacent d’un point à la fois ; avec la touche Maj enfoncée, de dix.',
        shot: 3,
        alt: 'Un cachet bleu sur une lettre, en partie sur la signature, le texte restant visible au travers',
      },
      {
        title: 'La prochaine fois : un seul clic',
        text: 'À la prochaine ouverture de la fenêtre, ce que vous avez gardé apparaît en haut, sous **Gardés sur cet appareil**. Cliquez dessus pour le placer. La petite croix le retire de cet appareil, ce qui compte sur un ordinateur de bureau partagé.',
        shot: 4,
        alt: 'La fenêtre de signature avec un cachet gardé sur cet appareil, prêt à être placé en un clic',
      },
    ],
    tips: [
      {
        title: 'Quelle valeur juridique ?',
        text: 'Une signature placée ainsi est une signature électronique simple. Elle convient aux courriers, reçus, attestations et documents destinés au public. Lorsqu’un document exige une signature certifiée ou légalisée, utilisez un certificat électronique qualifié ou la démarche papier habituelle.',
      },
      {
        title: 'Rien n’est gardé sans votre accord',
        text: '**Garder sur cet appareil pour la prochaine fois** reste décoché tant que vous ne le cochez pas. Ce que vous gardez reste dans ce navigateur uniquement et n’est jamais envoyé.',
      },
      {
        title: 'Plusieurs signatures',
        text: 'Placez une signature, puis la suivante : chacune est un élément distinct sur la page, que vous pouvez déplacer séparément.',
      },
    ],
    cta: 'Signer un PDF',
  },

  'compress-pdf-under-size-limit': {
    title: 'Comment réduire un PDF à moins de 2 Mo (ou toute autre limite)',
    metaTitle: 'Réduire un PDF sous 2 Mo, 1 Mo ou toute autre limite, gratuitement | BlendPDF',
    description:
      'Les formulaires en ligne refusent souvent les fichiers de plus de 1, 2 ou 5 Mo. Indiquez la limite : BlendPDF trouve la meilleure qualité qui tient dedans. Fonctionne avec les scans et les photos.',
    summary:
      'Ouvrez le PDF sur Compresser un PDF, choisissez **Sous une taille maximale**, saisissez la limite demandée par le formulaire (par exemple 2) et cliquez sur **Compresser le PDF**. BlendPDF essaie plusieurs réglages et garde le plus net qui respecte la limite. Si aucun n’y parvient, il indique la taille minimale atteinte.',
    steps: [
      {
        title: 'Choisissez « Sous une taille maximale » et indiquez la limite',
        text: 'Sur Compresser un PDF, choisissez **Sous une taille maximale** et saisissez le nombre de mégaoctets autorisé par le formulaire, par exemple 1 ou 2. Les décimales fonctionnent aussi : 1,5.',
        shot: 1,
        alt: 'Compresser un PDF avec Sous une taille maximale choisi et 1 Mo saisi',
      },
      {
        title: 'Compressez, puis vérifiez la nouvelle taille',
        text: 'Cliquez sur **Compresser le PDF**. Quelques secondes plus tard, la nouvelle taille s’affiche, par exemple « 229,41 Ko désormais, sous votre limite de 1 Mo ». Téléchargez le fichier, envoyez-le par courriel ou continuez à travailler dessus.',
        shot: 2,
        alt: 'Votre fichier est prêt : la nouvelle taille, sous la limite de 1 Mo, et le bouton Télécharger',
      },
      {
        title: 'Si la limite ne peut pas être atteinte',
        text: 'Les scans et les photos se réduisent beaucoup ; les fichiers surtout composés de texte, beaucoup moins. Si même la version la plus légère dépasse la limite, BlendPDF vous le signale et vous donne cette version. Retirez les pages inutiles, ou divisez le fichier en deux parties et envoyez-les l’une après l’autre.',
      },
    ],
    tips: [
      {
        title: 'Pourquoi 1 Mo vaut ici 1 000 000 d’octets',
        text: 'Les formulaires en ligne ne comptent pas tous un mégaoctet de la même façon. BlendPDF retient la valeur la plus petite : le fichier passe dans les deux cas.',
      },
      {
        title: 'Le texte reste net',
        text: 'Seules les images du PDF sont allégées. Le texte reste du texte : net, et consultable.',
      },
      {
        title: 'Déjà assez léger',
        text: 'Si le fichier est déjà sous la limite, BlendPDF le laisse tel quel.',
      },
    ],
    cta: 'Compresser un PDF',
  },

  'merge-split-reorder-pages': {
    title: 'Comment fusionner, diviser et réorganiser les pages d’un PDF',
    metaTitle: 'Fusionner, diviser, réorganiser et supprimer des pages PDF, gratuitement | BlendPDF',
    description:
      'Réunissez plusieurs PDF en un seul, divisez un PDF en plusieurs fichiers, déplacez, faites pivoter ou supprimez des pages en faisant glisser les miniatures. Gratuit, dans votre navigateur, sans compte.',
    summary:
      'Ouvrez votre PDF et cliquez sur **Toutes les pages** pour voir chaque page : faites glisser une page pour la déplacer, cochez des pages pour les faire pivoter ou les supprimer. Pour réunir des fichiers, utilisez Fusionner des PDF ou **Ajouter un PDF**. Pour couper un fichier en plusieurs, utilisez **Diviser** et choisissez comment.',
    steps: [
      {
        title: 'Affichez toutes les pages, puis faites-les glisser',
        text: 'Cliquez sur **Toutes les pages** au-dessus de la page. Faites glisser une page pour la déplacer. Cochez une ou plusieurs pages, puis utilisez **Pivoter à gauche**, **Pivoter à droite** ou **Supprimer la sélection** pour les modifier toutes à la fois.',
        shot: 1,
        alt: 'Toutes les pages : un rapport de cinq pages en miniatures, prêtes à être réorganisées',
      },
      {
        title: 'Divisez un PDF en plusieurs fichiers',
        text: 'Ouvrez le PDF sur Diviser un PDF, ou cliquez sur **Diviser**. Choisissez un PDF par page, un PDF toutes les quelques pages, un PDF par plage de pages sélectionnées, ou les pages sélectionnées dans un seul PDF. La ligne sous les choix indique exactement les fichiers que vous obtiendrez.',
        shot: 2,
        alt: 'Diviser un PDF avec Un PDF par page choisi et la liste des fichiers obtenus',
      },
      {
        title: 'Fusionnez plusieurs PDF en un seul',
        text: 'Sur Fusionner des PDF, déposez tous vos fichiers d’un coup, ou ouvrez-en un et cliquez sur **Ajouter un PDF** pour chacun des autres. Leurs pages forment une seule liste : faites-les glisser dans l’ordre voulu, puis cliquez sur **Fusionner les PDF**.',
        shot: 3,
        alt: 'Fusionner des PDF avec deux fichiers réunis en une seule liste de pages',
      },
    ],
    tips: [
      {
        title: 'Combien de fichiers',
        text: 'Jusqu’à 20 PDF par fusion, 100 Mo au total.',
      },
      {
        title: 'Des pages scannées à l’envers',
        text: 'Faites-les pivoter dans **Toutes les pages** avant d’enregistrer ; la rotation est enregistrée dans le fichier.',
      },
      {
        title: 'Ne garder que certaines pages',
        text: 'Cochez-les, ouvrez **Options** et choisissez **Uniquement les pages sélectionnées**.',
      },
    ],
    cta: 'Fusionner des PDF',
  },

  'edit-pdf-text': {
    title: 'Comment ajouter ou modifier du texte dans un PDF',
    metaTitle: 'Ajouter ou modifier du texte dans un PDF, en français ou en arabe, gratuitement | BlendPDF',
    description:
      'Écrivez n’importe où sur un PDF, en français, en arabe ou en anglais, ou modifiez une ligne du texte existant. Pas à pas, avec captures d’écran. Gratuit, sans compte.',
    summary:
      'Pour ajouter du texte, choisissez **Texte**, cliquez à l’endroit voulu et tapez. Pour modifier une ligne déjà présente dans le PDF, choisissez **Modifier le texte**, cliquez sur la ligne et saisissez la nouvelle formulation : BlendPDF retire l’ancienne ligne et écrit la nouvelle dans la police la plus proche dont il dispose.',
    steps: [
      {
        title: 'Ajoutez du texte n’importe où',
        text: 'Cliquez sur **Texte**, puis à l’endroit de la page où le texte doit aller, et tapez. Le français, l’arabe et l’anglais fonctionnent, même dans la même zone. Faites glisser la zone pour la déplacer ; sa taille et sa couleur se règlent dans la petite barre au-dessus.',
        shot: 1,
        alt: 'Une mention saisie dans la marge du haut d’une lettre, dans une zone de texte',
      },
      {
        title: 'Modifiez une ligne déjà présente',
        text: 'Cliquez sur **Modifier le texte**, puis sur la ligne à changer. Saisissez la nouvelle formulation dans le champ qui s’ouvre : la page affiche le résultat au fil de la saisie. À l’enregistrement, l’ancienne ligne est retirée de la page, et non simplement recouverte.',
        shot: 2,
        alt: 'Modifier le texte : la ligne d’objet d’une lettre en cours de modification, la nouvelle formulation affichée sur la page',
      },
      {
        title: 'Enregistrez',
        text: 'Cliquez sur **Enregistrer le PDF**. Vous pouvez continuer à modifier et enregistrer de nouveau aussi souvent que nécessaire.',
      },
    ],
    tips: [
      {
        title: 'Un paragraphe entier à réécrire',
        text: '**Modifier le texte** change une ligne à la fois. Pour une réécriture plus importante, convertissez le PDF en Word, modifiez-le, puis enregistrez-le de nouveau en PDF.',
      },
      {
        title: 'Une page scannée',
        text: 'Ses mots font partie d’une image. Placez **Masquer** sur les anciens mots et **Texte** par-dessus, ou rendez d’abord le scan consultable avec l’OCR.',
      },
      {
        title: 'Les polices',
        text: 'Lorsque la police d’origine ne peut pas écrire une lettre que vous avez tapée, BlendPDF utilise la police la plus proche dont il dispose et vous le signale.',
      },
    ],
    cta: 'Modifier un PDF',
  },
};
