// Pre-test y pos-test de Inducción general: las mismas preguntas antes y después de ver la
// presentación. No llevan puntaje: basta con responderlas. En el banco la opción correcta
// va primera por referencia; el orden se mezcla al mostrarlas.

export const EVALUACIONES = {
  'pl-gh-001': [
    {
      pregunta: '¿Cuándo inicia el derecho a la desconexión laboral?',
      opciones: [
        'Al terminar la jornada laboral o al iniciar una licencia, permiso o vacaciones',
        'Solo durante los fines de semana',
        'Cuando el jefe inmediato lo autoriza',
        'Después de las 10 de la noche',
      ],
    },
    {
      pregunta: '¿Qué ley regula la desconexión laboral en Colombia?',
      opciones: ['Ley 2191 de 2022', 'Ley 1010 de 2006', 'Ley 1562 de 2012', 'Resolución 0312 de 2019'],
    },
    {
      pregunta: 'Fuera de tu jornada, ¿estás obligado a responder llamadas, mensajes o correos de trabajo?',
      opciones: [
        'No, salvo hechos urgentes, graves, de fuerza mayor o caso fortuito',
        'Sí, siempre que sean del trabajo',
        'Solo los correos electrónicos',
        'Solo si el mensaje es de tu jefe',
      ],
    },
    {
      pregunta: '¿Qué cargos están exentos de la desconexión laboral?',
      opciones: [
        'Los de dirección, confianza y manejo',
        'Los cargos auxiliares',
        'Los practicantes',
        'Ningún cargo está exento',
      ],
    },
    {
      pregunta: 'Si te envían una solicitud después de terminar la jornada, ¿desde cuándo cuenta?',
      opciones: [
        'Desde el inicio del siguiente día hábil',
        'Desde el momento en que se envía',
        'Dos horas después de enviada',
        'Desde el lunes siguiente',
      ],
    },
    {
      pregunta: '¿Ante quién se presenta una queja por no respetar la desconexión laboral?',
      opciones: [
        'Ante Gestión Humana o cualquier miembro del Comité de Convivencia Laboral',
        'Ante la ARL',
        'Ante un compañero de trabajo',
        'No se pueden presentar quejas',
      ],
    },
  ],
  'pl-gh-002': [
    {
      pregunta: '¿Se permite trabajar bajo los efectos del alcohol o de sustancias psicoactivas?',
      opciones: [
        'No, por ningún motivo',
        'Sí, si es en poca cantidad',
        'Solo en turnos nocturnos',
        'Sí, con permiso del jefe',
      ],
    },
    {
      pregunta: '¿Qué está prohibido en las instalaciones durante la jornada laboral?',
      opciones: [
        'Consumir, poseer, distribuir, fabricar o vender alcohol y tabaco',
        'Solo vender alcohol',
        'Solo fumar dentro de las oficinas',
        'Nada, si es lejos del puesto de trabajo',
      ],
    },
    {
      pregunta: '¿Cuál es la única excepción que contempla la política?',
      opciones: [
        'Consumo moderado de alcohol en actividades sociales programadas y aprobadas por la compañía',
        'Celebrar cumpleaños en la oficina con bebidas alcohólicas',
        'Los viernes después de las 4 p. m.',
        'No hay ninguna excepción',
      ],
    },
    {
      pregunta: '¿Cómo se considera el incumplimiento de esta política?',
      opciones: ['Falta grave', 'Falta leve', 'Solo una recomendación', 'No tiene consecuencias'],
    },
    {
      pregunta: '¿Puede la empresa realizar inspecciones para prevenir el consumo o la posesión?',
      opciones: [
        'Sí, sin previo aviso',
        'Solo avisando con una semana de anticipación',
        'No, nunca',
        'Solo acompañada por la Policía',
      ],
    },
    {
      pregunta: '¿Quién es responsable directo de velar por tu bienestar y cuidar tu salud?',
      opciones: ['Tú mismo, como trabajador', 'Solo la empresa', 'Solo la ARL', 'Solo la EPS'],
    },
  ],
  'pl-gh-003': [
    {
      pregunta: '¿Por qué son importantes el orden y el aseo?',
      opciones: [
        'Por la salud, la seguridad y la calidad de vida de los colaboradores',
        'Solo por la imagen de la empresa',
        'Solo para pasar auditorías',
        'No son importantes',
      ],
    },
    {
      pregunta: '¿Cuál de estos es un objetivo de la política de orden y aseo?',
      opciones: [
        'Mantener el puesto de trabajo ordenado',
        'Acumular documentos en el escritorio',
        'Dejar los residuos para el personal de aseo',
        'Usar los recursos sin control',
      ],
    },
    {
      pregunta: '¿En qué caneca van el plástico, el vidrio, el papel y el cartón limpios y secos?',
      opciones: ['Blanca', 'Negra', 'Verde', 'Roja'],
    },
    {
      pregunta: '¿En qué caneca van los restos de comida?',
      opciones: ['Verde', 'Blanca', 'Negra', 'Azul'],
    },
    {
      pregunta: '¿En qué caneca van el papel higiénico y las servilletas usadas?',
      opciones: ['Negra', 'Blanca', 'Verde', 'Amarilla'],
    },
    {
      pregunta: '¿Quién es responsable de cumplir la política de orden y aseo?',
      opciones: [
        'Todos los trabajadores',
        'Solo el personal de aseo',
        'Solo los jefes de área',
        'Solo el área de SST',
      ],
    },
  ],
  'pl-gh-005': [
    {
      pregunta: '¿Qué ley define el acoso laboral en Colombia?',
      opciones: ['Ley 1010 de 2006', 'Ley 2191 de 2022', 'Ley 1562 de 2012', 'Resolución 2184 de 2019'],
    },
    {
      pregunta: 'Según la ley, el acoso laboral es una conducta…',
      opciones: [
        'Persistente y demostrable',
        'Aislada y ocasional',
        'Que siempre viene de un jefe',
        'Que solo ocurre fuera de la empresa',
      ],
    },
    {
      pregunta: 'Asignar funciones con el fin de menospreciar al trabajador es…',
      opciones: ['Inequidad laboral', 'Maltrato laboral', 'Desprotección laboral', 'Entorpecimiento laboral'],
    },
    {
      pregunta: 'Dar un trato diferente por raza, género, origen, credo u opinión política es…',
      opciones: ['Discriminación laboral', 'Persecución laboral', 'Inequidad laboral', 'Desprotección laboral'],
    },
    {
      pregunta: '¿A quiénes aplica el rechazo al acoso laboral?',
      opciones: [
        'A todos, sin importar quién sea la víctima o el ofensor ni su rango',
        'Solo a los jefes',
        'Solo entre compañeros del mismo nivel',
        'Solo a los trabajadores nuevos',
      ],
    },
    {
      pregunta: 'Si vives o presencias acoso laboral, ¿qué debes hacer?',
      opciones: [
        'Registrar los hechos y acudir a Gestión Humana o al Comité de Convivencia Laboral',
        'Ignorarlo para evitar problemas',
        'Publicarlo en redes sociales',
        'Renunciar de inmediato',
      ],
    },
  ],
  'pl-gh-006': [
    {
      pregunta: '¿Qué significa SG-SST?',
      opciones: [
        'Sistema de Gestión de Seguridad y Salud en el Trabajo',
        'Sistema General de Servicios Sociales y Técnicos',
        'Servicio de Gestión de Salud y Seguros de Trabajo',
        'Sistema de Gestión de Sanciones y Trámites',
      ],
    },
    {
      pregunta: '¿A quiénes cubre la política de seguridad y salud en el trabajo?',
      opciones: [
        'A todos los trabajadores, sin importar su forma de contratación o vinculación',
        'Solo a los trabajadores de planta',
        'Solo al personal asistencial',
        'Solo al personal administrativo',
      ],
    },
    {
      pregunta: '¿Cuál es uno de los objetivos de la política?',
      opciones: [
        'Identificar los peligros, evaluar y valorar los riesgos y establecer controles',
        'Eliminar las capacitaciones',
        'Evitar que se reporten los accidentes',
        'Reducir los elementos de protección',
      ],
    },
    {
      pregunta: '¿Cada cuánto se revisa la política de SST?',
      opciones: ['Anualmente', 'Cada cinco años', 'Nunca se revisa', 'Solo cuando hay un accidente'],
    },
    {
      pregunta: '¿Qué recursos aporta SANITHELP IPS SAS para el SG-SST?',
      opciones: [
        'Financieros, tecnológicos y de talento humano',
        'Solo recursos financieros',
        'Ningún recurso',
        'Solo la dotación',
      ],
    },
    {
      pregunta: 'Si identificas un peligro en tu sitio de trabajo, ¿qué debes hacer?',
      opciones: [
        'Informarlo oportunamente',
        'Esperar a que otra persona lo reporte',
        'Ignorarlo si no te afecta',
        'Arreglarlo sin avisar a nadie',
      ],
    },
  ],
}
