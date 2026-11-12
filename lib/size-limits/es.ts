import type { PortalSlug, PortalText, SizeChrome, SizeLimit, SizePageText, SizeTargetSlug } from './types';
import { sizeLabel } from './targets';

// Spanish typography: decimal comma, a no-break space between a number and its unit,
// and digits grouped by threes with a no-break space (RAE), read the same in Spain and Latin America
const NBSP = '\u00a0';

const mb = (n: number) => n.toLocaleString('es-ES');
const digits = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
const label = (t: SizeLimit) => sizeLabel(t.limitMb, 'es');

export const chrome: SizeChrome = {
  label,
  summary: (t) =>
    `Abra su PDF más abajo: la opción **Por debajo de un tamaño máximo** ya está elegida, con ${mb(t.limitMb)}${NBSP}MB${t.limitMb < 1 ? ` (${label(t)})` : ''}. Haga clic en **Comprimir PDF**. BlendPDF prueba primero el ajuste más nítido y solo baja la calidad lo necesario para que el archivo quepa. Antes de descargarlo, verá el nuevo tamaño.`,
  fitsTitle: 'Cuántas páginas caben',
  fits: (t) =>
    `Aproximadamente ${t.pagesGood === 1 ? 'una página escaneada' : `${t.pagesGood} páginas escaneadas`} con buena calidad, o hasta ${t.pagesSmallest} con el ajuste más bajo que todavía permite leerlas. La referencia es una página A4 escaneada en color con el teléfono; los escaneos en blanco y negro y los documentos de texto ocupan mucho menos.`,
  tooBigTitle: '¿Sigue siendo demasiado grande?',
  tooBig: [
    {
      title: 'Quite las páginas que no necesita',
      text: 'Las páginas en blanco, las de instrucciones y las copias repetidas también cuentan. Quítelas antes de comprimir.',
      link: { href: '/delete-pages', text: 'Eliminar páginas' },
    },
    {
      title: 'Divida el archivo',
      text: 'Los formularios suelen pedir un documento en cada campo. Divida el archivo y suba cada parte donde corresponda.',
      link: { href: '/split-pdf', text: 'Dividir PDF' },
    },
    {
      title: 'Recorte las fotos de documentos',
      text: 'Una foto tomada con el teléfono también incluye la mesa y el fondo. Recórtela primero al borde del papel.',
      link: { href: '/crop-pdf', text: 'Recortar PDF' },
    },
    {
      title: 'Vuelva a escanear con menos peso',
      text: `Escanee en blanco y negro o en escala de grises a 150${NBSP}ppp. Un escaneo en color a 300${NBSP}ppp pesa varias veces más y no se lee mejor.`,
    },
  ],
  faq: (t) => [
    {
      question: '¿Se podrá leer bien?',
      answer:
        'El texto se conserva como texto, así que las páginas escritas siguen nítidas con cualquier tamaño. Los escaneos y las fotos pierden detalle a medida que baja el tamaño. Por eso BlendPDF se detiene en el ajuste más nítido con el que el archivo cabe, en lugar de ir directamente al más pequeño.',
    },
    {
      question: `¿Un límite de ${label(t)} se calcula con 1000 o con 1024?`,
      answer: `Los formularios cuentan de las dos maneras, así que BlendPDF se queda por debajo de la cifra menor: ${digits(Math.round(t.limitMb * 1_000_000))} bytes. El archivo pasa en los dos casos.`,
    },
    {
      question: '¿Puedo elegir otro límite?',
      answer: `Sí. Después de abrir su PDF, escriba en el campo cualquier límite entre 0,1${NBSP}MB y 50${NBSP}MB.`,
    },
    {
      question: '¿Se guarda mi archivo?',
      answer:
        'La compresión se hace en nuestro servidor. El archivo se elimina en menos de una hora, en la mayoría de los casos justo después de procesarlo. No necesita crear una cuenta, no se agrega marca de agua y no tiene que pagar nada.',
    },
  ],
  otherSizes: 'Otros tamaños',
  guide: 'Guía paso a paso con imágenes',
  allLimits: 'Los límites de otros portales, con sus fuentes',
  home: 'Inicio',
  compress: 'Comprimir PDF',
  rulesTitle: (name) => `Qué acepta ${name}`,
  source: (name, checked) =>
    `Fuente: ${name}, consultada el ${new Date(`${checked}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}.`,
  otherSites: 'Para un sitio específico',
};

const page = (limitMb: number, whoAsks: string): SizePageText => {
  const n = sizeLabel(limitMb, 'es');
  return {
    title: `Comprimir un PDF a menos de ${n}`,
    metaTitle: `Comprimir PDF a ${n} en línea, gratis | BlendPDF`,
    description: `Reduzca su PDF a menos de ${n} para un formulario en línea. Gratis y sin registrarse: BlendPDF elige la mejor calidad que permite ese tamaño.`,
    whoAsks,
  };
};

export const pages: Record<SizeTargetSlug, SizePageText> = {
  'to-100kb': page(0.1, 'Algunos formularios de solicitud solo aceptan archivos muy pequeños, por lo general para un solo documento escaneado, como un documento de identidad o un certificado.'),
  'to-200kb': page(0.2, 'Un límite habitual para una o dos páginas escaneadas en solicitudes de empleo, de admisión a estudios y de inscripción a exámenes.'),
  'to-500kb': page(0.5, 'Suficiente para un documento corto, como un recibo de sueldo, una carta o un certificado con su traducción.'),
  'to-1mb': page(1, 'Uno de los límites más comunes en los formularios en línea, a menudo por documento.'),
  'to-2mb': page(2, `Algunos programas universitarios y formularios de visa limitan cada documento a 2${NBSP}MB.`),
};

// No portal page is in Spanish (PortalTarget.locales): these stay as in en.ts.
export const portals: Partial<Record<PortalSlug, PortalText>> = {
  'for-ircc': {
    name: 'IRCC',
    short: 'IRCC',
    title: 'Compress a PDF for IRCC (under 4 MB)',
    metaTitle: 'Compress PDF for IRCC to 4 MB, Free | BlendPDF',
    description: 'The IRCC secure account and PR portal refuse files over 4 MB. Get your PDF under the limit for free, no sign-up.',
    whoAsks: 'The IRCC secure account and the Permanent Residence portal take 4 MB per file, and one file per upload box.',
    rules: [
      '4 MB per file on the IRCC secure account, the PR portal and citizenship applications; 5 MB on the IRCC Portal.',
      'One file per box: a second upload replaces the first, so merge the pages of one document first.',
      'Some forms go as low as 2 MB.',
      'IRCC suggests scanning at 150 dpi or less.',
    ],
    sourceName: 'IRCC Help Centre',
    link: { href: '/merge-pdf', text: 'Merge PDF' },
  },
};
