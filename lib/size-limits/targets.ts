/**
 * The size pages' limits and their labels, without their text: small enough
 * for client pages (the /compress-pdf link row) to import.
 */
import type { PortalTarget, SizeTarget } from './types';

/** Smallest first, the order the links use. */
export const SIZE_TARGETS: readonly SizeTarget[] = [
  { slug: 'to-100kb', limitMb: 0.1, pagesGood: 1, pagesSmallest: 4 },
  { slug: 'to-200kb', limitMb: 0.2, pagesGood: 2, pagesSmallest: 8 },
  { slug: 'to-500kb', limitMb: 0.5, pagesGood: 5, pagesSmallest: 20 },
  { slug: 'to-1mb', limitMb: 1, pagesGood: 10, pagesSmallest: 40 },
  { slug: 'to-2mb', limitMb: 2, pagesGood: 20, pagesSmallest: 80 },
];

/**
 * One site's limit per file, from its own help pages or its own signed replies
 * (research 2026-11-07). Sites whose limit we couldn't source (Parcoursup, the
 * Moroccan portals, UK visas) have no page.
 */
export const PORTALS: readonly PortalTarget[] = [
  {
    slug: 'for-ants',
    limitMb: 1,
    pagesGood: 10,
    pagesSmallest: 40,
    locales: ['fr'],
    sourceUrl: 'https://plus.transformation.gouv.fr/experiences/6608815_fichier-superieur-a-1mo-pour-carte-grise',
    checked: '2026-11-07',
  },
  {
    slug: 'for-ircc',
    limitMb: 4,
    pagesGood: 40,
    pagesSmallest: 160,
    locales: ['en', 'fr', 'ar'],
    sourceUrl: 'https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=1123',
    checked: '2026-11-07',
  },
  {
    slug: 'for-campus-france',
    // The 2026 Études en France platform: 10 Mo on every upload. The old platform's 300 Ko is still on older pages.
    limitMb: 10,
    pagesGood: 100,
    pagesSmallest: 400,
    locales: ['fr', 'ar'],
    sourceUrl: 'https://www.maurice.campusfrance.org/system/files/medias/documents/2026-10/Guide%20%C3%A9tudiant%20-%20%C3%89tudes%20en%20France%202026%20Maurice_compressed_compressed.pdf',
    checked: '2026-11-12',
  },
  {
    slug: 'for-anef',
    limitMb: 10,
    pagesGood: 100,
    pagesSmallest: 400,
    locales: ['fr', 'ar'],
    sourceUrl: 'https://www.hautes-alpes.gouv.fr/contenu/telechargement/19358/167044/file/PJ%20Saisonnier%20en%20fran%C3%A7ais.pdf',
    checked: '2026-11-07',
  },
  {
    slug: 'for-caf',
    limitMb: 10,
    pagesGood: 100,
    pagesSmallest: 400,
    locales: ['fr'],
    sourceUrl: 'https://www.caf.fr/allocataires/caf-du-nord/offre-de-service/thematique-libre/envoyer-un-document-la-caf-depuis-mon-espace-mon-compte',
    checked: '2026-11-07',
  },
  {
    slug: 'for-france-travail',
    limitMb: 5,
    pagesGood: 50,
    pagesSmallest: 200,
    locales: ['fr'],
    sourceUrl: 'https://plus.transformation.gouv.fr/experiences/6685404_france-travail-poids-des-fichiers-a-teletransmettre',
    checked: '2026-11-07',
  },
];

/** "100 KB", "1 Mo", "2 ميجابايت": KB under 1 MB, in the units the workspace uses. */
export function sizeLabel(limitMb: number, locale: string): string {
  const kb = limitMb < 1;
  const n = kb ? Math.round(limitMb * 1000) : limitMb;
  if (locale === 'fr') return `${n.toLocaleString('fr-FR')} ${kb ? 'Ko' : 'Mo'}`;
  if (locale === 'ar') return `${n} ${kb ? 'كيلوبايت' : 'ميجابايت'}`;
  return `${n} ${kb ? 'KB' : 'MB'}`;
}
