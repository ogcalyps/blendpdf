import type { UploadLimitsChrome } from './types';

// A no-break space between a number and its unit, and between groups of digits (RAE)
const NBSP = ' ';

const day = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const chrome: UploadLimitsChrome = {
  title: 'Límites de tamaño para subir un PDF en portales habituales',
  metaTitle: 'Tamaño máximo para subir un PDF, por portal y con fuentes | BlendPDF',
  description:
    'El PDF más grande que aceptan los portales de trámites, de visas y de universidades, cada uno con la frase del propio portal y un enlace para comprobarla. Puede reutilizarse libremente.',
  intro:
    'Los formularios en línea rechazan los archivos que superan cierto tamaño, y el límite suele estar escondido en una página de ayuda. Aquí tiene los límites de portales habituales, cada uno con la frase del sitio del propio portal (o del gobierno que lo gestiona) y la fecha en que la leímos por última vez.',
  method: `Solo incluimos un límite cuando el portal, sus páginas de ayuda oficiales o el gobierno que lo gestiona lo publican. Quedan fuera los portales que muestran su límite solo después de iniciar sesión, y los portales cuyo límite solo encontramos en otros sitios. Aquí, 1${NBSP}MB son 1${NBSP}000${NBSP}000 bytes, que es también lo que significa “1${NBSP}Mo”. Conviene quedarse un poco por debajo del límite: su dispositivo y el portal no siempre cuentan un megabyte de la misma manera (1${NBSP}000${NBSP}000 o 1${NBSP}048${NBSP}576 bytes).`,
  home: 'Inicio',
  jumpTo: 'Ir a',
  marks: ['“', '”'],
  columns: { portal: 'Portal', what: 'Qué se sube', limit: 'Tamaño máximo', source: 'Fuente' },
  per: { file: 'por archivo', total: 'en total' },
  categories: {
    government: 'Servicios públicos',
    immigration: 'Visas e inmigración',
    education: 'Estudios y admisiones',
    employment: 'Empleo',
    housing: 'Vivienda',
    tax: 'Impuestos',
    health: 'Salud',
  },
  checked: (date) => `comprobado el ${day(date)}`,
  compress: (label) => `Comprimir a menos de ${label}`,
  compressHint: (label) => `En “Comprimir PDF”, elija “Por debajo de un tamaño máximo” y escriba ${label}.`,
  reuse: {
    title: 'Reutilice esta lista',
    text: 'La tabla puede reutilizarse libremente con la licencia Creative Commons Atribución 4.0 (CC BY 4.0): puede publicarla en su página de ayuda o en un artículo, siempre que cite a BlendPDF con un enlace a esta página.',
    citation: 'Fuente: BlendPDF, “Límites de tamaño para subir un PDF en portales habituales”, https://blendpdf.com/es/pdf-upload-limits (CC BY 4.0)',
    copy: 'Copiar la cita',
    copied: 'Copiado',
    csv: 'Descargar CSV',
    json: 'Descargar JSON',
  },
  report: {
    before: '¿Ha cambiado el límite de algún portal? Escriba a ',
    after: ' y comprobaremos la fuente y actualizaremos la tabla en un plazo de 7 días.',
  },
  faq: [
    {
      question: '¿Por qué el portal rechaza mi archivo si está por debajo del límite?',
      answer: `Su dispositivo y el portal no siempre cuentan un megabyte de la misma manera (1${NBSP}000${NBSP}000 o 1${NBSP}048${NBSP}576 bytes), así que un archivo que su dispositivo muestra como de 1${NBSP}MB puede superar un límite de “1${NBSP}MB”. Quédese más o menos un 5${NBSP}% por debajo del límite. Revise también el formato: muchos portales solo aceptan PDF, o un archivo por documento.`,
    },
    {
      question: '¿Hay alguna diferencia entre MB y Mo?',
      answer: `No. Mo (mégaoctet) es como se escribe MB en francés: 1${NBSP}Mo = 1${NBSP}MB = 1000${NBSP}KB.`,
    },
    {
      question: '¿Cómo reduzco mi PDF por debajo del límite?',
      answer:
        'Abra “Comprimir PDF”, elija “Por debajo de un tamaño máximo” y escriba la cifra del portal. La herramienta comprime hasta que el archivo cabe, y le avisa si no lo consigue.',
    },
    {
      question: '¿Puedo publicar esta lista en mi sitio?',
      answer:
        'Sí. Tiene licencia CC BY 4.0: puede reutilizarla como quiera, citando a BlendPDF con un enlace a esta página. Los archivos CSV y JSON tienen las mismas filas, con sus fuentes.',
    },
  ],
};
