// Contenido de las diapositivas de Inducción general, resumido de las políticas de la carpeta PL.
// Cada presentación se convierte en public/induccion-general/<archivo> con `npm run build:diapositivas`.
// Tipos de diapositiva: portada, mensaje, definicion, tarjetas, lista, pasos, normas, servicios, documento, cierre.
// Las diapositivas con "Referencia:" citan la norma colombiana de la que sale el contenido.

const FIRMA = { nombre: 'Ingrid Natalia Tovar', cargo: 'Representante Legal' }

const OBJETIVOS_SST = [
  { icono: 'Scale', titulo: 'Cumplir la norma', texto: 'Cumplir con la normatividad nacional vigente aplicable en materia de riesgos laborales.' },
  { icono: 'Search', titulo: 'Identificar y controlar', texto: 'Identificar los peligros, evaluar y valorar los riesgos y establecer los respectivos controles.' },
  { icono: 'HeartPulse', titulo: 'Proteger a todos', texto: 'Proteger la seguridad y salud de los trabajadores con promoción y prevención de accidentes, lesiones y enfermedades laborales.' },
  { icono: 'RefreshCw', titulo: 'Mejora continua', texto: 'Aplicar la mejora continua del Sistema de Gestión en Seguridad y Salud en el Trabajo (SG-SST) a todos los requisitos.' },
]

const SERVICIOS_SANITHELP = {
  tipo: 'servicios',
  kicker: 'Nuestro compromiso',
  titulo: 'Cuidamos la salud de otros, empezando por la nuestra',
  texto: 'SANITHELP IPS SAS, empresa dedicada al cuidado de la salud, declara su compromiso con la implementación del Sistema de Gestión en Seguridad y Salud en el Trabajo (SG-SST) para gestionar todos los riesgos laborales de sus actividades.',
  servicios: [
    { icono: 'Stethoscope', texto: 'Consulta laboral' },
    { icono: 'Activity', texto: 'Medicina general' },
    { icono: 'House', texto: 'Salud en casa' },
    { icono: 'GraduationCap', texto: 'Educación en salud' },
  ],
  nota: 'Alcance: todos los trabajadores, independiente de su forma de contratación o vinculación.',
}

const RECURSOS_SST = (imagen) => ({
  tipo: 'lista',
  kicker: 'Cómo se cumple',
  titulo: 'Recursos, revisión y divulgación',
  imagen,
  items: [
    { titulo: 'Recursos', texto: 'SANITHELP IPS SAS aporta los recursos financieros, tecnológicos y de talento humano necesarios para planear y evaluar el SG-SST.' },
    { titulo: 'Revisión anual', texto: 'La política se revisa cada año y se actualiza cuando hay cambios en materia de seguridad y salud en el trabajo.' },
    { titulo: 'Divulgación', texto: 'Se divulga a todos los niveles de la organización.' },
    { titulo: 'Acceso para todos', texto: 'Está disponible para todos los trabajadores y partes interesadas en todos los centros de trabajo.' },
  ],
})

const GESTION_RIESGOS_SST = {
  tipo: 'pasos',
  kicker: 'Gestión de riesgos',
  titulo: 'Cómo gestionamos los riesgos laborales',
  pasos: [
    { titulo: 'Identificar', texto: 'Reconocer los peligros presentes en cada actividad y centro de trabajo.' },
    { titulo: 'Evaluar y valorar', texto: 'Determinar qué tan grave y probable es cada riesgo.' },
    { titulo: 'Controlar', texto: 'Establecer los controles para eliminar o reducir cada riesgo.' },
    { titulo: 'Mejorar', texto: 'Revisar resultados y aplicar la mejora continua del SG-SST.' },
  ],
  nota: 'Incluye actividades de promoción y prevención para evitar accidentes, lesiones personales y enfermedades laborales.',
}

