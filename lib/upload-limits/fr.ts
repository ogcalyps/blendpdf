import type { UploadLimitsChrome } from './types';

const NBSP = ' ';
const NNBSP = ' ';

const day = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const chrome: UploadLimitsChrome = {
  title: 'Taille maximale des PDF acceptée par les principaux portails',
  metaTitle: 'Taille maximale des PDF par portail (ANTS, CAF, ANEF…) | BlendPDF',
  description:
    'La taille maximale des fichiers PDF acceptée par les portails administratifs, de visa et d’admission, avec la phrase exacte de chaque site et le lien pour la vérifier. Réutilisation libre.',
  intro:
    'Les formulaires de dépôt refusent les fichiers au-delà d’une certaine taille, et cette limite est souvent difficile à trouver. Voici les limites des principaux portails, chacune accompagnée de la phrase publiée par le portail lui-même (ou par l’administration qui le gère) et de la date de notre dernière vérification.',
  method: `Nous ne retenons une limite que si le portail, ses pages d’aide officielles ou l’administration qui le gère l’indiquent publiquement. Les portails qui n’affichent leur limite qu’après connexion, ou dont la limite ne figure que sur des sites tiers, sont écartés. Ici, 1${NBSP}Mo correspond à 1${NNBSP}000${NNBSP}000${NBSP}octets. Visez un peu en dessous de la limite${NBSP}: selon l’appareil ou le portail, 1${NBSP}Mo vaut 1${NNBSP}000${NNBSP}000 ou 1${NNBSP}048${NNBSP}576${NBSP}octets.`,
  home: 'Accueil',
  jumpTo: 'Aller à',
  marks: [`«${NBSP}`, `${NBSP}»`],
  columns: { portal: 'Portail', what: 'Ce que vous déposez', limit: 'Taille maximale', source: 'Source' },
  per: { file: 'par fichier', total: 'au total' },
  categories: {
    government: 'Services publics',
    immigration: 'Visas et immigration',
    education: 'Études et admissions',
    employment: 'Emploi',
    housing: 'Logement',
    tax: 'Impôts',
    health: 'Santé',
  },
  checked: (date) => `vérifié le ${day(date)}`,
  compress: (label) => `Compresser à moins de ${label}`,
  compressHint: (label) => `Dans l’outil Compresser un PDF, choisissez «${NBSP}Sous une taille maximale${NBSP}», puis indiquez ${label}.`,
  reuse: {
    title: 'Réutiliser cette liste',
    text: `Ce tableau est librement réutilisable sous licence Creative Commons Attribution 4.0 (CC BY 4.0)${NBSP}: vous pouvez le reprendre sur une page d’aide ou dans un article, à condition de citer BlendPDF avec un lien vers cette page.`,
    citation: `Source${NBSP}: BlendPDF, «${NBSP}Taille maximale des PDF acceptée par les principaux portails${NBSP}», https://blendpdf.com/fr/pdf-upload-limits (CC BY 4.0)`,
    copy: 'Copier la mention de la source',
    copied: 'Copié',
    csv: 'Télécharger en CSV',
    json: 'Télécharger en JSON',
  },
  report: {
    before: `Un portail a modifié sa limite${NNBSP}? Écrivez-nous à `,
    after: `${NBSP}: nous vérifierons la source et mettrons le tableau à jour sous 7${NBSP}jours.`,
  },
  faq: [
    {
      question: `Pourquoi le portail refuse-t-il mon fichier alors qu’il est sous la limite${NNBSP}?`,
      answer: `Votre ordinateur et le portail ne comptent pas toujours le mégaoctet de la même façon (1${NNBSP}000${NNBSP}000 ou 1${NNBSP}048${NNBSP}576${NBSP}octets)${NBSP}: un fichier affiché à 1${NBSP}Mo sur votre ordinateur peut donc dépasser une limite de «${NBSP}1${NBSP}Mo${NBSP}». Visez environ 5${NNBSP}% en dessous de la limite. Vérifiez aussi le format${NBSP}: beaucoup de portails n’acceptent que le PDF, ou un seul fichier par pièce.`,
    },
    {
      question: `Quelle différence entre Mo et MB${NNBSP}?`,
      answer: `Aucune${NBSP}: MB est l’abréviation anglaise de mégaoctet. 1${NBSP}Mo = 1${NBSP}MB = 1${NNBSP}000${NBSP}Ko.`,
    },
    {
      question: `Comment ramener mon PDF sous la limite${NNBSP}?`,
      answer: `Ouvrez l’outil Compresser un PDF, choisissez «${NBSP}Sous une taille maximale${NBSP}» et indiquez la limite du portail${NBSP}: l’outil compresse jusqu’à ce que le fichier passe, et vous prévient s’il n’y parvient pas.`,
    },
    {
      question: `Puis-je reprendre cette liste sur mon site${NNBSP}?`,
      answer: `Oui. Elle est publiée sous licence CC BY 4.0${NBSP}: vous pouvez la réutiliser librement, en citant BlendPDF avec un lien vers cette page. Les fichiers CSV et JSON contiennent les mêmes données, avec leurs sources.`,
    },
  ],
};
