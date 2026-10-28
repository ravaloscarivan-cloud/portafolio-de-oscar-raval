// Evaluaciones de las capacitaciones fijas: 5 preguntas de pre-test y 5 distintas de post-test, sobre el tema.
// Las del Vigía SST y Fundamentos del SG-SST incluyen los cuestionarios oficiales de SanitHelp.
// Viven solo en el servidor para que las respuestas correctas no lleguen al navegador.
// "correcta" es el índice de la opción correcta.
// Las de las capacitaciones agregadas automáticamente desde CAPACITACIONES/ están en evaluacionesImportadas.js.

import { evaluacionesImportadas } from './evaluacionesImportadas.js';

const propias = {
  "vigia-sst": {
    "pre": [
      {
        "pregunta": "¿Cuál describe mejor el SG-SST?",
        "opciones": [
          "Un registro exclusivo de accidentes de trabajo.",
          "Un proceso lógico y por etapas basado en la mejora continua para gestionar los riesgos en SST.",
          "Un programa aplicado únicamente cuando ocurre una emergencia.",
          "Una actividad exclusiva de la ARL."
        ],
        "correcta": 1
      },
      {
        "pregunta": "¿Cuál es una función propia del Vigía SST?",
        "opciones": [
          "Proponer medidas de prevención y promover la participación de los trabajadores.",
          "Autorizar sanciones disciplinarias a los trabajadores.",
          "Reemplazar al responsable del SG-SST en todas sus funciones.",
          "Definir de manera independiente el presupuesto de la empresa."
        ],
        "correcta": 0
      },
      {
        "pregunta": "Si el Vigía identifica una condición insegura, ¿qué debe hacer?",
        "opciones": [
          "Ignorarla si todavía no ha ocurrido un accidente.",
          "Corregirla personalmente aunque no tenga autorización ni competencia técnica.",
          "Esperar hasta la siguiente auditoría para informarla.",
          "Reportarla, comunicarla al responsable correspondiente y hacer seguimiento a las acciones."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Cuál afirmación es correcta sobre el Vigía y el responsable del SG-SST?",
        "opciones": [
          "El Vigía sustituye al responsable del SG-SST.",
          "Ambos cargos tienen exactamente las mismas obligaciones administrativas.",
          "El Vigía actúa como apoyo y canal de participación; no reemplaza al responsable del SG-SST.",
          "El responsable del SG-SST no debe recibir reportes del Vigía."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿Qué evidencias deben conservarse de esta capacitación?",
        "opciones": [
          "Únicamente la presentación utilizada.",
          "Asistencia, evaluación y material de apoyo utilizado en la capacitación.",
          "Solo el registro de asistencia.",
          "Ninguna, si la capacitación fue corta."
        ],
        "correcta": 1
      }
    ],
    "post": [
      {
        "pregunta": "¿Qué norma colombiana reúne la regulación del SG-SST y obliga a todas las empresas a implementarlo?",
        "opciones": [
          "El Decreto 1072 de 2015",
          "La Resolución 2184 de 2019",
          "La Ley 100 de 1993",
          "El Decreto 780 de 2016"
        ],
        "correcta": 0
      },
      {
        "pregunta": "¿Qué define la Resolución 0312 de 2019?",
        "opciones": [
          "El código de colores para residuos",
          "El horario laboral de los trabajadores",
          "Las tarifas de las ARL",
          "Los estándares mínimos que debe cumplir cada empresa en el SG-SST"
        ],
        "correcta": 3
      },
      {
        "pregunta": "En el ciclo PHVA del SG-SST, ¿qué se hace en la etapa de \"Verificar\"?",
        "opciones": [
          "Comprar elementos de protección personal",
          "Contratar al responsable del SG-SST",
          "Medir con indicadores y auditorías si las acciones están funcionando",
          "Redactar el reglamento interno"
        ],
        "correcta": 2
      },
      {
        "pregunta": "Durante una inspección de seguridad, el Vigía debe:",
        "opciones": [
          "Revisar solo los documentos de la oficina",
          "Usar una lista de chequeo, observar el área, preguntar a quienes trabajan allí y registrar lo encontrado",
          "Esperar a que los trabajadores reporten por su cuenta",
          "Corregir él mismo todas las condiciones que encuentre"
        ],
        "correcta": 1
      },
      {
        "pregunta": "¿Qué evidencias deben quedar de una capacitación?",
        "opciones": [
          "Registro de asistencia, evaluación y material de apoyo",
          "Solo una foto del grupo",
          "Ninguna, basta con que se haya dictado",
          "Únicamente la presentación"
        ],
        "correcta": 0
      }
    ]
  },
  "fundamentos-sg-sst": {
    "pre": [
      {
        "pregunta": "¿Cuál describe mejor al SG-SST?",
        "opciones": [
          "Un archivo de documentos legales.",
          "Una actividad exclusiva de la ARL.",
          "Un programa únicamente para investigar accidentes.",
          "Un proceso por etapas basado en mejora continua para gestionar riesgos."
        ],
        "correcta": 3
      },
      {
        "pregunta": "En el ciclo PHVA, ¿qué corresponde a \"Verificar\"?",
        "opciones": [
          "Definir únicamente la política de SST.",
          "Comprar elementos de protección personal.",
          "Medir resultados, revisar indicadores y auditar.",
          "Contratar personal nuevo."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿De qué depende la exigencia de los Estándares Mínimos?",
        "opciones": [
          "Solo de la ciudad donde opera la empresa.",
          "Del número de trabajadores y la clase de riesgo.",
          "Solo del cargo del gerente.",
          "Únicamente de la antigüedad de la empresa."
        ],
        "correcta": 1
      },
      {
        "pregunta": "Si la autoevaluación obtiene un puntaje menor al 60%, la valoración es:",
        "opciones": [
          "Crítica.",
          "Aceptable.",
          "Moderadamente aceptable.",
          "No requiere seguimiento."
        ],
        "correcta": 0
      },
      {
        "pregunta": "¿Cuál conducta del trabajador fortalece directamente el SG-SST?",
        "opciones": [
          "Omitir una condición insegura para evitar retrasos.",
          "Esperar que SST identifique todos los riesgos.",
          "Cumplir controles solo cuando hay auditoría.",
          "Participar y reportar peligros o incidentes oportunamente."
        ],
        "correcta": 3
      }
    ],
    "post": [
      {
        "pregunta": "¿Qué norma define los Estándares Mínimos del SG-SST?",
        "opciones": [
          "La Resolución 2184 de 2019.",
          "La Resolución 1401 de 2007.",
          "La Resolución 0312 de 2019.",
          "El Decreto 780 de 2016."
        ],
        "correcta": 2
      },
      {
        "pregunta": "Una empresa de 30 trabajadores con clase de riesgo IV o V debe aplicar:",
        "opciones": [
          "Los estándares del Capítulo I.",
          "Los estándares del Capítulo III.",
          "Los estándares del Capítulo II.",
          "Ningún estándar, por ser pequeña."
        ],
        "correcta": 1
      },
      {
        "pregunta": "Con un puntaje entre 60% y 85% en la autoevaluación, la empresa debe:",
        "opciones": [
          "Hacer un plan de mejoramiento y reportar avances a la ARL en máximo 6 meses.",
          "No hacer nada, es aceptable.",
          "Cerrar sus operaciones.",
          "Repetir la autoevaluación al día siguiente."
        ],
        "correcta": 0
      },
      {
        "pregunta": "¿Qué responsabilidad corresponde al empleador en el SG-SST?",
        "opciones": [
          "Solo firmar los documentos de la ARL.",
          "Delegar toda la responsabilidad en los trabajadores.",
          "Atender únicamente los accidentes graves.",
          "Definir la política, los objetivos y los recursos del sistema."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Cuál es la \"regla de oro\" de las evidencias del SG-SST?",
        "opciones": [
          "Tener muchos documentos archivados.",
          "Guardar solo las fotos de las actividades.",
          "Evidencia fechada, con responsable y con trazabilidad del cierre.",
          "Presentar las evidencias únicamente en la auditoría."
        ],
        "correcta": 2
      }
    ]
  },
  "identificacion-peligros": {
    "pre": [
      {
        "pregunta": "¿Cuál es la diferencia entre peligro y riesgo?",
        "opciones": [
          "Son lo mismo",
          "El peligro es la fuente que puede causar daño; el riesgo combina la probabilidad de que ocurra y la gravedad de sus consecuencias",
          "El riesgo es la fuente del daño y el peligro es la probabilidad",
          "El peligro solo existe cuando ya ocurrió un accidente"
        ],
        "correcta": 1
      },
      {
        "pregunta": "Un piso mojado sin señalización es un ejemplo de:",
        "opciones": [
          "Condición insegura",
          "Acto inseguro",
          "Elemento de protección personal",
          "Riesgo aceptable"
        ],
        "correcta": 0
      },
      {
        "pregunta": "No usar el elemento de protección personal requerido para una tarea es un ejemplo de:",
        "opciones": [
          "Condición insegura",
          "Control de ingeniería",
          "Peligro natural",
          "Acto inseguro"
        ],
        "correcta": 3
      },
      {
        "pregunta": "Según la jerarquía de controles, ¿cuál es la medida más eficaz?",
        "opciones": [
          "Entregar elementos de protección personal",
          "Poner señalización",
          "Eliminar el peligro",
          "Capacitar al personal"
        ],
        "correcta": 2
      },
      {
        "pregunta": "Si un riesgo se valora en nivel I (crítico), ¿qué se debe hacer?",
        "opciones": [
          "Mantener los controles actuales",
          "Suspender la actividad hasta controlar el riesgo",
          "Mejorarlo cuando sea posible",
          "Nada, es aceptable"
        ],
        "correcta": 1
      }
    ],
    "post": [
      {
        "pregunta": "Según la GTC 45, la exposición a sangre y fluidos o un pinchazo con aguja corresponde a un peligro:",
        "opciones": [
          "Biológico",
          "Biomecánico",
          "Psicosocial",
          "Físico"
        ],
        "correcta": 0
      },
      {
        "pregunta": "Las posturas prolongadas y la movilización de pacientes son peligros de tipo:",
        "opciones": [
          "Químico",
          "Eléctrico",
          "Fenómeno natural",
          "Biomecánico"
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Qué se debe hacer para identificar peligros en un área?",
        "opciones": [
          "Revisar solo las actividades rutinarias",
          "Esperar el informe anual de la ARL",
          "Observar la tarea real, preguntar a quienes la hacen, registrar y actualizar cuando haya cambios",
          "Preguntar únicamente al jefe del área"
        ],
        "correcta": 2
      },
      {
        "pregunta": "En la jerarquía de controles, los elementos de protección personal (EPP) son:",
        "opciones": [
          "La primera y más eficaz medida",
          "La última barrera de protección",
          "Un control de ingeniería",
          "Opcionales en una IPS"
        ],
        "correcta": 1
      },
      {
        "pregunta": "Al reportar un acto o condición insegura, ¿qué información se debe incluir?",
        "opciones": [
          "Lugar, tarea, peligro observado y posible consecuencia",
          "El nombre de la persona culpable",
          "Solo una foto, sin descripción",
          "Nada, basta con comentarlo de forma verbal"
        ],
        "correcta": 0
      }
    ]
  },
  "investigacion-incidentes": {
    "pre": [
      {
        "pregunta": "¿Qué es un incidente de trabajo?",
        "opciones": [
          "Un evento que siempre produce lesión grave.",
          "Una enfermedad laboral diagnosticada.",
          "Una falta disciplinaria del trabajador.",
          "Un suceso relacionado con el trabajo que pudo ser un accidente, sin lesión ni pérdida material."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Cuál es el objetivo de investigar un accidente de trabajo?",
        "opciones": [
          "Encontrar al culpable para sancionarlo.",
          "Cumplir un trámite con la ARL.",
          "Identificar las causas y definir acciones que eviten que se repita.",
          "Calcular el costo del accidente."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿Cuál es el primer paso cuando ocurre un accidente?",
        "opciones": [
          "Tomar fotos para el informe.",
          "Atender al lesionado, controlar el área y evitar nuevos daños.",
          "Llenar el formato de investigación.",
          "Esperar a que llegue la ARL."
        ],
        "correcta": 1
      },
      {
        "pregunta": "Los actos y condiciones inseguras observables justo antes del evento son:",
        "opciones": [
          "Causas inmediatas.",
          "Causas básicas.",
          "Acciones correctivas.",
          "Consecuencias."
        ],
        "correcta": 0
      },
      {
        "pregunta": "Una buena acción correctiva debe:",
        "opciones": [
          "Ser siempre una capacitación.",
          "Aplicarse solo si el accidente fue grave.",
          "Decidirse sin analizar las causas.",
          "Eliminar la causa, con responsable, plazo, evidencia y verificación de eficacia."
        ],
        "correcta": 3
      }
    ],
    "post": [
      {
        "pregunta": "¿Qué diferencia un accidente de un incidente de trabajo?",
        "opciones": [
          "El incidente siempre es más grave.",
          "El accidente ocurre solo fuera de la empresa.",
          "El accidente produce lesión, perturbación funcional, invalidez o muerte; el incidente no.",
          "No hay diferencia."
        ],
        "correcta": 2
      },
      {
        "pregunta": "Según la Resolución 1401 de 2007, ¿en qué plazo se debe investigar un incidente o accidente?",
        "opciones": [
          "En 6 meses.",
          "Dentro de los 15 días siguientes a su ocurrencia.",
          "Al final del año.",
          "Solo si la ARL lo solicita."
        ],
        "correcta": 1
      },
      {
        "pregunta": "Los factores personales, del trabajo o de gestión que explican por qué existían las condiciones del evento son:",
        "opciones": [
          "Causas básicas.",
          "Causas inmediatas.",
          "Evidencias.",
          "Testigos."
        ],
        "correcta": 0
      },
      {
        "pregunta": "¿Cuál de estas es una evidencia útil en una investigación?",
        "opciones": [
          "Rumores sobre lo ocurrido.",
          "La opinión de personas que no estaban presentes.",
          "Ninguna, basta con el relato del jefe.",
          "Entrevistas, fotografías, documentos e inspección del lugar."
        ],
        "correcta": 3
      },
      {
        "pregunta": "Investigar un evento sirve para:",
        "opciones": [
          "Buscar culpables.",
          "Llenar un formato.",
          "Aprender, corregir y prevenir que se repita.",
          "Evitar reportar a la ARL."
        ],
        "correcta": 2
      }
    ]
  },
  "inspecciones-seguridad": {
    "pre": [
      {
        "pregunta": "¿Qué es una inspección de seguridad?",
        "opciones": [
          "Una búsqueda de culpables.",
          "Una revisión sistemática del trabajo para identificar peligros y condiciones que requieren intervención.",
          "Una visita de la ARL para sancionar.",
          "Una auditoría de documentos contables."
        ],
        "correcta": 1
      },
      {
        "pregunta": "¿Cuál de estas es una condición peligrosa que se debe reportar?",
        "opciones": [
          "Un cable deteriorado o expuesto.",
          "Un pasillo despejado.",
          "Un extintor señalizado y accesible.",
          "Una salida de emergencia libre."
        ],
        "correcta": 0
      },
      {
        "pregunta": "Durante una inspección se debe:",
        "opciones": [
          "Detener todas las actividades del área.",
          "Revisar solo los documentos.",
          "Evitar hablar con los trabajadores.",
          "Observar sin interferir, hablar con quienes hacen la tarea y registrar la evidencia."
        ],
        "correcta": 3
      },
      {
        "pregunta": "Ante un peligro evidente e inmediato, lo primero es:",
        "opciones": [
          "Esperar el cierre administrativo del reporte.",
          "Tomar fotos acercándose al peligro.",
          "Proteger a las personas: aislar o señalizar si es seguro e informar.",
          "Ignorarlo hasta la próxima inspección."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿Qué información debe tener un buen reporte?",
        "opciones": [
          "Solo el nombre de quien reporta.",
          "Qué se observó, dónde, qué riesgo genera, evidencia y acción inmediata.",
          "El nombre del responsable de la condición.",
          "Únicamente una foto."
        ],
        "correcta": 1
      }
    ],
    "post": [
      {
        "pregunta": "¿Cuándo se puede cerrar un hallazgo de inspección?",
        "opciones": [
          "Cuando existe evidencia de que la condición fue controlada.",
          "Cuando se envía el reporte.",
          "Al terminar el mes.",
          "Cuando el jefe lo olvida."
        ],
        "correcta": 0
      },
      {
        "pregunta": "Antes de una inspección conviene:",
        "opciones": [
          "Avisar que no se hará.",
          "Improvisar el recorrido.",
          "Revisar solo el área propia.",
          "Definir el área, revisar inspecciones previas y llevar la lista de verificación."
        ],
        "correcta": 3
      },
      {
        "pregunta": "Una salida de emergencia obstruida genera el riesgo de:",
        "opciones": [
          "Mayor iluminación.",
          "Ahorro de espacio.",
          "Dificultar una evacuación rápida y segura.",
          "Ninguno."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿A quién corresponde orientar la metodología de inspección y analizar las tendencias de los hallazgos?",
        "opciones": [
          "A los visitantes.",
          "Al responsable del SG-SST.",
          "A los pacientes.",
          "A nadie."
        ],
        "correcta": 1
      },
      {
        "pregunta": "En un pasillo, una caja sobresale de una estantería y reduce el paso. ¿Cuál es la acción correcta?",
        "opciones": [
          "Corregirla o aislarla si es seguro, informar y verificar el cierre.",
          "Dejarla, porque no ha pasado nada.",
          "Pasar con cuidado y no decir nada.",
          "Esperar a la inspección anual."
        ],
        "correcta": 0
      }
    ]
  },
  "riesgo-biologico": {
    "pre": [
      {
        "pregunta": "¿Qué es el riesgo biológico?",
        "opciones": [
          "El riesgo de caerse en un piso mojado.",
          "El estrés por carga de trabajo.",
          "El ruido de los equipos médicos.",
          "La exposición a agentes o materiales capaces de producir daño, como sangre, fluidos o residuos contaminados."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Cuál medida corta la cadena de transmisión en la vía de entrada?",
        "opciones": [
          "Trabajar más rápido.",
          "Reencapsular las agujas.",
          "Usar el EPP adecuado: guantes, protección ocular o facial según la tarea.",
          "No lavarse las manos."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿Los guantes reemplazan la higiene de manos?",
        "opciones": [
          "Sí, siempre.",
          "No: hay que lavarse las manos después de retirarlos.",
          "Solo en consulta externa.",
          "Depende del color del guante."
        ],
        "correcta": 1
      },
      {
        "pregunta": "Ante un pinchazo con una aguja usada, lo primero es:",
        "opciones": [
          "Lavar la zona con agua y jabón, reportar de inmediato y activar la ruta de accidente laboral.",
          "Seguir trabajando y reportarlo al final del turno.",
          "Aplicar una crema y no decir nada.",
          "Esperar a que cicatrice."
        ],
        "correcta": 0
      },
      {
        "pregunta": "Los residuos biosanitarios con sangre se depositan en el recipiente:",
        "opciones": [
          "Blanco.",
          "Negro.",
          "Verde.",
          "Rojo."
        ],
        "correcta": 3
      }
    ],
    "post": [
      {
        "pregunta": "¿Cuál de estas es una práctica segura con cortopunzantes?",
        "opciones": [
          "Reencapsular la aguja antes de desecharla.",
          "Dejarla en la bandeja para después.",
          "Desecharla de inmediato en un contenedor rígido, sin reencapsular.",
          "Usar el contenedor aunque esté lleno."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿Hasta qué nivel se llenan los recipientes, bolsas y guardianes de residuos?",
        "opciones": [
          "Hasta el borde.",
          "Hasta tres cuartas partes.",
          "Hasta la mitad.",
          "No hay límite."
        ],
        "correcta": 1
      },
      {
        "pregunta": "Los restos de comida van en el recipiente:",
        "opciones": [
          "Verde (orgánicos aprovechables).",
          "Rojo.",
          "Blanco.",
          "Guardián."
        ],
        "correcta": 0
      },
      {
        "pregunta": "¿Por qué no se deben compactar las bolsas con residuos peligrosos?",
        "opciones": [
          "Porque se dañan las canecas.",
          "Porque ocupan más espacio.",
          "No hay ninguna razón.",
          "Porque aumenta el riesgo de exposición, pinchazos y derrames."
        ],
        "correcta": 3
      },
      {
        "pregunta": "Las exposiciones a VIH, hepatitis B o C requieren:",
        "opciones": [
          "Esperar unos días para ver si aparecen síntomas.",
          "Solo descanso.",
          "Valoración clínica urgente y seguimiento.",
          "Ninguna acción si no hay sangrado."
        ],
        "correcta": 2
      }
    ]
  },
  "plan-emergencias": {
    "pre": [
      {
        "pregunta": "¿Qué es el plan de emergencias?",
        "opciones": [
          "Un documento que solo se lee cuando ocurre un incendio.",
          "El conjunto de acciones, responsables, recursos y procedimientos para prevenir y responder ante emergencias.",
          "La lista de teléfonos de la empresa.",
          "Un requisito que solo aplica a empresas grandes."
        ],
        "correcta": 1
      },
      {
        "pregunta": "Al sonar la alarma de evacuación, usted debe:",
        "opciones": [
          "Mantener la calma, seguir la ruta señalizada y las instrucciones del brigadista.",
          "Regresar por sus objetos personales.",
          "Usar el ascensor para salir más rápido.",
          "Esperar a ver si es real."
        ],
        "correcta": 0
      },
      {
        "pregunta": "¿Para qué sirve el punto de encuentro?",
        "opciones": [
          "Para descansar durante la jornada.",
          "Para guardar los equipos de emergencia.",
          "Para recibir visitantes.",
          "Para verificar que todas las personas evacuaron."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Con qué frecuencia mínima exige el Decreto 1072 de 2015 realizar simulacros?",
        "opciones": [
          "Cada 5 años.",
          "Solo cuando ocurre una emergencia.",
          "Al menos una vez al año.",
          "No es obligatorio."
        ],
        "correcta": 2
      },
      {
        "pregunta": "Los extintores, botiquines y salidas de emergencia deben:",
        "opciones": [
          "Guardarse bajo llave.",
          "Permanecer accesibles y sin obstrucciones.",
          "Ubicarse detrás de los muebles.",
          "Retirarse cuando no se usan."
        ],
        "correcta": 1
      }
    ],
    "post": [
      {
        "pregunta": "Durante una evacuación, ¿por qué no se deben usar los ascensores?",
        "opciones": [
          "Porque pueden fallar o quedar atrapados; solo se usan las rutas señalizadas.",
          "Porque son lentos.",
          "Porque están reservados para el gerente.",
          "Sí se pueden usar."
        ],
        "correcta": 0
      },
      {
        "pregunta": "¿Qué hace la brigada de emergencias durante la emergencia?",
        "opciones": [
          "Se retira primero.",
          "Recoge los documentos de la oficina.",
          "Nada, solo actúa en simulacros.",
          "Orienta la evacuación y apoya los primeros auxilios según su entrenamiento."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Por qué es un error salir del punto de encuentro antes de recibir instrucciones?",
        "opciones": [
          "Porque se pierde el turno.",
          "Porque es aburrido esperar.",
          "Porque impide verificar si todas las personas evacuaron.",
          "No es un error."
        ],
        "correcta": 2
      },
      {
        "pregunta": "Después de un simulacro se debe:",
        "opciones": [
          "Olvidarlo hasta el próximo año.",
          "Analizar los resultados, comunicar los hallazgos y asignar acciones de mejora.",
          "Felicitar a todos sin evaluar.",
          "Cambiar de punto de encuentro."
        ],
        "correcta": 1
      },
      {
        "pregunta": "Si ve a un compañero que intenta regresar por su bolso durante una evacuación, lo correcto es:",
        "opciones": [
          "Seguir la ruta, no promover conductas que retrasen la salida y avisar al brigadista.",
          "Acompañarlo para que no vaya solo.",
          "Esperarlo en la salida.",
          "Regresar usted también."
        ],
        "correcta": 0
      }
    ]
  },
  "estilos-vida-saludables": {
    "pre": [
      {
        "pregunta": "¿Cuántos minutos semanales de actividad física moderada recomienda la OMS para los adultos?",
        "opciones": [
          "Entre 30 y 60 minutos.",
          "Más de 1.000 minutos.",
          "No hay ninguna recomendación.",
          "Entre 150 y 300 minutos."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Cuál de estas es una opción de alimentación saludable?",
        "opciones": [
          "Consumir ultraprocesados todos los días.",
          "Saltarse comidas para rendir más.",
          "Priorizar frutas, verduras, leguminosas y cereales integrales.",
          "Tomar bebidas azucaradas en lugar de agua."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿Para qué sirven las pausas activas?",
        "opciones": [
          "Para salir temprano del trabajo.",
          "Para interrumpir los periodos largos en la misma postura con movimientos suaves.",
          "Para reemplazar el sueño.",
          "No sirven para nada."
        ],
        "correcta": 1
      },
      {
        "pregunta": "¿Cuál es una señal de que puede haber sobrecarga o estrés?",
        "opciones": [
          "Tensión, irritabilidad, cansancio o dificultad para concentrarse.",
          "Dormir bien todas las noches.",
          "Tener buen apetito.",
          "Hacer ejercicio con regularidad."
        ],
        "correcta": 0
      },
      {
        "pregunta": "¿Qué bebida se recomienda como opción principal para hidratarse?",
        "opciones": [
          "Gaseosa.",
          "Bebidas energizantes.",
          "Café en exceso.",
          "Agua."
        ],
        "correcta": 3
      }
    ],
    "post": [
      {
        "pregunta": "¿Qué forma de consumo de tabaco es segura?",
        "opciones": [
          "El cigarrillo electrónico.",
          "Fumar solo los fines de semana.",
          "Ninguna: todas las formas de consumo de tabaco son perjudiciales.",
          "Fumar poco."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿Es recomendable usar alcohol para manejar el estrés o descansar?",
        "opciones": [
          "Sí, ayuda a relajarse.",
          "No: aumenta los riesgos para la salud y la seguridad.",
          "Solo después del trabajo.",
          "Sí, en pequeñas cantidades diarias."
        ],
        "correcta": 1
      },
      {
        "pregunta": "¿Cuál es la mejor manera de empezar a hacer actividad física si se es sedentario?",
        "opciones": [
          "Empezar con poco y aumentar gradualmente.",
          "Pasar de cero a la máxima intensidad.",
          "Esperar a tener tiempo libre.",
          "Solo hacer ejercicio una vez al mes."
        ],
        "correcta": 0
      },
      {
        "pregunta": "El cansancio persistente o las dificultades frecuentes para dormir:",
        "opciones": [
          "Son normales y no requieren atención.",
          "Se resuelven con más café.",
          "Indican que se debe trabajar más.",
          "Merecen valoración profesional."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Cómo debe ser un buen reto de hábito saludable para una semana?",
        "opciones": [
          "Muy exigente para ver resultados rápidos.",
          "Cambiar todos los hábitos al mismo tiempo.",
          "Específico, realista y repetible.",
          "Sin un momento definido para hacerlo."
        ],
        "correcta": 2
      }
    ]
  },
  "manejo-integrado-plagas": {
    "pre": [
      {
        "pregunta": "¿Cuál es el primer nivel de la jerarquía de controles del Manejo Integrado de Plagas?",
        "opciones": [
          "Aplicar plaguicidas en todas las áreas.",
          "Prevención y saneamiento: limpieza, orden y control de humedad.",
          "Llamar al proveedor cada semana.",
          "Colocar trampas en los consultorios."
        ],
        "correcta": 1
      },
      {
        "pregunta": "¿Qué condición favorece la presencia de cucarachas?",
        "opciones": [
          "Superficies secas y limpias.",
          "Recipientes con tapa.",
          "Desagües, humedad, restos de alimento, grietas y cajas.",
          "Iluminación natural."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿Cómo se calcula el nivel de riesgo en la matriz de valoración?",
        "opciones": [
          "Probabilidad × consecuencia, cada una calificada de 1 a 5.",
          "Número de plagas vistas en el mes.",
          "Área del espacio en metros cuadrados.",
          "Cantidad de veces que se fumiga."
        ],
        "correcta": 0
      },
      {
        "pregunta": "¿Puede el personal de SanitHelp usar plaguicidas domésticos para controlar una plaga?",
        "opciones": [
          "Sí, si la plaga es pequeña.",
          "Sí, fuera del horario de atención.",
          "Solo en la sala de juntas.",
          "No, está absolutamente prohibido."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Por qué las cajas de cartón son un problema en la sala de espera y la recepción?",
        "opciones": [
          "Ocupan mucho espacio.",
          "Son el refugio principal de las plagas.",
          "Se mojan con facilidad.",
          "Dificultan la limpieza del piso únicamente."
        ],
        "correcta": 1
      }
    ],
    "post": [
      {
        "pregunta": "¿Qué áreas de la sede tienen riesgo ALTO (10) de plagas y son prioridad 1?",
        "opciones": [
          "Recepción y sala de espera.",
          "Consultorios y sala de juntas.",
          "Toma de muestras y cuarto de aseo.",
          "Cuartos de residuos peligrosos y ordinarios."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿Hasta qué capacidad se deben llenar las bolsas de residuos?",
        "opciones": [
          "Máximo hasta tres cuartas partes (Resolución 591).",
          "Hasta que no quepa nada más.",
          "Hasta la mitad.",
          "No hay un límite."
        ],
        "correcta": 0
      },
      {
        "pregunta": "Si se confirma la presencia de roedores en un área interna, ¿cuándo se debe pedir atención extraordinaria?",
        "opciones": [
          "En la siguiente visita trimestral.",
          "En 5 días.",
          "En 15 días.",
          "En 24 horas."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Cuál de estas condiciones obliga a RECHAZAR la aplicación de un plaguicida?",
        "opciones": [
          "Que el proveedor entregue la FDS en español.",
          "Que haya pacientes o muestras biológicas expuestas en el área.",
          "Que las barreras de saneamiento estén implementadas.",
          "Que el producto tenga registro sanitario vigente."
        ],
        "correcta": 1
      },
      {
        "pregunta": "En la sala de juntas, ¿qué se debe hacer con los residuos orgánicos del almuerzo?",
        "opciones": [
          "Guardarlos hasta el fin de semana.",
          "Dejarlos en una caneca sin tapa.",
          "Retirarlos obligatoriamente el mismo día.",
          "Llevarlos al cuarto de aseo."
        ],
        "correcta": 2
      }
    ]
  },
  "ahorro-energia": {
    "pre": [
      {
        "pregunta": "¿Cuál es la regla invariable del programa de ahorro de energía?",
        "opciones": [
          "Apagar todos los equipos al mediodía.",
          "Las medidas de ahorro nunca deben comprometer la atención, la conservación de muestras ni la bioseguridad.",
          "Desconectar las neveras en la noche.",
          "Usar solo luz natural en los consultorios."
        ],
        "correcta": 1
      },
      {
        "pregunta": "¿Qué hacer con los computadores y cargadores inactivos al terminar la jornada?",
        "opciones": [
          "Dejarlos encendidos para el día siguiente.",
          "Ponerlos a cargar toda la noche.",
          "Apagarlos y desconectarlos.",
          "Solo apagar la pantalla."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿Se pueden manipular los tableros eléctricos para ahorrar energía?",
        "opciones": [
          "Sí, si se hace con cuidado.",
          "Sí, al final del día.",
          "Solo el personal administrativo.",
          "No, está prohibido."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Qué equipo debe permanecer siempre encendido en toma de muestras?",
        "opciones": [
          "La refrigeración de muestras y reactivos.",
          "La impresora.",
          "El televisor de la sala de espera.",
          "Los cargadores de celular."
        ],
        "correcta": 0
      },
      {
        "pregunta": "Si percibe olor a quemado o chispas en un tomacorriente, ¿qué debe hacer?",
        "opciones": [
          "Repararlo con cinta aislante.",
          "Ignorarlo si el equipo sigue funcionando.",
          "Reportar de inmediato a Calidad/SST y no tocar cables energizados.",
          "Desarmar el tomacorriente para revisarlo."
        ],
        "correcta": 2
      }
    ],
    "post": [
      {
        "pregunta": "¿Cuántos meses de facturación se consolidan para establecer la línea base de consumo?",
        "opciones": [
          "1 mes.",
          "3 meses.",
          "6 meses.",
          "12 meses."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Quién puede hacer empalmes o reparaciones eléctricas?",
        "opciones": [
          "Cualquier trabajador con experiencia.",
          "Solo personal técnico certificado.",
          "El Vigía SST.",
          "El personal de aseo."
        ],
        "correcta": 1
      },
      {
        "pregunta": "Con el aire acondicionado encendido, ¿cómo deben estar puertas y ventanas?",
        "opciones": [
          "Cerradas.",
          "Abiertas para ventilar.",
          "Solo las ventanas abiertas.",
          "No importa."
        ],
        "correcta": 0
      },
      {
        "pregunta": "¿Con qué frecuencia se hace la revisión visual de tomacorrientes, interruptores, tableros y cableado?",
        "opciones": [
          "Diaria.",
          "Cada 5 años.",
          "Semestral.",
          "Solo cuando hay una falla."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿Qué reglamento técnico regula las instalaciones eléctricas en Colombia?",
        "opciones": [
          "RETILAP.",
          "Resolución 0312 de 2019.",
          "Ley 373 de 1997.",
          "RETIE."
        ],
        "correcta": 3
      }
    ]
  },
  "ahorro-agua": {
    "pre": [
      {
        "pregunta": "¿Qué nunca debe comprometer el ahorro de agua en una IPS?",
        "opciones": [
          "El riego de plantas.",
          "El lavado de manos, la desinfección y la bioseguridad.",
          "El llenado de tanques.",
          "La limpieza de vidrios."
        ],
        "correcta": 1
      },
      {
        "pregunta": "Si detecta un goteo en un lavamanos, ¿qué debe hacer?",
        "opciones": [
          "Esperar a la siguiente revisión mensual.",
          "Repararlo uno mismo.",
          "Reportarlo oportunamente indicando ubicación y severidad.",
          "Cerrar el lavamanos con cinta."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿Qué se debe usar en el cuarto de aseo en lugar de una manguera de flujo abierto?",
        "opciones": [
          "Recipientes graduados.",
          "Más productos químicos.",
          "Agua caliente.",
          "Una manguera más larga."
        ],
        "correcta": 0
      },
      {
        "pregunta": "¿Cuál es una buena práctica en el área asistencial?",
        "opciones": [
          "Dejar el grifo abierto durante todo el procedimiento.",
          "Reducir el caudal aunque afecte el lavado de manos.",
          "Instalar ahorradores sin evaluación previa.",
          "Cerrar el grifo mientras el procedimiento lo permita."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿De dónde proviene el agua de la sede de SanitHelp?",
        "opciones": [
          "De un pozo propio.",
          "Del acueducto público.",
          "De carrotanques.",
          "Del agua lluvia."
        ],
        "correcta": 1
      }
    ],
    "post": [
      {
        "pregunta": "¿Cuál es el primer paso del protocolo ante una fuga de agua?",
        "opciones": [
          "Registrar la causa.",
          "Llamar al proveedor de plagas.",
          "Detección: reportar de inmediato ubicación y severidad.",
          "Esperar la factura del mes."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿Cómo se calcula el indicador de atención de fugas?",
        "opciones": [
          "(Fugas corregidas a tiempo ÷ fugas reportadas) × 100.",
          "m³ facturados en el mes.",
          "Número de grifos de la sede.",
          "Consumo actual menos consumo del año anterior."
        ],
        "correcta": 0
      },
      {
        "pregunta": "¿Con qué frecuencia se hace la ronda interna de inspección hidrosanitaria?",
        "opciones": [
          "Anual.",
          "Mensual.",
          "Cada 5 años.",
          "Solo cuando hay fugas."
        ],
        "correcta": 1
      },
      {
        "pregunta": "¿Qué está prohibido hacer con los alimentos para no desperdiciar agua?",
        "opciones": [
          "Lavarlos.",
          "Guardarlos en la nevera.",
          "Calentarlos en el microondas.",
          "Descongelarlos bajo el chorro continuo de agua."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Qué norma es el marco para el uso eficiente y ahorro del agua en Colombia?",
        "opciones": [
          "Ley 373 de 1997.",
          "Decreto 1072 de 2015.",
          "RETIE.",
          "Resolución 0312 de 2019."
        ],
        "correcta": 0
      }
    ]
  },
  "huella-carbono": {
    "pre": [
      {
        "pregunta": "¿Qué mide la huella de carbono?",
        "opciones": [
          "La cantidad de papel usado.",
          "Las emisiones de gases de efecto invernadero (GEI) de una organización.",
          "El número de pacientes atendidos.",
          "El consumo de agua."
        ],
        "correcta": 1
      },
      {
        "pregunta": "¿En qué unidad se expresan las emisiones de los distintos GEI?",
        "opciones": [
          "kWh.",
          "m³.",
          "CO₂ equivalente (CO₂e).",
          "Kilogramos de residuos."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿Cómo se calcula una emisión?",
        "opciones": [
          "Dato de actividad × factor de emisión.",
          "Número de equipos × horas de uso.",
          "Factura de energía ÷ número de trabajadores.",
          "Se estima a simple vista."
        ],
        "correcta": 0
      },
      {
        "pregunta": "¿Cuál de estas acciones ayuda a reducir la huella de carbono de la sede?",
        "opciones": [
          "Dejar luces encendidas en áreas vacías.",
          "Mezclar todos los residuos.",
          "Desconectar la nevera de muestras.",
          "Optimizar la iluminación y separar bien los residuos."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Está permitido apagar equipos médicos o la refrigeración de muestras para reducir emisiones?",
        "opciones": [
          "Sí, en la noche.",
          "Sí, si se ahorra energía.",
          "No, está prohibido por la restricción sanitaria.",
          "Solo los fines de semana."
        ],
        "correcta": 2
      }
    ],
    "post": [
      {
        "pregunta": "¿A qué alcance pertenece el consumo de energía eléctrica comprada?",
        "opciones": [
          "Alcance 1.",
          "Alcance 2.",
          "Alcance 3.",
          "No se incluye en el inventario."
        ],
        "correcta": 1
      },
      {
        "pregunta": "Las fugas de refrigerantes de los aires acondicionados son emisiones de:",
        "opciones": [
          "Alcance 1 (directas).",
          "Alcance 2.",
          "Alcance 3.",
          "No generan emisiones."
        ],
        "correcta": 0
      },
      {
        "pregunta": "¿Qué evidencia respalda las emisiones de los residuos hospitalarios?",
        "opciones": [
          "Fotos de las canecas.",
          "La factura de energía.",
          "El registro de asistencia.",
          "Manifiestos y certificados de tratamiento."
        ],
        "correcta": 3
      },
      {
        "pregunta": "¿Qué mide el indicador de intensidad por atención?",
        "opciones": [
          "Las emisiones totales del año.",
          "El porcentaje de fuentes con soporte.",
          "Los kgCO₂e emitidos por cada servicio prestado.",
          "El número de atenciones al mes."
        ],
        "correcta": 2
      },
      {
        "pregunta": "¿Qué debe registrar el personal de mantenimiento para la huella de carbono?",
        "opciones": [
          "Las recargas de refrigerantes.",
          "Los horarios de los pacientes.",
          "Las facturas de agua.",
          "Las asistencias a capacitaciones."
        ],
        "correcta": 0
      }
    ]
  }
};

export const evaluacionesFijas = { ...propias, ...evaluacionesImportadas };