const RESPONSABILIDADES_SST = {
  tipo: 'tarjetas',
  kicker: 'Tu papel en el SG-SST',
  titulo: 'Responsabilidades de cada trabajador',
  tarjetas: [
    { icono: 'HeartPulse', titulo: 'Cuida tu salud', texto: 'Procura el cuidado integral de tu salud.' },
    { icono: 'FileText', titulo: 'Informa tu estado de salud', texto: 'Suministra información clara, veraz y completa sobre tu estado de salud.' },
    { icono: 'ClipboardCheck', titulo: 'Cumple las normas', texto: 'Sigue las normas, reglamentos e instrucciones del SG-SST.' },
    { icono: 'TriangleAlert', titulo: 'Reporta peligros', texto: 'Informa oportunamente los peligros y riesgos latentes en tu sitio de trabajo.' },
    { icono: 'GraduationCap', titulo: 'Capacítate', texto: 'Participa en las actividades de capacitación en seguridad y salud en el trabajo.' },
    { icono: 'Users', titulo: 'Participa', texto: 'Contribuye al cumplimiento de los objetivos del SG-SST.' },
  ],
  nota: 'Referencia: Decreto 1072 de 2015, artículo 2.2.4.6.10.',
}

const MARCO_LEGAL_SST = {
  tipo: 'normas',
  kicker: 'Marco legal de referencia',
  titulo: 'Normas que orientan el SG-SST',
  normas: [
    'Decreto Ley 1295 de 1994 · Sistema General de Riesgos Profesionales',
    'Ley 1562 de 2012 · Sistema General de Riesgos Laborales',
    'Decreto 1072 de 2015 · Decreto Único Reglamentario del Sector Trabajo',
    'Resolución 0312 de 2019 · Estándares mínimos del SG-SST',
  ],
}

