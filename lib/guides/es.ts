import type { GuideChrome, GuideContent, GuideSlug } from './types';

export const chrome: GuideChrome = {
  guides: 'Guías',
  hubTitle: 'Guías de BlendPDF',
  hubMetaTitle: 'Cómo usar BlendPDF: guías paso a paso con capturas de pantalla | BlendPDF',
  hubDescription:
    'Guías paso a paso con capturas de pantalla: agregar un membrete, firmar y sellar, reducir un PDF por debajo de un tamaño máximo, unir y dividir páginas, y cambiar el texto de un PDF.',
  hubIntro:
    'Guías breves y prácticas para lo que más se hace con un PDF. Cada una muestra las pantallas reales, en el orden en que usted las verá.',
  home: 'Inicio',
  steps: 'Pasos',
  goodToKnow: 'Para tener en cuenta',
  moreGuides: 'Más guías',
  minutes: (n) => `${n} min`,
  updated: 'Actualizado en noviembre de 2026',
};

export const guides: Record<GuideSlug, GuideContent> = {
  'how-blendpdf-works': {
    title: 'Cómo funciona BlendPDF: abra un PDF una vez y use todas las herramientas',
    metaTitle: 'Cómo usar BlendPDF: un archivo, todas las herramientas PDF | BlendPDF',
    description:
      'Un recorrido rápido por BlendPDF: abra un PDF una sola vez y luego edítelo, fírmelo, organice sus páginas, comprímalo o conviértalo sin volver a abrirlo. Con capturas de pantalla.',
    summary:
      'Abra su PDF una sola vez. Después, todas las herramientas trabajan sobre ese mismo archivo: agregar texto o una firma, mover páginas, reducir su tamaño o convertirlo a Word. Nada cambia en su archivo hasta que usted lo guarde.',
    steps: [
      {
        title: 'Suelte su archivo en la página de inicio',
        text: 'Arrastre un PDF al recuadro **Suelte un PDF para empezar**, o haga clic en cualquier parte de ese recuadro para elegir uno. También acepta archivos de Word, PowerPoint y Excel, e imágenes: se abren en la herramienta que los convierte en PDF.',
        shot: 1,
        alt: 'El recuadro de la página de inicio donde se suelta un PDF para empezar',
      },
      {
        title: 'Conozca la barra de herramientas',
        text: 'La primera fila trabaja sobre la página que tiene delante: **Texto**, **Editar el texto**, **Dibujar**, **Formas**, **Resaltar**, **Ocultar (recuadro blanco)**, **Recortar** e **Insertar** (una imagen, su firma, la fecha, una marca de agua, números de página, un membrete u otro PDF). La segunda fila trabaja sobre el archivo completo: **Unir**, **Dividir**, **Rotar**, **Eliminar páginas**, **Firmar**, **Marca de agua**, **Números de página**, **Comprimir**, **Convertir** y **Proteger**.',
        shot: 2,
        alt: 'Una carta abierta en BlendPDF, con las dos filas de herramientas arriba y las páginas a la izquierda',
      },
      {
        title: '¿No sabe dónde está algo? Abra “Todas las herramientas”',
        text: '**Todas las herramientas** muestra todo lo que BlendPDF puede hacer con este archivo, agrupado según lo que quiera hacer: cambiar páginas, agregar a las páginas, cambiar el texto existente, obtener otro tipo de archivo o arreglar el archivo. Elija una y se abrirá aquí mismo, sobre el mismo archivo.',
        shot: 3,
        alt: 'El panel Todas las herramientas, con cada herramienta agrupada por tarea',
      },
      {
        title: 'Guarde y elija lo que quiere obtener',
        text: '**Guardar PDF** le entrega el PDF con todos los cambios. **Opciones** muestra todas las posibilidades: un archivo de Word, Excel, imágenes o texto en lugar del PDF, solo algunas páginas, un archivo por página, un archivo más pequeño, una contraseña. La parte inferior de la ventana siempre indica lo que va a obtener antes de descargarlo.',
        shot: 4,
        alt: 'La ventana Guardar su archivo: PDF, Word, Excel, Imágenes, Texto o Imágenes internas, qué páginas y cuántos archivos',
      },
    ],
    tips: [
      {
        title: 'Los cambios se aplican al guardar',
        text: '“Deshacer” y “Rehacer” funcionan en todas las herramientas, y puede guardar tantas veces como quiera mientras sigue trabajando.',
      },
      {
        title: 'Adónde va su archivo',
        text: 'Editar, firmar y organizar páginas se hace en su navegador: el archivo se queda en su dispositivo. Algunas herramientas, como comprimir o leer el texto de un documento escaneado (OCR), usan nuestro servidor, y esos archivos se eliminan en menos de una hora.',
      },
      {
        title: 'En el teléfono',
        text: 'Todo funciona en un teléfono. La página aparece arriba y el panel de la herramienta que eligió se abre debajo.',
      },
    ],
    cta: 'Abrir un PDF',
  },

  'add-letterhead-to-pdf': {
    title: 'Cómo agregar un membrete a un PDF',
    metaTitle: 'Agregar un membrete a un PDF gratis: nombre, logo y pie de página | BlendPDF',
    description:
      'Ponga su nombre, su logo y su dirección en todas las páginas de un PDF, en español, en árabe o en francés. Prepare el membrete una vez, vuelva a usarlo y compártalo con su equipo.',
    summary:
      'Abra el PDF, elija **Insertar** y luego **Membrete**, y complete la parte de arriba a la izquierda, la de arriba a la derecha, el logo y el pie de página. El membrete aparece en la página mientras escribe. BlendPDF lo guarda en su dispositivo, así que la próxima vez se coloca con un solo clic.',
    steps: [
      {
        title: 'Elija “Insertar” y luego “Membrete”',
        text: 'Abra la carta o el informe en la página Editar PDF. En la barra de herramientas, haga clic en **Insertar** y luego en **Membrete**. Se abre un panel junto a la página, o debajo de ella en un teléfono.',
        shot: 1,
        alt: 'El menú Insertar abierto, con Membrete entre Imagen, Firma, Marca de agua y Números de página',
      },
      {
        title: 'Complete los dos lados, el logo y el pie de página',
        text: 'La primera línea de cada lado es su nombre, en letra un poco más grande; las líneas siguientes son sus datos. Muchos membretes llevan el nombre en español a la izquierda y en árabe a la derecha. **Elegir un logo** coloca su logo en el centro. **Pie de página** sirve para la dirección, el teléfono, el correo electrónico o el número de registro.',
        shot: 2,
        alt: 'Una carta con membrete: el nombre en español a la izquierda, en árabe a la derecha, un logo en el centro y una línea fina debajo',
      },
      {
        title: 'Elija las páginas y guarde',
        text: 'Elija **Todas las páginas** o **Solo la primera página** y haga clic en **Guardar PDF**. Si una página tiene texto donde va el membrete, BlendPDF baja un poco el contenido de esa página, y solo lo reduce si no hay otra forma, para que no quede nada cubierto.',
        shot: 3,
        alt: 'El final del panel Membrete: el pie de página, Todas las páginas o Solo la primera página, y Guardar como archivo',
      },
      {
        title: 'Úselo de nuevo o compártalo con su equipo',
        text: 'El membrete se queda en este dispositivo: la próxima vez que elija **Membrete**, se coloca solo. Para usarlo en otro dispositivo o dárselo a un colega, haga clic en **Guardar como archivo** y envíele el archivo; esa persona lo abre con **Abrir un archivo de membrete**.',
      },
    ],
    tips: [
      {
        title: 'Árabe y español en un mismo membrete',
        text: 'Cada lado sigue la dirección de su propio texto, así que el árabe se lee de derecha a izquierda, y en el PDF guardado sigue siendo texto real, que se puede buscar.',
      },
      {
        title: 'Un nombre largo',
        text: 'Pasa a una segunda línea en vez de volverse diminuto. Deje el pie de página en una sola línea: se lee mejor.',
      },
      {
        title: 'Páginas giradas o recortadas',
        text: 'En una página que giró o recortó en el editor, el membrete se dibuja en el margen superior sin mover la página.',
      },
    ],
    cta: 'Agregar un membrete',
  },

  'sign-and-stamp-pdf': {
    title: 'Cómo firmar y sellar un PDF',
    metaTitle: 'Firmar y sellar un PDF en línea gratis: firma y sello de la empresa | BlendPDF',
    description:
      'Dibuje, escriba o suba su firma, agregue una foto de su sello sin el fondo del papel y guarde ambos en su dispositivo para la próxima vez. Gratis, sin registrarse.',
    summary:
      'Abra el PDF, elija **Insertar** y luego **Firma**, y dibuje, escriba o suba su firma o su sello. La foto de un sello pierde el fondo del papel, así que queda sobre la página como si fuera tinta. Marque **Guardarla en este dispositivo para la próxima vez** y en adelante lo tendrá a un solo clic.',
    steps: [
      {
        title: 'Abra la ventana de firma',
        text: 'Abra el PDF, desplácese hasta donde va la firma y elija **Insertar** y **Firma** (o **Firmar** en la segunda fila). Con **Dibujar**, trácela con el cursor o con el dedo; con **Escribir**, escriba su nombre y elija un estilo de firma.',
        shot: 1,
        alt: 'La ventana “Agregue su firma o sello”, con un nombre escrito en letra manuscrita',
      },
      {
        title: 'Agregue su sello a partir de una foto o un escaneo',
        text: 'En la pestaña **Subir**, elija una foto o un escaneo de su sello, o de su firma en papel. BlendPDF quita el fondo de papel que lo rodea, sea blanco o grisáceo como en las fotos tomadas con el teléfono, y conserva el color de la tinta. Marque **Guardarla en este dispositivo para la próxima vez** si lo va a usar otra vez.',
        shot: 2,
        alt: 'Un sello fotografiado en la pestaña Subir, sin el fondo del papel, con la casilla “Guardarla en este dispositivo” marcada',
      },
      {
        title: 'Colóquelo, muévalo y ajuste su tamaño',
        text: 'Haga clic en **Colocar en la página**. Arrástrelo hasta su lugar y arrastre una esquina para cambiar el tamaño. Las teclas de flecha lo mueven de punto en punto; si mantiene presionada la tecla Mayús (Shift), de diez en diez.',
        shot: 3,
        alt: 'Un sello azul colocado en una carta, justo debajo del nombre de la presidenta',
      },
      {
        title: 'La próxima vez: un solo clic',
        text: 'La próxima vez que abra la ventana, lo que guardó aparece arriba, en **Guardada en este dispositivo**. Haga clic en él para colocarlo. La pequeña cruz lo quita de este dispositivo, algo importante si comparte el dispositivo con otras personas en la oficina.',
        shot: 4,
        alt: 'La ventana de firma con un sello guardado en este dispositivo, listo para colocarlo con un clic',
      },
    ],
    tips: [
      {
        title: '¿Tiene validez legal?',
        text: 'Una firma colocada de esta forma es una firma electrónica simple. Sirve para cartas, recibos, certificados y documentos dirigidos al público. Cuando un documento exige una firma certificada o legalizada, use un certificado digital reconocido o el trámite en papel habitual.',
      },
      {
        title: 'No se guarda nada si usted no lo pide',
        text: 'La casilla **Guardarla en este dispositivo para la próxima vez** está desmarcada hasta que usted la marque. Lo que guarde se queda solo en este navegador y nunca se envía a ninguna parte.',
      },
      {
        title: 'Más de una firma',
        text: 'Coloque una firma y luego la siguiente: cada una es un elemento independiente en la página y se puede mover por separado.',
      },
    ],
    cta: 'Firmar un PDF',
  },

  'compress-pdf-under-size-limit': {
    title: 'Cómo reducir un PDF a menos de 2 MB (o a cualquier tamaño máximo)',
    metaTitle: 'Comprimir un PDF a menos de 2 MB, 1 MB o cualquier tamaño máximo, gratis | BlendPDF',
    description:
      'Los formularios en línea suelen rechazar archivos de más de 1, 2 o 5 MB. Escriba el límite y BlendPDF busca la mejor calidad que no lo supere. Funciona con escaneos y con fotos tomadas con el teléfono.',
    summary:
      'Abra el PDF en Comprimir PDF, elija **Por debajo de un tamaño máximo**, escriba el límite que pide el formulario (por ejemplo, 2) y haga clic en **Comprimir PDF**. BlendPDF prueba varios ajustes y se queda con el de mejor aspecto que cumple el límite. Si ninguno lo cumple, le indica cuánto pudo reducirlo.',
    steps: [
      {
        title: 'Elija “Por debajo de un tamaño máximo” y escriba el límite',
        text: 'En Comprimir PDF, elija **Por debajo de un tamaño máximo** y escriba la cantidad de megabytes que admite el formulario, por ejemplo 1 o 2. También acepta decimales: 1,5.',
        shot: 1,
        alt: 'Comprimir PDF con la opción “Por debajo de un tamaño máximo” elegida y un límite de 1 MB',
      },
      {
        title: 'Comprima y revise el nuevo tamaño',
        text: 'Haga clic en **Comprimir PDF**. Unos segundos después verá el nuevo tamaño, por ejemplo “Ahora pesa 138,73 KB, por debajo de su límite de 1 MB”. Descargue el archivo, envíelo por correo electrónico o siga trabajando en él.',
        shot: 2,
        alt: 'Su archivo está listo: el nuevo tamaño, por debajo del límite de 1 MB, y el botón Descargar',
      },
      {
        title: 'Si no se puede bajar del límite',
        text: 'Los escaneos y las fotos se reducen mucho; los archivos que son casi todo texto, mucho menos. Si incluso la versión más pequeña supera el límite, BlendPDF se lo indica y le entrega esa versión. Quite las páginas que no necesite, o divida el archivo en dos partes y envíelas por separado.',
      },
    ],
    tips: [
      {
        title: 'Por qué aquí 1 MB equivale a un millón de bytes',
        text: 'Los formularios en línea cuentan los megabytes de dos maneras distintas. BlendPDF usa el valor más bajo, así que el archivo pasa en ambos casos.',
      },
      {
        title: 'El texto sigue nítido',
        text: 'Solo se aligeran las imágenes que contiene el PDF. El texto sigue siendo texto: se ve nítido y se puede buscar.',
      },
      {
        title: 'Si ya es lo bastante pequeño',
        text: 'Si el archivo ya está por debajo del límite, BlendPDF lo deja exactamente como está.',
      },
    ],
    cta: 'Comprimir un PDF',
  },

  'merge-split-reorder-pages': {
    title: 'Cómo unir, dividir y reordenar las páginas de un PDF',
    metaTitle: 'Unir, dividir, reordenar y eliminar páginas de un PDF, gratis | BlendPDF',
    description:
      'Junte varios PDF en uno, divida un PDF en varios archivos y mueva, gire o elimine páginas arrastrando las miniaturas. Gratis, en su navegador, sin registrarse.',
    summary:
      'Abra su PDF y haga clic en **Todas las páginas** para ver cada página: arrastre una página para moverla y seleccione páginas para girarlas o eliminarlas. Para juntar archivos, use Unir PDF o **Agregar otro PDF**. Para dividir un archivo en varios, use **Dividir** y elija cómo.',
    steps: [
      {
        title: 'Vea todas las páginas y arrástrelas para reordenarlas',
        text: 'Haga clic en **Todas las páginas**, encima de la página. Arrastre una página para moverla. Seleccione una o varias páginas y use **Girar a la izquierda**, **Girar a la derecha** o **Eliminar seleccionadas** para cambiarlas todas a la vez.',
        shot: 1,
        alt: 'Todas las páginas: miniaturas de las cinco páginas de un informe, listas para arrastrarlas a un nuevo orden',
      },
      {
        title: 'Divida un PDF en varios archivos',
        text: 'Abra el PDF en Dividir PDF, o haga clic en **Dividir**. Elija un PDF por página, un PDF cada cierto número de páginas, un PDF por cada rango de páginas seleccionadas o las páginas seleccionadas en un solo PDF. La línea que aparece debajo de las opciones le indica exactamente qué archivos va a obtener.',
        shot: 2,
        alt: 'Dividir PDF con la opción “Un PDF por página” elegida y, debajo, lo que va a obtener: un ZIP con 5 PDF',
      },
      {
        title: 'Una varios PDF en uno solo',
        text: 'En Unir PDF, suelte todos sus archivos a la vez, o abra uno y haga clic en **Agregar otro PDF** para cada uno de los demás. Sus páginas se juntan en una sola lista: arrástrelas al orden que quiera y haga clic en **Unir los PDF**.',
        shot: 3,
        alt: 'Unir PDF con dos archivos juntos en una sola lista de páginas',
      },
    ],
    tips: [
      {
        title: 'Cuántos archivos',
        text: 'Puede unir hasta 20 PDF a la vez, con un máximo de 100 MB en total.',
      },
      {
        title: 'Páginas escaneadas al revés',
        text: 'Gírelas en **Todas las páginas** antes de guardar; el giro queda guardado en el archivo.',
      },
      {
        title: 'Conservar solo algunas páginas',
        text: 'Selecciónelas, abra **Opciones** y elija **Solo las páginas seleccionadas**.',
      },
    ],
    cta: 'Unir PDF',
  },

  'edit-pdf-text': {
    title: 'Cómo agregar o cambiar texto en un PDF',
    metaTitle: 'Agregar o cambiar texto en un PDF, en español o en árabe, gratis | BlendPDF',
    description:
      'Escriba en español, en árabe o en francés en cualquier parte de un PDF, o cambie una línea del texto que ya contiene. Paso a paso, con capturas de pantalla. Gratis, sin registrarse.',
    summary:
      'Para agregar palabras, elija **Texto**, haga clic donde deben ir y escriba. Para cambiar una línea que ya está en el PDF, elija **Editar el texto**, haga clic en la línea y escriba el nuevo texto: BlendPDF quita la línea anterior y escribe la nueva con la fuente más parecida que tiene.',
    steps: [
      {
        title: 'Agregue texto en cualquier parte',
        text: 'Haga clic en **Texto**, luego en el lugar de la página donde van las palabras, y escriba. Puede escribir en español y en árabe, incluso en el mismo cuadro. Arrastre el cuadro para moverlo; el tamaño y el color están en la pequeña barra que aparece encima.',
        shot: 1,
        alt: 'La nota “Recibido el 6 de noviembre de 2026” escrita en un cuadro de texto, en el margen superior de una carta',
      },
      {
        title: 'Cambie una línea que ya está en el PDF',
        text: 'Haga clic en **Editar el texto** y luego en la línea que quiere cambiar. Escriba el nuevo texto en el cuadro que se abre: la página muestra el resultado mientras escribe. Al guardar, la línea anterior se quita de la página, no solo queda cubierta.',
        shot: 2,
        alt: 'Editar el texto: la línea del asunto de una carta pasa a decir “Asunto: solicitud de subvención para 2027 y 2028”, con el cambio ya visible en la página',
      },
      {
        title: 'Guarde',
        text: 'Haga clic en **Guardar PDF**. Puede seguir editando y volver a guardar tantas veces como quiera.',
      },
    ],
    tips: [
      {
        title: 'Si hay que reescribir un párrafo entero',
        text: '**Editar el texto** cambia una línea a la vez. Para cambios más grandes, convierta el PDF a Word, edítelo allí y vuelva a guardarlo como PDF.',
      },
      {
        title: 'Una página escaneada',
        text: 'Las palabras forman parte de una imagen. Tápelas con **Ocultar (recuadro blanco)** y escriba encima con **Texto**, o primero haga que el escaneo se pueda buscar con OCR.',
      },
      {
        title: 'Las fuentes',
        text: 'Cuando la fuente original no tiene alguna de las letras que usted escribió, BlendPDF usa la fuente más parecida que tiene y se lo indica.',
      },
    ],
    cta: 'Editar un PDF',
  },
};
