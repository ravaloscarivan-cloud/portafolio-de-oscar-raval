# SanitHelp · Capacitaciones

Aplicativo web (React + funciones Node en Vercel + PostgreSQL en Neon) para que el personal lea las capacitaciones en diapositivas y registre su asistencia con firma digital.

Los usuarios **solo pueden ver** las capacitaciones y **enviar** su asistencia; no pueden crear, editar ni borrar nada.

## Uso
El aplicativo se comparte por enlace; nadie necesita cuenta. Cada persona se identifica con nombre, apellido y correo, y su navegador lo recuerda para marcar su avance.

## Módulos
- **Capacitaciones**: tarjetas con todas las capacitaciones (horas, facilitador, fecha programada y de ejecución) y el avance de la persona (Pre-test ✓ · Post-test ✓ · Asistencia ✓ · Completada). Cada capacitación sigue el flujo **pre-test → diapositivas (scroll hacia abajo) → post-test → resultado** con las respuestas correctas.
- **Asistencia**: cada capacitación tiene su asistencia (también las que agregue el administrador). La persona elige la capacitación y registra nombre, apellido, correo y firma (con botón Deshacer). Al enviarla, se muestra una confirmación en la capacitación correspondiente y la tarjeta queda marcada como firmada. Un correo firma una vez por capacitación.
- **Fechas**: el pre-test, el post-test y la asistencia se registran con la fecha de la capacitación (la de ejecución o, si no tiene, la programada).

## Evaluaciones (pre y post)
- Cada capacitación tiene **5 preguntas de pre-test y 5 distintas de post-test**, de selección múltiple y sobre el tema. Para presentar el post-test se requiere haber completado el pre-test y registrado la asistencia de esa capacitación con el mismo correo.
- Las respuestas correctas viven solo en el servidor ([lib/evaluaciones.js](lib/evaluaciones.js) para las fijas, columna `evaluacion` para las importadas); el navegador recibe las preguntas sin respuestas.
- Los resultados se guardan en la tabla `evaluaciones` (una de cada tipo por correo y capacitación).

## Administrador
Al final del menú lateral está **Administrador** (contraseña en la variable `ADMIN_PASSWORD` de Vercel). Tiene dos secciones:
- **Respuestas de usuarios**: lista de las personas que han participado, con su avance. Por cada persona:
  - **PDF** con sus datos, un resumen y, por cada capacitación, el registro de asistencia con nombre, apellido, correo y firma, además del estado y puntaje del pre-test y post-test. Se genera en el navegador ([client/src/lib/pdfRespuestas.js](client/src/lib/pdfRespuestas.js)).
  - **Borrar**: elimina todas sus asistencias y evaluaciones.
- **Capacitaciones**: cada capacitación puede estar **visible**, **oculta** (no se muestra a los usuarios) o **eliminada** (se puede restaurar). Las respuestas ya registradas se conservan.

Variables de entorno en Vercel: `DATABASE_URL` (Neon), `ADMIN_PASSWORD` y `ADMIN_SECRET` (firma de la sesión).

## Capacitaciones disponibles
En el orden del cronograma (horas, facilitador y fechas en [client/src/data/](client/src/data/)):