export const PRESENTACIONES = [
  {
    archivo: 'PL-GH-001-politica-desconexion-laboral.pdf',
    codigo: 'PL-GH-001',
    titulo: 'Política de desconexión laboral',
    diapositivas: [
      {
        tipo: 'portada',
        imagen: 'desconexion-tiempo-en-familia.jpg',
        subtitulo: 'Tu tiempo de descanso, tu vida personal y familiar también se respetan.',
        datos: [['Versión', '01'], ['Vigente desde', '23 jul 2023'], ['Marco legal', 'Ley 2191 de 2022']],
      },
      {
        tipo: 'mensaje',
        kicker: '¿Qué es la desconexión laboral?',
        imagen: 'desconexion-vacaciones.jpg',
        frase: 'Es tu derecho a disfrutar plenamente del descanso, las licencias, los permisos, las vacaciones y tu vida personal y familiar.',
        texto: 'De acuerdo con la Ley 2191 de 2022, SANITHELP IPS SAS garantiza este derecho, que inicia una vez finaliza la jornada laboral. Su ejercicio también responde a la naturaleza de cada cargo.',
      },
      {
        tipo: 'tarjetas',
        kicker: 'Lineamientos',
        titulo: '¿Cómo funciona?',
        tarjetas: [
          { icono: 'Clock', titulo: 'Inicia al terminar la jornada', texto: 'O al empezar el periodo de licencia, permiso o vacaciones.' },
          { icono: 'Users', titulo: 'Tiempo para los tuyos', texto: 'Disfruta de descansos, licencias, permisos y vacaciones con tu familia, amigos y esparcimiento personal.' },
          { icono: 'BellOff', titulo: 'Sin obligación de responder', texto: 'No estás obligado a atender llamadas, mensajes o correos, salvo hechos urgentes, graves, de fuerza mayor o caso fortuito.' },
          { icono: 'Briefcase', titulo: 'Excepciones', texto: 'Los cargos de dirección, confianza y manejo están exentos (art. 162 del C.S.T.).' },
        ],
      },
      {
        tipo: 'tarjetas',
        kicker: 'Principios',
        titulo: '¿En qué se basa esta política?',
        tarjetas: [
          { icono: 'Landmark', titulo: 'La Constitución', texto: 'Se orienta por los principios constitucionales del derecho al trabajo.' },
          { icono: 'Globe', titulo: 'Convenios de la OIT', texto: 'Respeta los convenios ratificados por la Organización Internacional del Trabajo.' },
          { icono: 'Scale', titulo: 'Ley 2191 de 2022', texto: 'Aplica la ley de desconexión laboral y toda la normatividad relacionada.' },
        ],
      },
      {
        tipo: 'tarjetas',
        kicker: 'Excepciones',
        titulo: '¿Cuándo sí se puede requerir a un colaborador?',
        tarjetas: [
          { icono: 'Siren', titulo: 'Urgencia o gravedad', texto: 'Hechos urgentes o graves que afecten el buen funcionamiento de la institución.' },
          { icono: 'CloudLightning', titulo: 'Fuerza mayor o caso fortuito', texto: 'Situaciones imprevistas que exigen deberes extra de colaboración.' },
          { icono: 'Activity', titulo: 'Continuidad del servicio', texto: 'Cuando es necesario para no interrumpir el servicio, justificando que no hay otra alternativa viable.' },
          { icono: 'Briefcase', titulo: 'Dirección, confianza y manejo', texto: 'Estos cargos están exentos de la jornada máxima legal (art. 162 del C.S.T.).' },
        ],
      },
      {
        tipo: 'lista',
        kicker: 'Medidas de SANITHELP',
        titulo: 'Cómo lo garantizamos',
        imagen: 'desconexion-portatil.jpg',
        items: [
          { titulo: 'Jefes y líderes', texto: 'No pueden solicitar requerimientos, servicios o actividades por fuera de la jornada.' },
          { titulo: 'Colaboradores', texto: 'No atienden requerimientos fuera de la jornada, salvo fuerza mayor o caso fortuito sin otra alternativa viable.' },
          { titulo: 'Mensajes y correos', texto: 'Se envían en lo posible durante la jornada; los enviados después cuentan desde el siguiente día hábil.' },
          { titulo: 'Reuniones', texto: 'No se programan fuera del horario, ni presenciales ni por videollamada, para quienes no son de manejo y confianza.' },
          { titulo: 'Horas extras', texto: 'Todo trabajo suplementario, dominical o festivo debe estar autorizado por la institución.' },
        ],
      },
      {
        tipo: 'tarjetas',
        kicker: 'Quejas',
        titulo: '¿Sientes que no se respetó tu desconexión?',
        tarjetas: [
          { icono: 'UserCheck', titulo: '¿Quién puede presentarla?', texto: 'Todos los colaboradores, excepto los cargos de dirección, confianza y manejo.' },
          { icono: 'Mail', titulo: '¿Cómo?', texto: 'Por escrito, en documento físico o por correo electrónico, narrando con claridad tiempo, modo y lugar de los hechos.' },
          { icono: 'Building2', titulo: '¿Ante quién?', texto: 'Ante el área de Gestión Humana o cualquier miembro del Comité de Convivencia Laboral.' },
        ],
      },
      {
        tipo: 'pasos',
        kicker: 'Trámite de la queja',
        titulo: 'Un proceso confidencial, efectivo y conciliatorio',
        pasos: [
          { titulo: 'Evaluación', texto: 'Gestión Humana evalúa los hechos dentro de los 10 días hábiles siguientes.' },
          { titulo: 'Aclaración', texto: 'Puede pedirte ampliar la queja; si no se completa, se archiva y puedes presentarla de nuevo.' },
          { titulo: 'Defensa', texto: 'Se corre traslado al querellado para que ejerza su defensa y aporte pruebas.' },
          { titulo: 'Conciliación', texto: 'Se escucha a las partes y se buscan soluciones negociadas.' },
          { titulo: 'Decisión y seguimiento', texto: 'Se comunica por escrito y se hace seguimiento al plan de mejoramiento.' },
          { titulo: 'Revisión', texto: 'Si no estás conforme, objeta por escrito ante el Comité de Convivencia Laboral dentro de 3 días hábiles.' },
        ],
        nota: 'Si la queja constituye además una falta disciplinaria, podrá iniciarse el proceso sancionatorio correspondiente.',
      },
      {
        tipo: 'tarjetas',
        kicker: 'Responsables',
        titulo: '¿Quién participa en el trámite?',
        tarjetas: [
          { icono: 'User', titulo: 'Colaborador', texto: 'Presenta la queja por escrito o por correo electrónico.' },
          { icono: 'UserCog', titulo: 'Coordinador de Gestión Humana', texto: 'Evalúa la queja, escucha a las partes, emite concepto y hace seguimiento.' },
          { icono: 'Gavel', titulo: 'Abogada', texto: 'Apoya la evaluación y, si hay falta disciplinaria, el proceso sancionatorio.' },
          { icono: 'Users', titulo: 'Comité de Convivencia Laboral', texto: 'Revisa el caso cuando el colaborador no está conforme con la decisión.' },
          { icono: 'Building2', titulo: 'Gerencia', texto: 'Recibe la decisión cuando el caso lo requiere y participa en ella.' },
        ],
      },
      {
        tipo: 'tarjetas',
        kicker: 'Tus garantías',
        titulo: 'Lo que asegura el procedimiento',
        tarjetas: [
          { icono: 'Lock', titulo: 'Confidencialidad', texto: 'La queja se maneja de forma confidencial.' },
          { icono: 'ShieldCheck', titulo: 'Derecho de defensa', texto: 'Ambas partes pueden presentar su versión y sus pruebas.' },
          { icono: 'Handshake', titulo: 'Conciliación', texto: 'Se buscan primero soluciones negociadas para un buen ambiente laboral.' },
          { icono: 'RotateCcw', titulo: 'Segunda revisión', texto: 'Puedes pedir que el Comité de Convivencia Laboral revise la decisión.' },
        ],
      },
      {
        tipo: 'cierre',
        imagen: 'desconexion-familia.jpg',
        titulo: 'Desconectarte también es cuidarte',
        texto: 'La política rige desde el 23 de julio de 2023, incluye las disposiciones de la Ley 2191 de 2022 y se publica en un lugar visible para todos los colaboradores.',
        firma: FIRMA,
      },
    ],
  },
  {
    archivo: 'PL-GH-002-politica-alcohol-y-no-drogas.pdf',
    codigo: 'PL-GH-002',
    titulo: 'Política de alcohol y no drogas',
    diapositivas: [
      {
        tipo: 'portada',
        imagen: 'alcohol-rechazo.jpg',
        subtitulo: 'Prevención del consumo de alcohol, drogas y tabaco para un trabajo sano y seguro.',
        datos: [['Versión', '00'], ['Vigente desde', '23 nov 2021'], ['Aplica a', 'Todos los trabajadores']],
      },
      {
        tipo: 'mensaje',
        kicker: '¿Por qué esta política?',
        imagen: 'alcohol-licor.jpg',
        frase: 'El alcohol, las drogas y el tabaco afectan la salud y la capacidad para desempeñarnos de forma adecuada.',
        texto: 'Crean riesgos para la integridad, la eficiencia y la productividad. Por eso SANITHELP IPS SAS fomenta el bienestar y un ambiente de trabajo sano y seguro para todos.',
      },
      {
        tipo: 'tarjetas',
        kicker: 'Riesgos del consumo',
        titulo: '¿Qué se pone en riesgo?',
        tarjetas: [
          { icono: 'HeartPulse', titulo: 'Tu salud', texto: 'El consumo tiene efectos adversos en la salud física y mental.' },
          { icono: 'ShieldAlert', titulo: 'Tu integridad', texto: 'Aumenta los riesgos para ti y para quienes trabajan contigo.' },
          { icono: 'Gauge', titulo: 'La eficiencia', texto: 'Disminuye la capacidad para desempeñarse de forma adecuada.' },
          { icono: 'TrendingDown', titulo: 'La productividad', texto: 'Afecta la calidad del trabajo y la imagen de la empresa.' },
        ],
      },
      {
        tipo: 'tarjetas',
        kicker: 'Objetivos',
        titulo: 'Lo que buscamos',
        tarjetas: [
          { icono: 'ShieldCheck', titulo: 'Ambientes libres', texto: 'Lograr ambientes de trabajo libres de alcohol, drogas y tabaco.' },
          { icono: 'HardHat', titulo: 'Procesos seguros', texto: 'Eliminar los riesgos que el consumo puede generar al colaborador en la ejecución de su labor.' },
          { icono: 'Brain', titulo: 'Conciencia', texto: 'Concientizar sobre los efectos nocivos físicos, psicológicos y sociales de estas sustancias.' },
          { icono: 'ClipboardCheck', titulo: 'Inspecciones', texto: 'Realizar inspecciones sin previo aviso para prevenir el consumo o la posesión en los lugares de trabajo.' },
        ],
      },
      {
        tipo: 'tarjetas',
        kicker: 'Prohibiciones',
        titulo: 'En las instalaciones, durante la jornada, está prohibido',
        tarjetas: [
          { icono: 'Wine', titulo: 'Consumir', texto: 'Alcohol y tabaco en cualquiera de sus presentaciones.' },
          { icono: 'Package', titulo: 'Poseer', texto: 'Tener alcohol, drogas o tabaco en el lugar de trabajo.' },
          { icono: 'Share2', titulo: 'Distribuir', texto: 'Entregar o repartir estas sustancias a otras personas.' },
          { icono: 'FlaskConical', titulo: 'Fabricar', texto: 'Elaborar cualquiera de estas sustancias.' },
          { icono: 'CircleDollarSign', titulo: 'Vender', texto: 'Comercializar estas sustancias dentro de la empresa.' },
        ],
      },
      {
        tipo: 'lista',
        kicker: 'De obligatorio cumplimiento',
        titulo: 'Reglas para todos',
        imagen: 'alcohol-libre-de-humo.jpg',
        items: [
          { titulo: 'Cero efectos al trabajar', texto: 'Por ningún motivo se permite laborar bajo los efectos de bebidas alcohólicas o sustancias psicoactivas.' },
          { titulo: 'Prohibido en las instalaciones', texto: 'Consumo, posesión, distribución, fabricación o venta de alcohol y tabaco durante la jornada laboral.' },
          { titulo: 'Autocuidado', texto: 'Cada trabajador es responsable directo de velar por su bienestar y cuidar su salud.' },
          { titulo: 'Única excepción', texto: 'Consumo moderado de alcohol en actividades sociales programadas y aprobadas por la compañía.' },
        ],
        alerta: 'Su incumplimiento se considera falta grave.',
      },
      {
        tipo: 'normas',
        kicker: 'Marco legal',
        titulo: 'Esta política se apoya en',
        normas: [
          'Resolución 1075 de 1992',
          'Artículo 348 del Código Sustantivo del Trabajo',
          'Decreto 614 de 1984',
          'Resolución 4225 de 1992 (Ministerio de Salud)',
          'Decreto 2400 de 1979',
          'Decreto Ley 1295 de 1994',
          'Resolución 543 de 1993',
          'Acuerdo 79 de 2003',
          'Resolución 1956 de 2008',
          'Circular 038 de 2010',
        ],
      },
      {
        tipo: 'tarjetas',
        kicker: 'Control y consecuencias',
        titulo: 'Cómo se verifica el cumplimiento',
        tarjetas: [
          { icono: 'ClipboardCheck', titulo: 'Inspecciones sin aviso', texto: 'Se pueden realizar en cualquier momento para prevenir el consumo o la posesión.' },
          { icono: 'TriangleAlert', titulo: 'Falta grave', texto: 'Incumplir esta política se considera falta grave de las responsabilidades contraídas.' },
          { icono: 'Users', titulo: 'Para todos', texto: 'Es de obligatorio cumplimiento para empleador, empleados y partes interesadas.' },
        ],
      },
      {
        tipo: 'cierre',
        imagen: 'alcohol-vida-sana.jpg',
        titulo: 'Una vida saludable empieza por ti',
        texto: 'SANITHELP IPS SAS fomenta campañas de estilo de vida saludable sobre los efectos de estas sustancias, incluyendo al núcleo familiar de cada colaborador. Cumplir esta política es responsabilidad de todos.',
        firma: FIRMA,
      },
    ],
  },
  {
    archivo: 'PL-GH-003-politica-orden-y-aseo.pdf',
    codigo: 'PL-GH-003',
    titulo: 'Política de orden y aseo',
    diapositivas: [
      {
        tipo: 'portada',
        imagen: 'aseo-pasillo-clinica.jpg',
        subtitulo: 'Un entorno limpio y ordenado protege la salud, la seguridad y la calidad de vida.',
        datos: [['Versión', '00'], ['Vigente desde', '23 nov 2021'], ['Aplica a', 'Todos los trabajadores']],
      },
      {
        tipo: 'mensaje',
        kicker: 'Nuestro compromiso',
        imagen: 'aseo-limpieza.jpg',
        frase: 'El orden y el aseo son una cultura que construimos entre todos.',
        texto: 'SANITHELP IPS SAS promueve el trabajo cooperativo y la participación responsable de cada colaborador en el cuidado de los equipos, las instalaciones y el medio ambiente.',
      },
      {
        tipo: 'tarjetas',
        kicker: '¿Por qué importa?',
        titulo: 'El orden y el aseo protegen lo más importante',
        tarjetas: [
          { icono: 'HeartPulse', titulo: 'La salud', texto: 'Un entorno limpio ayuda a cuidar la salud de todos los colaboradores.' },
          { icono: 'ShieldCheck', titulo: 'La seguridad', texto: 'Un espacio ordenado reduce los riesgos en el trabajo.' },
          { icono: 'Smile', titulo: 'La calidad de vida', texto: 'Trabajar en un lugar grato mejora el bienestar de cada día.' },
        ],
      },
      {
        tipo: 'lista',
        kicker: 'Objetivos',
        titulo: 'Lo que buscamos',
        imagen: 'aseo-reciclaje.jpg',
        items: [
          { titulo: 'Ambiente grato y seguro', texto: 'Crear un ambiente de trabajo agradable y seguro para todos.' },
          { titulo: 'Puesto ordenado', texto: 'Mantener el puesto de trabajo en orden.' },
          { titulo: 'Reciclaje', texto: 'Fomentar el reciclaje y la clasificación de residuos.' },
          { titulo: 'Buen uso de recursos', texto: 'Usar bien los recursos asignados para mantener las instalaciones limpias y ordenadas.' },
        ],
      },
      {
        tipo: 'tarjetas',
        kicker: 'Clasificación de residuos',
        titulo: 'Usa la caneca correcta',
        tarjetas: [
          { icono: 'Recycle', titulo: 'Blanca · Aprovechables', texto: 'Plástico, vidrio, metales, papel y cartón limpios y secos.', color: '#eef2f5', colorIcono: '#17325b' },
          { icono: 'Trash2', titulo: 'Negra · No aprovechables', texto: 'Papel higiénico, servilletas y papeles o cartones sucios.', color: '#1f2937' },
          { icono: 'Leaf', titulo: 'Verde · Orgánicos', texto: 'Restos de comida y residuos de poda o jardín.', color: '#2f8f4e' },
        ],
        nota: 'Referencia: Resolución 2184 de 2019. Los residuos con riesgo biológico se manejan según los protocolos de la IPS.',
      },
      {
        tipo: 'tarjetas',
        kicker: 'Tu papel',
        titulo: 'Así participas en el orden y el aseo',
        tarjetas: [
          { icono: 'Monitor', titulo: 'Cuida los equipos', texto: 'Usa y conserva en buen estado los equipos asignados.' },
          { icono: 'Building2', titulo: 'Cuida las instalaciones', texto: 'Mantén limpios y ordenados los espacios que usas.' },
          { icono: 'Leaf', titulo: 'Cuida el ambiente', texto: 'Recicla y clasifica los residuos en la fuente.' },
          { icono: 'Users', titulo: 'Trabaja en equipo', texto: 'Participa con responsabilidad en las jornadas de orden y aseo.' },
        ],
      },
      {
        tipo: 'cierre',
        imagen: 'aseo-habitacion-clinica.jpg',
        titulo: 'Cuidar nuestro espacio es cuidarnos',
        texto: 'SANITHELP IPS SAS fomenta y promueve jornadas de orden y aseo en todos los procesos. Cumplir esta política y sus normas es responsabilidad de todos los trabajadores.',
        firma: FIRMA,
      },
    ],
  },
  {
    archivo: 'PL-GH-005-politica-acoso-laboral.pdf',
    codigo: 'PL-GH-005',
    titulo: 'Política de prevención del acoso laboral',
    diapositivas: [
      {
        tipo: 'portada',
        imagen: 'acoso-no-bullying.jpg',
        subtitulo: 'Un ambiente de trabajo sano, seguro y digno para todas las personas.',
        datos: [['Versión', '00'], ['Vigente desde', '23 nov 2021'], ['Aplica a', 'Todos los trabajadores']],
      },
      {
        tipo: 'mensaje',
        kicker: 'Nuestro propósito',
        imagen: 'acoso-manos.jpg',
        frase: 'Promovemos un ambiente de trabajo que erradique el acoso laboral.',
        texto: 'SANITHELP IPS SAS busca un ambiente sano, seguro y adecuado para quienes trabajan en la organización, con la participación de cada trabajador desde su responsabilidad.',
      },
      {
        tipo: 'definicion',
        kicker: 'Definición',
        titulo: '¿Qué es el acoso laboral?',
        frase: 'Toda conducta persistente y demostrable, ejercida sobre un trabajador por parte de un empleador, un jefe, un compañero de trabajo o un subalterno, encaminada a infundir miedo, intimidación, terror y angustia, a causar perjuicio laboral, generar desmotivación en el trabajo o inducir la renuncia.',
        nota: 'Referencia: Ley 1010 de 2006, artículo 2.',
      },
      {
        tipo: 'tarjetas',
        kicker: 'Modalidades',
        titulo: '¿Cómo se puede presentar?',
        tarjetas: [
          { icono: 'Frown', titulo: 'Maltrato laboral', texto: 'Violencia contra la integridad física o moral, o expresiones injuriosas o ultrajantes.' },
          { icono: 'Crosshair', titulo: 'Persecución laboral', texto: 'Conductas reiteradas y arbitrarias que buscan inducir la renuncia.' },
          { icono: 'UserX', titulo: 'Discriminación laboral', texto: 'Trato diferenciado por raza, género, origen, credo, opinión política o situación social.' },
          { icono: 'Ban', titulo: 'Entorpecimiento laboral', texto: 'Obstaculizar el trabajo o hacerlo más difícil, como privar de insumos o información.' },
          { icono: 'Scale', titulo: 'Inequidad laboral', texto: 'Asignar funciones con el fin de menospreciar al trabajador.' },
          { icono: 'ShieldOff', titulo: 'Desprotección laboral', texto: 'Poner en riesgo la integridad del trabajador con órdenes sin protección mínima.' },
        ],
        nota: 'Referencia: Ley 1010 de 2006, artículo 2.',
      },
      {
        tipo: 'tarjetas',
        kicker: 'Principios',
        titulo: 'Lo que defendemos',
        tarjetas: [
          { icono: 'Shield', titulo: 'Entorno libre', texto: 'Todos tenemos derecho a trabajar sin discriminación ni conductas de hostigamiento, limitación o alteración.' },
          { icono: 'HeartHandshake', titulo: 'Trato digno', texto: 'La empresa previene y erradica el acoso; todos colaboramos con el plan de prevención.' },
          { icono: 'Smile', titulo: 'Sana convivencia', texto: 'Protegemos la intimidad, la honra, la salud mental y la libertad de las personas.' },
          { icono: 'Target', titulo: 'Prevención', texto: 'La prevención del acoso se integra a los sistemas de gestión de la empresa.' },
          { icono: 'Gavel', titulo: 'Consecuencias', texto: 'Quien incurra en hostigamiento será investigado y sujeto a medidas disciplinarias.' },
        ],
      },
      {
        tipo: 'mensaje',
        kicker: 'Tolerancia cero',
        imagen: 'acoso-alto.jpg',
        frase: 'Se rechaza de raíz el acoso laboral en todas sus modalidades y formas.',
        texto: 'Sin importar quién sea la víctima o el ofensor, ni su rango jerárquico. Los responsables de cada proceso fomentan la exclusión de cualquier hostigamiento, tanto al dirigir equipos como en la relación entre compañeros.',
      },
      {
        tipo: 'pasos',
        kicker: '¿Qué puedes hacer?',
        titulo: 'Si vives o presencias acoso laboral',
        pasos: [
          { titulo: 'Reconócelo', texto: 'Identifica si la conducta es persistente y encaja en alguna modalidad.' },
          { titulo: 'Registra', texto: 'Anota fechas, lugares, hechos y posibles testigos.' },
          { titulo: 'Informa', texto: 'Acude a Gestión Humana o al Comité de Convivencia Laboral.' },
          { titulo: 'Participa', texto: 'Colabora en la búsqueda de soluciones y en el plan de prevención.' },
        ],
        nota: 'Ninguna persona está por encima de esta política: aplica sin importar el rango jerárquico de la víctima o del ofensor.',
      },
      {
        tipo: 'cierre',
        imagen: 'acoso-equipo-respeto.jpg',
        titulo: 'El respeto nos hace mejor equipo',
        texto: 'Esta política se publica, divulga y actualiza cada vez que la organización lo considere pertinente, y está disponible para todas las partes interesadas.',
        firma: FIRMA,
      },
    ],
  },
  {
    archivo: 'PL-GH-006-politica-seguridad-y-salud-en-el-trabajo.pdf',
    codigo: 'PL-GH-006',
    titulo: 'Política de seguridad y salud en el trabajo',
    diapositivas: [
      {
        tipo: 'portada',
        imagen: 'sst-cuidado.jpg',
        subtitulo: 'Sistema de Gestión en Seguridad y Salud en el Trabajo (SG-SST).',
        datos: [['Versión', '01'], ['Vigente desde', '23 nov 2021'], ['Aplica a', 'Todos los trabajadores']],
      },
      { ...SERVICIOS_SANITHELP },
      { tipo: 'tarjetas', kicker: 'Objetivos', titulo: 'Lo que nos proponemos', tarjetas: OBJETIVOS_SST },
      GESTION_RIESGOS_SST,
      RESPONSABILIDADES_SST,
      RECURSOS_SST('sst-botiquin.jpg'),
      MARCO_LEGAL_SST,
      {
        tipo: 'cierre',
        imagen: 'sst-epp.jpg',
        titulo: 'La seguridad la construimos todos',
        texto: 'Conoce los riesgos de tu labor, aplica los controles y participa en las actividades de promoción y prevención del SG-SST.',
        firma: FIRMA,
      },
    ],
  },
  {
    archivo: 'politica-seguridad-y-salud-en-el-trabajo.pdf',
    codigo: 'R-SST-01',
    titulo: 'Política de seguridad y salud en el trabajo',
    diapositivas: [
      {
        tipo: 'portada',
        imagen: 'sst-laboratorio.jpg',
        subtitulo: 'Sistema de Gestión en Seguridad y Salud en el Trabajo (SG-SST).',
        datos: [['Versión', '00'], ['Aprobada', '26 feb 2021'], ['Aplica a', 'Todos los trabajadores']],
      },
      { ...SERVICIOS_SANITHELP },
      { tipo: 'tarjetas', kicker: 'Objetivos', titulo: 'Lo que nos proponemos', tarjetas: OBJETIVOS_SST },
      GESTION_RIESGOS_SST,
      RESPONSABILIDADES_SST,
      RECURSOS_SST('sst-recursos-salud.jpg'),
      MARCO_LEGAL_SST,
      {
        tipo: 'documento',
        kicker: 'Control del documento',
        titulo: 'Aprobación y cambios',
        responsables: [
          ['Elaboró', 'Encargado del SG-SST', '03/01/2021'],
          ['Revisó', 'Ingrid Natalia Tovar · Representante Legal', '03/01/2021'],
          ['Aprobó', 'Ingrid Natalia Tovar · Representante Legal', '03/01/2021'],
        ],
        cambios: [
          ['Documento inicial', '00', '26/02/2021'],
          ['Revisión', '01', '03/01/2023'],
        ],
      },
      {
        tipo: 'cierre',
        imagen: 'sst-lavado-manos.jpg',
        titulo: 'La seguridad la construimos todos',
        texto: 'Conoce los riesgos de tu labor, aplica los controles y participa en las actividades de promoción y prevención del SG-SST.',
        firma: FIRMA,
      },
    ],
  },
]
