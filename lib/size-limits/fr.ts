import type { PortalSlug, PortalText, SizeChrome, SizeLimit, SizePageText, SizeTargetSlug } from './types';
import { sizeLabel } from './targets';

// French typography: no-break space between a number and its unit and before a colon,
// narrow no-break space before ; ! ? (see the French locale's style rules)
const NBSP = ' ';
const NNBSP = ' ';

const mb = (n: number) => n.toLocaleString('fr-FR');
const label = (t: SizeLimit) => sizeLabel(t.limitMb, 'fr');
const pageCount = (n: number) => (n === 1 ? 'une page' : `${n}${NBSP}pages`);

export const chrome: SizeChrome = {
  label,
  summary: (t) =>
    `Ouvrez votre PDF ci-dessous${NBSP}: **Sous une taille maximale** est déjà réglé sur ${mb(t.limitMb)}${NBSP}Mo${t.limitMb < 1 ? ` (${label(t)})` : ''}. Cliquez sur **Compresser le PDF**. BlendPDF essaie d’abord le réglage le plus net, ne descend que si nécessaire, puis affiche la nouvelle taille avant le téléchargement.`,
  fitsTitle: 'Combien de pages tiennent',
  fits: (t) =>
    `Environ ${pageCount(t.pagesGood)} numérisée${t.pagesGood === 1 ? '' : 's'} en bonne qualité, ou jusqu’à ${pageCount(t.pagesSmallest)} au plus petit réglage encore lisible. Il s’agit d’une page A4 photographiée en couleur avec un téléphone${NNBSP}; les numérisations en noir et blanc et les documents tapés à l’ordinateur sont bien plus légers.`,
  tooBigTitle: `Toujours trop lourd${NNBSP}?`,
  tooBig: [
    {
      title: 'Retirez les pages inutiles',
      text: `Pages blanches, pages d’instructions, doubles exemplaires${NBSP}: tout compte. Retirez-les avant de compresser.`,
      link: { href: '/delete-pages', text: 'Supprimer des pages' },
    },
    {
      title: 'Divisez le fichier',
      text: 'Les formulaires attendent en général un document par case. Divisez le fichier et déposez chaque partie au bon endroit.',
      link: { href: '/split-pdf', text: 'Diviser un PDF' },
    },
    {
      title: 'Recadrez les photos de documents',
      text: 'Une photo prise au téléphone contient aussi la table et le fond. Recadrez d’abord sur la feuille.',
      link: { href: '/crop-pdf', text: 'Recadrer un PDF' },
    },
    {
      title: 'Numérisez à nouveau, plus léger',
      text: `Numérisez en noir et blanc ou en niveaux de gris à 150${NBSP}dpi. Une numérisation couleur à 300${NBSP}dpi est plusieurs fois plus lourde, sans être plus lisible.`,
    },
  ],
  faq: (t) => [
    {
      question: `Le document restera-t-il lisible${NNBSP}?`,
      answer: `Le texte reste du texte${NBSP}: les pages tapées à l’ordinateur restent nettes quelle que soit la taille. Les numérisations et les photos perdent en détail quand la taille baisse${NNBSP}; c’est pourquoi BlendPDF s’arrête au réglage le plus net qui tient, au lieu d’aller directement au plus petit.`,
    },
    {
      question: `${label(t)}, est-ce compté en 1${NNBSP}000 ou en 1${NNBSP}024${NNBSP}?`,
      answer: `Les formulaires comptent des deux façons, BlendPDF vise donc la plus petite${NBSP}: ${(t.limitMb * 1_000_000).toLocaleString('fr-FR')}${NBSP}octets. Le fichier passe dans les deux cas.`,
    },
    {
      question: `Puis-je choisir une autre limite${NNBSP}?`,
      answer: `Oui. Saisissez la limite de votre choix, de 0,1 à 50${NBSP}Mo, dans la case qui s’affiche une fois votre PDF ouvert.`,
    },
    {
      question: `Mon fichier est-il conservé${NNBSP}?`,
      answer:
        'La compression se fait sur notre serveur. Le fichier est supprimé dans l’heure, le plus souvent dès la fin du traitement. Pas de compte, pas de filigrane, rien à payer.',
    },
  ],
  otherSizes: 'Autres tailles',
  guide: 'Le guide pas à pas, en images',
  allLimits: 'Les limites des autres portails, avec leurs sources',
  home: 'Accueil',
  compress: 'Compresser un PDF',
  // « Ce qu’IRCC accepte » but « Ce que l’ANTS accepte »
  rulesTitle: (name) => `${/^[aeiouyh]/i.test(name) ? 'Ce qu’' : 'Ce que '}${name} accepte`,
  source: (name, checked) =>
    `Source${NBSP}: ${name}, vérifié le ${new Date(`${checked}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}.`,
  otherSites: 'Pour un site précis',
};

const page = (n: string, whoAsks: string): SizePageText => ({
  title: `Compresser un PDF à moins de ${n}`,
  metaTitle: `Compresser un PDF à ${n} en ligne, gratuit | BlendPDF`,
  description: `Passez votre PDF sous ${n} pour un formulaire en ligne. Gratuit, sans inscription${NBSP}: BlendPDF choisit la qualité la plus nette qui tient.`,
  whoAsks,
});

export const pages: Record<SizeTargetSlug, SizePageText> = {
  'to-100kb': page(
    `100${NBSP}Ko`,
    'Certains formulaires de candidature n’acceptent que de très petits fichiers, souvent pour une seule pièce numérisée, comme une carte d’identité ou un diplôme.'
  ),
  'to-200kb': page(`200${NBSP}Ko`, 'Une limite fréquente pour une ou deux pages numérisées dans les candidatures à un emploi, à une école ou à un concours.'),
  'to-500kb': page(`500${NBSP}Ko`, `Assez pour un document court${NBSP}: un bulletin de salaire, un courrier ou une attestation.`),
  'to-1mb': page(`1${NBSP}Mo`, 'C’est la limite de l’ANTS pour les démarches de carte grise, et l’une des plus courantes sur les formulaires en ligne.'),
  'to-2mb': page(`2${NBSP}Mo`, `Certaines formations et certains formulaires de visa limitent chaque document à 2${NBSP}Mo.`),
};

export const portals: Partial<Record<PortalSlug, PortalText>> = {
  'for-ants': {
    name: 'l’ANTS',
    short: 'ANTS',
    title: `Compresser un PDF pour l’ANTS (moins de 1${NBSP}Mo)`,
    metaTitle: `PDF trop lourd pour l’ANTS${NBSP}: compresser sous 1${NBSP}Mo, gratuit | BlendPDF`,
    description: `L’ANTS refuse les fichiers de plus de 1${NBSP}Mo pour la carte grise. Passez votre PDF sous 1${NBSP}Mo gratuitement, sans inscription.`,
    whoAsks: `Pour les démarches de carte grise, l’ANTS refuse tout fichier de plus de 1${NBSP}Mo.`,
    rules: [
      `1${NBSP}Mo maximum par fichier.`,
      `Formats acceptés${NBSP}: PDF, JPEG ou PNG.`,
      'Gardez un nom de fichier court.',
      `Pour le permis de conduire, la limite est de 11${NBSP}Mo par fichier.`,
    ],
    sourceName: 'réponse de l’ANTS sur Services Publics+',
  },
  'for-ircc': {
    name: 'IRCC',
    short: 'IRCC',
    title: `Compresser un PDF pour IRCC (moins de 4${NBSP}Mo)`,
    metaTitle: `Compresser un PDF pour IRCC (4${NBSP}Mo), gratuit | BlendPDF`,
    description: `Le compte sécurisé IRCC et le portail RP refusent les fichiers de plus de 4${NBSP}Mo. Passez votre PDF sous la limite, gratuitement.`,
    whoAsks: `Le compte sécurisé IRCC et le portail de résidence permanente acceptent 4${NBSP}Mo par fichier, et un seul fichier par case.`,
    rules: [
      `4${NBSP}Mo maximum par fichier sur le compte sécurisé IRCC, le portail RP et les demandes de citoyenneté${NNBSP}; 5${NBSP}Mo sur le Portail d’IRCC.`,
      `Un seul fichier par case${NBSP}: un deuxième envoi remplace le premier. Fusionnez d’abord les pages d’un même document.`,
      `Certains formulaires descendent à 2${NBSP}Mo.`,
      `IRCC conseille de numériser à 150${NBSP}dpi ou moins.`,
    ],
    sourceName: 'Centre d’aide d’IRCC',
    link: { href: '/merge-pdf', text: 'Fusionner des PDF' },
  },
  'for-campus-france': {
    name: 'Campus France',
    short: 'Campus France',
    title: `Compresser un PDF pour Campus France (moins de 10${NBSP}Mo)`,
    metaTitle: `Compresser un PDF pour Études en France (10${NBSP}Mo), gratuit | BlendPDF`,
    description: `La plateforme Études en France accepte jusqu’à 10${NBSP}Mo par fichier, en PDF, JPG ou PNG. Passez votre PDF sous la limite, gratuitement, sans inscription.`,
    whoAsks: `Sur la plateforme Études en France, chaque justificatif est limité à 10${NBSP}Mo, de même que la photo d’identité.`,
    rules: [
      `10${NBSP}Mo maximum par fichier, pour les justificatifs comme pour la photo d’identité.`,
      `Formats acceptés${NBSP}: PDF, JPG ou PNG.`,
      `D’anciennes pages mentionnent encore 300${NBSP}Ko${NNBSP}; le guide 2026 indique 10${NBSP}Mo.`,
    ],
    sourceName: 'guide étudiant Études en France 2026 de Campus France Maurice',
  },
  'for-anef': {
    name: 'l’ANEF',
    short: 'ANEF',
    title: 'Compresser un PDF pour l’ANEF (titre de séjour)',
    metaTitle: `PDF pour l’ANEF${NBSP}: fusionner et compresser sous 10${NBSP}Mo | BlendPDF`,
    description: `L’ANEF accepte 10${NBSP}Mo par fichier et 3${NBSP}fichiers par rubrique. Fusionnez les pages de votre passeport et compressez si besoin, gratuitement.`,
    whoAsks: `Sur l’ANEF, chaque fichier est limité à 10${NBSP}Mo et chaque rubrique à 3${NBSP}fichiers.`,
    rules: [
      `10${NBSP}Mo maximum par fichier.`,
      `Formats acceptés${NBSP}: PDF, JPG ou PNG.`,
      `3${NBSP}fichiers maximum par rubrique${NBSP}: réunissez toutes les pages tamponnées du passeport dans un seul PDF.`,
    ],
    sourceName: 'liste des pièces de la préfecture des Hautes-Alpes',
    link: { href: '/merge-pdf', text: 'Fusionner des PDF' },
  },
  'for-caf': {
    name: 'la CAF',
    short: 'CAF',
    title: `Compresser un PDF pour la CAF (moins de 10${NBSP}Mo)`,
    metaTitle: `Envoyer un justificatif à la CAF${NBSP}: PDF sous 10${NBSP}Mo, gratuit | BlendPDF`,
    description: `La CAF accepte 10${NBSP}Mo par envoi, tous documents compris. Passez vos justificatifs sous la limite, gratuitement, sans inscription.`,
    whoAsks: `Depuis Mon Compte, la CAF accepte 10${NBSP}Mo par envoi, tous les documents de l’envoi compris.`,
    rules: [
      `10${NBSP}Mo maximum par envoi, pour l’ensemble des documents.`,
      `Formats acceptés${NBSP}: PDF, JPEG, PNG ou GIF.`,
      `Un seul type de document par envoi${NBSP}: 3${NBSP}bulletins de salaire font un envoi, un bulletin et une quittance de loyer en font deux.`,
      'L’image ne doit être ni coupée, ni de travers, ni floue.',
    ],
    sourceName: 'page d’aide de la CAF',
    link: { href: '/images-to-pdf', text: 'Mettre des photos en PDF' },
  },
  'for-france-travail': {
    name: 'France Travail',
    short: 'France Travail',
    title: `Compresser un PDF pour France Travail (moins de 5${NBSP}Mo)`,
    metaTitle: `PDF trop lourd pour France Travail${NBSP}: compresser sous 5${NBSP}Mo | BlendPDF`,
    description: `France Travail refuse les fichiers de plus de 5${NBSP}Mo. Passez votre PDF sous la limite, gratuitement, sans inscription.`,
    whoAsks: `France Travail accepte 5${NBSP}Mo par fichier envoyé depuis votre espace personnel.`,
    rules: [
      `5${NBSP}Mo maximum par fichier.`,
      `Formats acceptés${NBSP}: PDF ou JPG.`,
      'Réunissez les pages d’un même document dans un seul fichier.',
      'Si un document est refusé, France Travail vous prévient par courriel.',
    ],
    sourceName: 'réponse de France Travail sur Services Publics+',
    link: { href: '/merge-pdf', text: 'Fusionner des PDF' },
  },
};
