// Contenido de las capacitaciones. Cada capacitación es una presentación de diapositivas.
// Tipos de diapositiva: portada, contenido, tarjetas, pasos, comparacion, imagen, colores, tabla, cierre.
// La API también lo usa para saber el título y la fecha de cada capacitación al registrar asistencias y evaluaciones.
// El orden sigue el cronograma de capacitaciones.

import { foto } from './fotos.js';
import { emergencias, estilosVida, fundamentos, inspecciones, investigacion, riesgoBiologico } from './capacitacionesNuevas.js';
import { agua, energia, huellaCarbono, plagas } from './capacitacionesAmbientales.js';
import { importadas } from './capacitacionesImportadas.js';
import { retiradas } from './capacitacionesRetiradas.js';

const iniciales = [
  // ───────────────────────────── VIGÍA SST ─────────────────────────────
  {
    id: 'vigia-sst',
    titulo: 'Funciones y responsabilidades del Vigía SST',
    resumen: 'Qué es el SG-SST, cuál es el papel del Vigía y cómo actuar frente a una situación de riesgo.',
    categoria: 'Seguridad y Salud en el Trabajo',
    duracion: '2 horas',
    facilitador: 'Responsable SG-SST',
    fechaProgramada: '2026-05-11',
    fechaEjecucion: '2026-05-11',
    portada: foto('vigia-dialogo.jpg', 'Trabajador conversando con un compañero sobre seguridad'),
    diapositivas: [
      {
        tipo: 'portada',
        etiqueta: 'Capacitación SST',
        titulo: 'Funciones y responsabilidades del Vigía SST',
        subtitulo: 'Marco general del Sistema de Gestión de Seguridad y Salud en el Trabajo',
        imagen: foto('vigia-dialogo.jpg', 'Trabajador conversando con un compañero sobre seguridad'),
        datos: ['SanitHelp IPS', 'Prevenir · Participar · Mejorar'],
      },
      {
        tipo: 'contenido',
        etiqueta: 'Contexto',
        titulo: '¿Qué es el SG-SST?',
        intro:
          'El Sistema de Gestión de Seguridad y Salud en el Trabajo es un proceso lógico y por etapas, basado en la mejora continua, que busca anticipar, reconocer, evaluar y controlar los riesgos que pueden afectar la seguridad y la salud de las personas en el trabajo.',
        puntos: [
          { t: 'Es obligatorio', d: 'Todas las empresas en Colombia deben implementarlo (Decreto 1072 de 2015).' },
          { t: 'Tiene estándares mínimos', d: 'La Resolución 0312 de 2019 define qué debe cumplir cada empresa según su tamaño y riesgo.' },
          { t: 'Es participativo', d: 'Los trabajadores participan y se comunican a través del Vigía SST o del COPASST.' },
        ],
        imagen: foto('fundamentos-senalizacion.jpg', 'Tablero de señales de seguridad: peligro, prohibición y uso obligatorio de EPP'),
      },
      {
        tipo: 'pasos',
        etiqueta: 'Ciclo PHVA',
        titulo: 'Las etapas del SG-SST',
        intro: 'El sistema funciona como un ciclo que nunca termina: planear, hacer, verificar y actuar.',
        items: [
          { titulo: 'Política y organización', texto: 'Compromiso de la gerencia, objetivos y responsables definidos.' },
          { titulo: 'Planificación', texto: 'Identificar peligros, evaluar riesgos y definir el plan de trabajo anual.' },
          { titulo: 'Aplicación', texto: 'Ejecutar controles, capacitaciones, inspecciones y planes de emergencia.' },
          { titulo: 'Evaluación', texto: 'Medir con indicadores si las acciones están funcionando.' },
          { titulo: 'Auditoría', texto: 'Revisar el cumplimiento del sistema al menos una vez al año.' },
          { titulo: 'Mejora', texto: 'Corregir lo que falla y prevenir que vuelva a ocurrir.' },
        ],
      },
      {
        tipo: 'contenido',
        etiqueta: 'Rol',
        titulo: '¿Quién es el Vigía SST?',
        intro:
          'Es el trabajador que representa la participación activa de sus compañeros en la prevención. En las empresas con menos de 10 trabajadores cumple las funciones que en empresas más grandes realiza el COPASST.',
        puntos: [
          { t: 'Escucha y canaliza', d: 'Recibe observaciones, inquietudes y propuestas de los trabajadores sobre seguridad y salud.' },
          { t: 'Observa y propone', d: 'Apoya la identificación de condiciones inseguras y propone medidas de prevención al empleador.' },
          { t: 'Participa y hace seguimiento', d: 'Acompaña capacitaciones, inspecciones y el cierre de las acciones del SG-SST.' },
        ],
        nota: 'El Vigía no reemplaza al responsable del SG-SST: actúa como apoyo y canal de participación.',
      },
      {
        tipo: 'tarjetas',
        etiqueta: 'Funciones',
        titulo: 'Funciones principales del Vigía SST',
        intro: 'Acciones prácticas que debe impulsar y acompañar en el día a día.',
        items: [
          { icono: 'idea', titulo: 'Proponer medidas', texto: 'Promover acciones que mantengan ambientes de trabajo seguros y saludables.' },
          { icono: 'libro', titulo: 'Participar en capacitación', texto: 'Apoyar y participar en las actividades de formación y prevención.' },
          { icono: 'ojo', titulo: 'Vigilar actividades', texto: 'Hacer seguimiento a que los controles de seguridad se cumplan.' },
          { icono: 'buscar', titulo: 'Apoyar investigaciones', texto: 'Participar en el análisis de incidentes y accidentes de trabajo (Res. 1401 de 2007).' },
          { icono: 'lista', titulo: 'Inspeccionar', texto: 'Visitar las áreas, identificar condiciones de riesgo y comunicar los hallazgos.' },
          { icono: 'usuarios', titulo: 'Promover la participación', texto: 'Motivar a los compañeros a reportar riesgos, incidentes y mejoras.' },
        ],
      },
      {
        tipo: 'contenido',
        etiqueta: 'En la práctica',
        titulo: 'Las inspecciones de seguridad',
        intro: 'Una inspección es un recorrido planeado para encontrar condiciones que podrían causar un accidente antes de que ocurra.',
        puntos: [
          'Use una lista de chequeo para no olvidar ningún aspecto.',
          'Revise extintores, botiquines, rutas de evacuación y señalización.',
          'Observe orden y aseo, pisos, cableado, iluminación y almacenamiento.',
          'Pregunte a quienes trabajan en el área: ellos conocen los riesgos reales.',
          'Registre lo encontrado con fecha, lugar y, si es seguro, una foto.',
        ],
      },
      {
        tipo: 'pasos',
        etiqueta: 'Ruta de actuación',
        titulo: '¿Qué hacer cuando se identifica un riesgo?',
        items: [
          { titulo: 'Detectar', texto: 'Observar la condición o recibir el reporte de un compañero.' },
          { titulo: 'Registrar', texto: 'Dejar evidencia clara del hallazgo: qué, dónde y cuándo.' },
          { titulo: 'Comunicar', texto: 'Informar al responsable del SG-SST o al empleador.' },
          { titulo: 'Proponer', texto: 'Sugerir acciones de prevención o control.' },
          { titulo: 'Verificar', texto: 'Hacer seguimiento hasta el cierre y comprobar que la medida funcionó.' },
        ],
        nota: 'El Vigía facilita la comunicación y el seguimiento; las decisiones y los recursos corresponden al empleador.',
      },
      {
        tipo: 'comparacion',
        etiqueta: 'Responsabilidades',
        titulo: 'Cada uno tiene un papel',
        columnas: [
          {
            letra: 'E',
            titulo: 'Empleador',
            texto: 'Responsable del SG-SST.',
            ejemplos: ['Asigna recursos y responsables.', 'Define la política de SST.', 'Toma las decisiones de control.'],
          },
          {
            letra: 'V',
            titulo: 'Vigía SST',
            texto: 'Canal de participación.',
            ejemplos: ['Escucha a los trabajadores.', 'Inspecciona y propone mejoras.', 'Hace seguimiento a las acciones.'],
          },
          {
            letra: 'T',
            titulo: 'Trabajadores',
            texto: 'Protagonistas del autocuidado.',
            ejemplos: ['Cumplen normas y procedimientos.', 'Usan sus elementos de protección.', 'Reportan peligros e incidentes.'],
          },
        ],
      },
      {
        tipo: 'contenido',
        etiqueta: 'Evidencias',
        titulo: 'Evidencias de la capacitación',
        intro: 'Todo lo que se hace en el SG-SST debe quedar soportado.',
        puntos: [
          { t: 'Asistencia', d: 'Nombre, apellido, correo y firma. Se registra en el menú Asistencia de este aplicativo.' },
          { t: 'Evaluación', d: 'Un cuestionario corto para verificar la comprensión del tema.' },
          { t: 'Material de apoyo', d: 'Esta presentación queda disponible para consulta en cualquier momento.' },
        ],
      },
      {
        tipo: 'tabla',
        etiqueta: 'Marco legal',
        titulo: 'Normas que respaldan el trabajo del Vigía',
        cabeceras: ['Norma', 'Qué establece'],
        filas: [
          ['Decreto 1072 de 2015', 'Decreto Único del Sector Trabajo: reúne la reglamentación del SG-SST y las obligaciones de empleadores y trabajadores.'],
          ['Resolución 0312 de 2019', 'Estándares mínimos del SG-SST; las empresas con menos de 10 trabajadores cuentan con Vigía SST en lugar de COPASST.'],
          ['Resolución 2013 de 1986', 'Organización y funcionamiento de los comités de seguridad y salud (hoy COPASST y Vigía).'],
          ['Resolución 1401 de 2007', 'Investigación de incidentes y accidentes de trabajo, con participación del COPASST o del Vigía.'],
        ],
      },
      {
        tipo: 'tarjetas',
        etiqueta: 'Perfil',
        titulo: 'Cualidades de un buen Vigía SST',
        intro: 'El Vigía es elegido con participación de los trabajadores, ejerce por un periodo de 2 años y el empleador le facilita tiempo dentro de la jornada para sus funciones.',
        items: [
          { icono: 'ojo', titulo: 'Observador', texto: 'Nota los cambios en el área, los atajos inseguros y las condiciones que se deterioran.' },
          { icono: 'usuarios', titulo: 'Cercano', texto: 'Genera confianza para que los compañeros reporten sin miedo.' },
          { icono: 'balanza', titulo: 'Imparcial', texto: 'Busca causas y soluciones, no culpables.' },
          { icono: 'libro', titulo: 'En formación', texto: 'Se capacita en SG-SST y comparte lo que aprende.' },
        ],
      },
      {
        tipo: 'tabla',
        etiqueta: 'Caso práctico',
        titulo: '¿Qué haría el Vigía?',
        cabeceras: ['Situación', 'Actuación del Vigía'],
        filas: [
          ['Un compañero comenta que el piso del baño siempre queda mojado y alguien casi se cae.', 'Registrar la condición, informarla al responsable del SG-SST, proponer señalización y secado, y verificar que se corrija.'],
          ['Durante una inspección encuentra un extintor con la fecha de recarga vencida.', 'Anotarlo en la lista de chequeo con foto, reportarlo y hacer seguimiento hasta la recarga.'],
          ['Ocurre un pinchazo con aguja en toma de muestras.', 'Verificar que se activó la atención inmediata y el reporte a la ARL, y participar en la investigación del evento.'],
        ],
      },
      {
        tipo: 'tabla',
        etiqueta: 'En nuestra IPS',
        titulo: '¿Qué observa el Vigía en cada área?',
        intro: 'En una IPS de consulta externa y toma de muestras, cada área tiene peligros propios que conviene revisar con frecuencia.',
        cabeceras: ['Área', 'Qué observar'],
        filas: [
          ['Toma de muestras', 'Guardianes no sobrellenados, uso de guantes y bata, kit de derrames disponible y lavamanos con jabón y toallas.'],
          ['Consultorios', 'Silla y escritorio adecuados, iluminación suficiente, cables ordenados y camilla en buen estado.'],
          ['Recepción y sala de espera', 'Pausas activas, trato con usuarios difíciles, pisos secos y circulación despejada.'],
          ['Residuos', 'Bolsas del color correcto, recipientes tapados y almacenamiento temporal limpio y señalizado.'],
          ['Emergencias', 'Extintores vigentes y accesibles, botiquín completo, rutas de evacuación libres y señalizadas.'],
        ],
        nota: 'El Vigía no necesita ser experto en todo: su fortaleza es observar, preguntar a los compañeros y reportar a tiempo.',
      },
      {
        tipo: 'tarjetas',
        etiqueta: 'Límites del rol',
        titulo: 'Lo que el Vigía SST no hace',
        intro: 'Conocer los límites del rol evita confusiones con compañeros y directivos.',
        items: [
          { icono: 'balanza', titulo: 'No sanciona', texto: 'No impone castigos ni llamados de atención; su papel es preventivo y de participación.' },
          { icono: 'escudo', titulo: 'No reemplaza al responsable', texto: 'La implementación del SG-SST la coordina el responsable designado y la lidera el empleador.' },
          { icono: 'grafico', titulo: 'No decide recursos', texto: 'Propone medidas, pero la asignación de presupuesto y las decisiones corresponden al empleador.' },
          { icono: 'usuarios', titulo: 'No atiende acoso laboral', texto: 'Las quejas de convivencia y acoso laboral se tramitan ante el Comité de Convivencia Laboral, no ante el Vigía.' },
        ],
        nota: 'El Vigía sí puede orientar a un compañero sobre a quién acudir en cada caso.',
      },
      {
        tipo: 'comparacion',
        etiqueta: 'Buenas prácticas',
        titulo: 'Errores frecuentes y cómo evitarlos',
        intro: 'Pequeños hábitos hacen la diferencia entre un Vigía de papel y un Vigía que previene.',
        columnas: [
          { letra: '✗', titulo: 'Errores frecuentes', texto: 'Lo que debilita el rol.', ejemplos: ['Reportar solo de palabra, sin dejar registro.', 'Hacer inspecciones sin lista de chequeo.', 'No volver a revisar si el hallazgo se corrigió.', 'Reunirse solo cuando hay un accidente.'] },
          { letra: '✓', titulo: 'Buenas prácticas', texto: 'Lo que fortalece el rol.', ejemplos: ['Registrar cada hallazgo con fecha y lugar.', 'Usar siempre el mismo formato de inspección.', 'Hacer seguimiento hasta el cierre con evidencia.', 'Reunirse con regularidad; la Res. 2013 de 1986 pide al COPASST hacerlo al menos una vez al mes.'] },
        ],
      },
      {
        tipo: 'cierre',
        titulo: 'Prevenir también es escuchar, observar, reportar y hacer seguimiento',
        texto: 'Gracias por ser parte de una cultura de seguridad en SanitHelp.',
      },
    ],
  },

  // ─────────────────── IDENTIFICACIÓN DE PELIGROS ───────────────────
  {
    id: 'identificacion-peligros',
    titulo: 'Identificación de peligros y evaluación de riesgos',
    resumen: 'Diferencia entre peligro y riesgo, cómo evaluarlos, jerarquía de controles y reporte de actos y condiciones inseguras.',
    categoria: 'Seguridad y Salud en el Trabajo',
    duracion: '4 horas',
    facilitador: 'ARL SURA',
    fechaProgramada: '2026-07-10',
    fechaEjecucion: '2026-07-10',
    portada: foto('piso-mojado.jpg', 'Aviso de precaución por piso mojado'),
    diapositivas: [
      {
        tipo: 'portada',
        etiqueta: 'Capacitación SST',
        titulo: 'Identificación de peligros y evaluación de riesgos',
        subtitulo: 'Reporte de actos y condiciones inseguras',
        imagen: foto('piso-mojado.jpg', 'Aviso de precaución por piso mojado'),
        datos: ['SanitHelp IPS', 'Identificar → Evaluar → Controlar'],
      },
      {
        tipo: 'comparacion',
        etiqueta: 'Conceptos',
        titulo: 'Peligro y riesgo no son lo mismo',
        intro: 'Reconocer la diferencia ayuda a decidir qué controlar primero.',
        columnas: [
          {
            letra: '!',
            titulo: 'Peligro',
            texto: 'Fuente, situación o acto con capacidad de causar daño a las personas, los equipos o el ambiente.',
            ejemplos: ['Un cable atravesando una zona de paso.', 'Una superficie mojada.', 'Una aguja sin desechar.'],
          },
          {
            letra: 'R',
            titulo: 'Riesgo',
            texto: 'Combinación de la probabilidad de que ocurra un evento y la gravedad de sus consecuencias.',
            ejemplos: ['Tropezar con el cable y caer.', 'Resbalar y sufrir una fractura.', 'Pincharse y contraer una infección.'],
          },
        ],
        nota: 'Pregunta clave: ¿qué podría pasar, con qué probabilidad y qué tan grave sería?',
      },
      {
        tipo: 'tarjetas',
        etiqueta: 'GTC 45',
        titulo: 'Tipos de peligro en una IPS',
        intro: 'La Guía Técnica Colombiana GTC 45 clasifica los peligros. Estos son los más comunes en nuestro trabajo:',
        items: [
          { icono: 'virus', titulo: 'Biológico', texto: 'Virus, bacterias y hongos: contacto con sangre, fluidos y pinchazos.' },
          { icono: 'postura', titulo: 'Biomecánico', texto: 'Posturas prolongadas, movimientos repetitivos y movilización de pacientes.' },
          { icono: 'cerebro', titulo: 'Psicosocial', texto: 'Carga de trabajo, atención al público, jornadas extensas y estrés.' },
          { icono: 'quimico', titulo: 'Químico', texto: 'Desinfectantes, hipoclorito, alcohol y medicamentos.' },
          { icono: 'rayo', titulo: 'Condiciones de seguridad', texto: 'Eléctrico, locativo (pisos, escaleras), mecánico y riesgo público.' },
          { icono: 'sol', titulo: 'Físico y fenómenos naturales', texto: 'Ruido, iluminación, temperatura, sismos e inundaciones.' },
        ],
      },
      {
        tipo: 'pasos',
        etiqueta: 'Identificación',
        titulo: '¿Cómo identificar peligros?',
        intro: 'Observe la tarea real: personas, ambiente, equipos, materiales y organización del trabajo.',
        items: [
          { titulo: 'Observar', texto: 'Recorra el área y mire cómo se hace realmente la tarea.' },
          { titulo: 'Preguntar', texto: 'Escuche a quienes ejecutan la actividad y conocen sus dificultades.' },
          { titulo: 'Registrar', texto: 'Anote el peligro, dónde está, quién se expone y qué podría ocurrir.' },
          { titulo: 'Actualizar', texto: 'Revise cada vez que cambien procesos, instalaciones o equipos.' },
        ],
        nota: 'La identificación incluye actividades rutinarias y no rutinarias, y la participación de todos los niveles de la empresa.',
      },
      {
        tipo: 'tabla',
        etiqueta: 'Evaluación',
        titulo: 'Evaluar el riesgo para priorizar',
        intro: 'No todos los peligros tienen la misma urgencia. Se valoran según su probabilidad y sus consecuencias, y el resultado indica qué atender primero.',
        cabeceras: ['Nivel de riesgo', 'Significado', '¿Qué hacer?'],
        filas: [
          ['I · Crítico', 'No aceptable', 'Suspender la actividad hasta controlar el riesgo.'],
          ['II · Alto', 'No aceptable o aceptable con control específico', 'Corregir y adoptar medidas de control de inmediato.'],
          ['III · Medio', 'Mejorable', 'Mejorar los controles existentes cuando sea posible.'],
          ['IV · Bajo', 'Aceptable', 'Mantener los controles y vigilar.'],
        ],
        colores: ['#c53030', '#dd6b20', '#d69e2e', '#2f855a'],
      },
      {
        tipo: 'tarjetas',
        etiqueta: 'Control',
        titulo: 'Jerarquía de controles',
        intro: 'Las medidas se aplican en este orden, de la más eficaz a la menos eficaz (Decreto 1072 de 2015).',
        numerado: true,
        items: [
          { icono: 'x', titulo: 'Eliminar', texto: 'Quitar el peligro por completo. Ej.: retirar un equipo dañado.' },
          { icono: 'cambio', titulo: 'Sustituir', texto: 'Reemplazar por algo menos peligroso. Ej.: un desinfectante menos tóxico.' },
          { icono: 'herramienta', titulo: 'Controles de ingeniería', texto: 'Aislar el peligro. Ej.: canaletas para cables, guardianes de seguridad.' },
          { icono: 'lista', titulo: 'Controles administrativos', texto: 'Procedimientos, señalización, pausas activas y capacitación.' },
          { icono: 'escudo', titulo: 'Elementos de protección personal', texto: 'Guantes, tapabocas, gafas, bata. Son la última barrera.' },
        ],
      },
      {
        tipo: 'contenido',
        etiqueta: 'Actos inseguros',
        titulo: 'Acto inseguro',
        intro: 'Es una conducta o acción de una persona que se aparta de la práctica segura y aumenta la posibilidad de un accidente.',
        puntos: [
          'No usar el elemento de protección personal requerido.',
          'Re-enfundar agujas o desechar cortopunzantes en la bolsa equivocada.',
          'Manipular equipos sin autorización o sin capacitación.',
          'Omitir un procedimiento de seguridad por "ganar tiempo".',
          'Trabajar en alturas sin sistema de protección contra caídas.',
        ],
        imagen: foto('acto-inseguro-alturas.jpg', 'Trabajadores en altura sin protección contra caídas'),
      },
      {
        tipo: 'contenido',
        etiqueta: 'Condiciones inseguras',
        titulo: 'Condición insegura',
        intro: 'Es el estado del ambiente, la instalación o el equipo que puede favorecer que ocurra un evento no deseado.',
        puntos: [
          'Piso mojado sin señalización.',
          'Cableado deteriorado, expuesto o desordenado.',
          'Pasillos y rutas de evacuación obstruidos.',
          'Iluminación deficiente o tomas eléctricas sobrecargadas.',
          'Extintores vencidos o botiquines incompletos.',
        ],
        nota: 'No se trata de culpar: se trata de identificar, reportar y corregir.',
        imagen: foto('cableado-desordenado.jpg', 'Cableado desordenado y expuesto en el piso'),
      },
      {
        tipo: 'contenido',
        etiqueta: 'Autocuidado',
        titulo: 'Los EPP: la última barrera',
        intro: 'Los elementos de protección personal no eliminan el peligro, pero reducen la gravedad de las lesiones cuando se usan bien.',
        puntos: [
          'Use el EPP indicado para cada tarea y verifique que esté en buen estado.',
          'Póngaselo antes de exponerse y retírelo sin contaminarse.',
          'No comparta elementos de uso personal.',
          'Reporte cuando un EPP esté dañado o no esté disponible.',
        ],
      },
      {
        tipo: 'pasos',
        etiqueta: 'Reporte',
        titulo: '¿Cómo reportar?',
        intro: 'El reporte oportuno permite actuar antes de que ocurra un incidente o accidente.',
        items: [
          { titulo: 'Reportar', texto: 'Informe el acto o la condición insegura al responsable del SG-SST o al Vigía.' },
          { titulo: 'Describir', texto: 'Indique lugar, tarea, peligro observado y posible consecuencia.' },
          { titulo: 'Documentar', texto: 'Adjunte evidencia cuando sea seguro hacerlo, sin exponer a nadie.' },
          { titulo: 'Hacer seguimiento', texto: 'Verifique que se definan acciones y que el control sea efectivo.' },
        ],
      },
      {
        tipo: 'contenido',
        etiqueta: 'Herramienta',
        titulo: 'La matriz de peligros (GTC 45)',
        intro: 'En Colombia, la Guía Técnica Colombiana GTC 45 es la referencia más usada para identificar peligros y valorar riesgos. El resultado es la matriz de peligros de la empresa.',
        puntos: [
          { t: 'Proceso y actividad', d: 'Dónde ocurre y qué tarea se hace (rutinaria o no rutinaria).' },
          { t: 'Peligro y efecto posible', d: 'Qué puede causar daño y qué lesión o enfermedad podría producir.' },
          { t: 'Controles existentes', d: 'Qué se hace hoy en la fuente, en el medio y en la persona.' },
          { t: 'Valoración', d: 'Nivel de riesgo y si es aceptable o no.' },
          { t: 'Medidas de intervención', d: 'Qué controles adicionales se implementarán, con responsable y fecha.' },
        ],
        nota: 'La matriz se actualiza al menos una vez al año y cada vez que cambian procesos, instalaciones o equipos, o después de un accidente.',
      },
      {
        tipo: 'tabla',
        etiqueta: 'Caso práctico',
        titulo: 'Identifique el peligro y el control',
        cabeceras: ['Situación en la IPS', 'Peligro', 'Control adecuado'],
        filas: [
          ['La auxiliar reencapsula la aguja después de tomar una muestra.', 'Biológico (pinchazo)', 'No reencapsular; descartar de inmediato en el guardián.'],
          ['La recepcionista pasa 8 horas sentada sin pausas.', 'Biomecánico', 'Pausas activas y ajuste del puesto de trabajo.'],
          ['Una extensión eléctrica cruza el pasillo de la sala de espera.', 'Condición de seguridad (locativo y eléctrico)', 'Retirarla o canalizar el cable fuera del paso.'],
          ['Se mezcla hipoclorito con otro producto de limpieza.', 'Químico', 'No mezclar productos; seguir la etiqueta y la FDS.'],
        ],
      },
      {
        tipo: 'tabla',
        etiqueta: 'Por área',
        titulo: 'Peligros frecuentes en cada área de la IPS',
        intro: 'Ejemplos generales para orientar la observación; la matriz de peligros de la empresa es la referencia oficial.',
        cabeceras: ['Área', 'Peligros principales', 'Controles típicos'],
        filas: [
          ['Toma de muestras', 'Biológico (pinchazos, salpicaduras de sangre), biomecánico (posturas).', 'Guardián a la mano, no reencapsular, guantes, bata, vacunación y silla adecuada.'],
          ['Consultorios y medicina laboral', 'Biomecánico (computador, postura sentada), biológico (contacto con pacientes).', 'Puesto ajustado, pausas activas, higiene de manos y elementos de bioseguridad.'],
          ['Recepción y facturación', 'Psicosocial (atención al público, carga de trabajo), biomecánico.', 'Pausas, protocolo para usuarios agresivos, apoyo del líder y puesto ergonómico.'],
          ['Aseo y residuos', 'Químico (desinfectantes), biológico, locativo (pisos húmedos).', 'Fichas de seguridad, rotulado, guantes, señalización de piso mojado.'],
        ],
      },
      {
        tipo: 'tarjetas',
        etiqueta: 'Actualización',
        titulo: '¿Cuándo se actualiza la identificación de peligros?',
        intro: 'El Decreto 1072 de 2015 pide revisarla como mínimo una vez al año y cada vez que algo cambie.',
        items: [
          { icono: 'calendario', titulo: 'Cada año', texto: 'Revisión periódica de la matriz, aunque no haya ocurrido ningún evento.' },
          { icono: 'cambio', titulo: 'Cuando hay cambios', texto: 'Nuevos servicios, equipos, instalaciones, procesos o sustancias.' },
          { icono: 'alerta', titulo: 'Después de un evento grave', texto: 'Tras un accidente mortal o un evento catastrófico se revisa de inmediato.' },
          { icono: 'buscar', titulo: 'Con nuevos hallazgos', texto: 'Cuando inspecciones, investigaciones o reportes muestran peligros que no estaban registrados.' },
        ],
      },
      {
        tipo: 'contenido',
        etiqueta: 'Errores frecuentes',
        titulo: 'Errores comunes al identificar peligros',
        puntos: [
          { t: 'Mirar solo lo visible', d: 'Se ven los cables y el piso mojado, pero se olvida el peligro psicosocial o la carga postural.' },
          { t: 'Ignorar tareas no rutinarias', d: 'Limpiar un derrame de sangre o cambiar un guardián lleno también tiene peligros.' },
          { t: 'Normalizar el riesgo', d: '“Siempre lo hemos hecho así” no significa que sea seguro.' },
          { t: 'Saltar directo al EPP', d: 'Antes de pensar en guantes o tapabocas, pregunte si el peligro se puede eliminar o controlar en la fuente.' },
          { t: 'No preguntar a quien hace la tarea', d: 'La persona que realiza el trabajo conoce dificultades que no se ven en un recorrido.' },
        ],
      },
      {
        tipo: 'cierre',
        titulo: 'Detectar antes, reportar a tiempo y controlar de forma efectiva',
        texto: 'Prevenir es observar, reportar y actuar. Gracias por cuidarse y cuidar a los demás.',
      },
    ],
  }
];

const [vigia, peligros] = iniciales;

// Orden: primero las destacadas (PRIMERO); luego el cronograma: 1 Vigía, 2 Fundamentos, 3 Peligros, 4 Investigación,
// 5 Inspecciones, 6 Riesgo biológico; luego las demás, las de Ambiente y Recursos y las importadas desde CAPACITACIONES/
const PRIMERO = ['pgirasa'];
// Las de las primeras cuyo archivo se borró (capacitacionesRetiradas.js) no se muestran; las importadas que se borran se eliminan del todo
const primeras = [vigia, fundamentos, peligros, investigacion, inspecciones, riesgoBiologico, emergencias, estilosVida, plagas, energia, agua, huellaCarbono];
const orden = [...primeras.filter((c) => !retiradas.includes(c.id)), ...importadas];
export const capacitaciones = [
  ...PRIMERO.map((id) => orden.find((c) => c.id === id)).filter(Boolean),
  ...orden.filter((c) => !PRIMERO.includes(c.id)),
];

export const buscarCapacitacion = (id) => capacitaciones.find((c) => c.id === id);