| N.º | Id | Capacitación | Horas | Facilitador | Programada | Ejecución |
|---|---|---|---|---|---|---|
| 1 | `vigia-sst` | Funciones y responsabilidades del Vigía SST | 2 | Responsable SG-SST | 01/05/26 | 11/05/26 |
| 2 | `fundamentos-sg-sst` | Fundamentos del SG-SST y estándares mínimos | 4 | ARL SURA | 01/06/26 | 10/06/26 |
| 3 | `identificacion-peligros` | Identificación de peligros y evaluación de riesgos | 4 | ARL SURA | 01/07/26 | 10/07/26 |
| 4 | `investigacion-incidentes` | Prevención e investigación de incidentes y accidentes | 4 | ARL SURA | 03/08/26 | 10/08/26 |
| 5 | `inspecciones-seguridad` | Inspecciones de seguridad y reporte de condiciones | 2 | Responsable SG-SST | 01/09/26 | 14/09/26 |
| 6 | `riesgo-biologico` | Riesgo biológico, bioseguridad y manejo de residuos en IPS | 2 | Responsable SG-SST | 02/10/26 | 13/10/26 |
| 7 | `plan-emergencias` | Plan de emergencias y simulacros | 2 | — | 02/11/26 | 10/11/26 |
| 8 | `estilos-vida-saludables` | Estilos de vida saludables | 1 | — | 01/12/26 | 10/12/26 |
| 9 | `manejo-integrado-plagas` | Manejo Integrado de Plagas (MIP) | — | Ing. Calidad y Ambiente | 11/05/26 | 11/05/26 |
| 10 | `ahorro-energia` | Programa de Ahorro y Uso Eficiente de la Energía Eléctrica (PAUEEE, PG-AR-002) | — | Ing. Calidad y Ambiente | 10/06/26 | 10/06/26 |
| 11 | `ahorro-agua` | Programa de Ahorro y Uso Eficiente del Agua (PAUEA, PG-AR-001) | — | Ing. Calidad y Ambiente | 10/08/26 | 10/08/26 |
| 12 | `huella-carbono` | Programa Huella de Carbono (PG-AR-003) | — | Ing. Calidad y Ambiente | 11/05/26 | 11/05/26 |

Cada una tiene 5 preguntas de pre-test y 5 de post-test en [lib/evaluaciones.js](lib/evaluaciones.js) (incluye los cuestionarios oficiales del Vigía SST y de Fundamentos del SG-SST).

El contenido está en [client/src/data/capacitaciones.js](client/src/data/capacitaciones.js) y [client/src/data/capacitacionesNuevas.js](client/src/data/capacitacionesNuevas.js) y, las de Ambiente y Recursos (9 a 12), en [client/src/data/capacitacionesAmbientales.js](client/src/data/capacitacionesAmbientales.js); la biblioteca de fotos revisadas en [client/src/data/fotos.js](client/src/data/fotos.js) y `client/public/slides/`.
Los archivos originales (PDF y PowerPoint) se conservan en `CAPACITACIONES/` como referencia; el aplicativo no los usa.

Para cambiar un texto o agregar una diapositiva, edite ese archivo y despliegue: `vercel deploy --prod`.
Tipos de diapositiva disponibles: `portada`, `contenido`, `tarjetas`, `pasos`, `comparacion`, `imagen`, `colores`, `tabla`, `cierre`.

> ⚠ El `id` de cada capacitación se guarda con cada asistencia. No lo cambie en una capacitación que ya tenga firmas.

## Agregar capacitaciones automáticamente
Copie el PowerPoint, PDF o Word en la carpeta `CAPACITACIONES/` y el aplicativo se actualiza solo:

```bash
npm run vigilar     # deje esta ventana abierta: procesa cada archivo nuevo que llegue a la carpeta
npm run publicar    # o: procesa una sola vez los archivos pendientes, publica y termina
```

Por cada archivo nuevo, [scripts/vigilar-capacitaciones.js](scripts/vigilar-capacitaciones.js):
1. Espera a que el archivo termine de copiarse y no esté abierto en Office.
2. Ejecuta Claude Code (`claude -p`) con las instrucciones de [scripts/agregar-capacitacion.md](scripts/agregar-capacitacion.md): lee el documento (también las diapositivas que son solo imagen), crea las diapositivas en [client/src/data/capacitacionesImportadas.js](client/src/data/capacitacionesImportadas.js), el pre-test y post-test en [lib/evaluacionesImportadas.js](lib/evaluacionesImportadas.js) y, si hace falta, descarga fotos libres de Wikimedia Commons. La fecha sigue la rotación de las fechas de las demás capacitaciones.
3. Valida todo con `npm run validar`; si algo falla, deshace los cambios de ese archivo.
4. Compila y publica con `vercel deploy --prod`.

**Borrar una capacitación:** borre su archivo de `CAPACITACIONES/`. Si el archivo sigue faltando al cabo de un minuto, el vigilante la retira del aplicativo ([scripts/retirar.js](scripts/retirar.js)) y publica:
- Las creadas por el vigilante se eliminan con sus diapositivas, evaluaciones y fotos (las fotos quedan en `scripts/.trabajo/papelera/`).
- Las primeras (Vigía, Fundamentos, etc.) se agregan a [client/src/data/capacitacionesRetiradas.js](client/src/data/capacitacionesRetiradas.js) y dejan de mostrarse; para volver a mostrar una, quite su id de esa lista.
- Las asistencias y resultados ya registrados se conservan en la base de datos.
- Si solo renombra el archivo, se reconoce por su tamaño y no se retira ni se reconvierte. Si la capacitación tiene otro archivo en la carpeta (p. ej. su PDF), no se retira.
- Si faltan más de 3 archivos a la vez, no retira nada (por si la carpeta se movió por error); para confirmarlo: `npm run publicar -- --confirmar-retiro`.

Requisitos en el equipo: Claude Code (`claude`) y Vercel CLI (`vercel`) con sesión iniciada, Node y Python. Los archivos ya procesados quedan en `scripts/procesadas.json`: para reprocesar uno (p. ej. una versión corregida), borre su entrada y la capacitación anterior. Si el documento no es una capacitación (un cuestionario, un formato), se omite. El registro de actividad está en `scripts/.trabajo/vigilante.log`.

> Revise las preguntas generadas en el Administrador o en `lib/evaluacionesImportadas.js`: son automáticas, no cuestionarios oficiales.

## Imágenes
Las fotos de las capacitaciones salen del banco de fotos [scripts/fotos.js](scripts/fotos.js), que usa el vigilante y también se puede usar a mano:
```bash
npm run fotos -- buscar "nurse washing hands"        # candidatas que todavía no se usan
npm run fotos -- descargar pexels:3825529 lavado-manos  # la guarda en client/public/slides/ con su crédito
npm run fotos -- descartar lavado-manos                 # la quita si no sirve
npm run fotos -- usadas                                 # qué foto usa cada capacitación
```
- **Fuente:** con `PEXELS_API_KEY` en `.env.local` busca en Pexels (fotos de mejor calidad y más alusivas; clave gratuita en pexels.com/api); sin ella, en Wikimedia Commons, solo con licencias libres.
- **Sin repetir:** no ofrece fotos ya descargadas, compara el contenido para no guardar la misma foto con otro nombre y el validador rechaza cualquier foto usada en dos lugares.

Las fotos son de Wikimedia Commons con licencias libres (dominio público, CC0, CC BY, CC BY-SA); los créditos aparecen al final de cada presentación.

## Estructura
| Ruta | Qué es |
|---|---|
| `client/` | Frontend React (Vite) |
| `client/src/data/capacitaciones.js` | Contenido de las presentaciones |
| `client/src/components/Presentacion.jsx` | Visor de diapositivas |
| `client/src/lib/pdfRespuestas.js` | PDF de respuestas de cada persona |
| `api/asistencias.js` · `api/evaluacion.js` · `api/progreso.js` | Asistencia con firma, pre-test/post-test y avance de cada persona |
| `api/admin/` | Inicio de sesión, respuestas de usuarios y estado de las capacitaciones |
| `lib/evaluaciones.js` | Preguntas y respuestas correctas (solo en el servidor) |
| `lib/db.js` | Conexión a Neon; crea las tablas si no existen |
| `dev-server.js` | API local para desarrollo |

## Desarrollo local
```bash
npm run install:all
vercel env pull .env.local   # trae DATABASE_URL de Neon
npm run dev                  # http://localhost:5173
```

## Consultar las firmas
Lo más fácil es descargar el PDF de cada persona desde Administrador → Respuestas de usuarios. Las asistencias también se pueden consultar en la tabla `asistencias` de Neon (consola de Neon → SQL Editor, o Vercel → Storage):
```sql
SELECT capacitacion, nombre, apellido, correo, registrado_en
FROM asistencias
ORDER BY registrado_en DESC;
```
La columna `firma` contiene la imagen PNG en base64. Un mismo correo solo puede firmar una vez cada capacitación.
