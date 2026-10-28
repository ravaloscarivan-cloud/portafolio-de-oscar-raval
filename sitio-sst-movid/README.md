# Sitio SST MOVID

Página estática (`Postulaciones_SST_MOVID_3.html`) con funciones de servidor en Vercel (`api/`). Los datos se guardan en **Supabase**:

- **Tablas** (`db/schema.sql`): `registros` (postulaciones, hojas de vida y envíos de HV y soportes), `soportes_pendientes`, y para Votaciones `vot_config`, `vot_padron`, `vot_votos` (impide votar dos veces) y `vot_urna` (papeletas sin datos del votante). `admin_estado` guarda cuándo el admin marcó las alertas como vistas. `induccion` guarda la inducción terminada (una fila por documento) y cuándo se envió el manual. `visitas` guarda una fila por visitante (pestaña) con su sección y acción más recientes; el nombre se completa cuando envía su postulación, HV o soportes (cabecera `X-Visitante`).
- **Archivos**: bucket privado `privado` con `submissions/<id>.pdf` y `soportes/<id>/<archivo>`.

Hasta el 7 de octubre de 2026 el sitio usó Vercel Blob; ese almacén se suspendió por superar el cupo gratuito de operaciones y los datos se recuperaron en Supabase.

## Configurar y desplegar

1. Instala Node.js 22 o posterior y las dependencias con `npm install`.
2. En `.env.local` (no se publica) define:
   - `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (clave secreta del proyecto Supabase).
   - `SUPABASE_DB_URL` (conexión Postgres, *Session pooler*): solo la usa el script de montaje.
   - `RESPONSES_PASSWORD`: clave de **Usuario** y del **Padrón electoral**.
   - `RESEND_API_KEY`, `MAIL_FROM` (remitente de un dominio verificado en Resend) y `MANUAL_URL` (enlace público al PDF del manual; opcional `MANUAL_FILENAME`): envío del manual cuando la persona termina HV, soportes e inducción. Sin ellas no se envía el correo.
   - `SUPABASE_ANON_KEY`: clave pública (*anon* o *publishable*) para los avisos en vivo de la campana del admin. Sin ella, la campana funciona pero sin tiempo real.
3. Monta las tablas y el bucket: `node --env-file=.env.local scripts/supabase-setup.mjs`.
4. En Vercel deben existir `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `RESPONSES_PASSWORD`.
5. Despliega con `npx vercel --prod`.

La clave `service_role` solo vive en el servidor; el navegador nunca accede directo a Supabase. Las tablas tienen RLS activo y sin políticas públicas.

## Plantillas

- `plantillas/SST-FT-12_Acta_de_conformacion_de_comite.docx`: el navegador la llena con el resultado de Votaciones (comité cerrado) y los datos que designa el empleador.

## API

- `POST /api/submissions`: postulación (responde el PDF) u hoja de vida (`type: "hoja-vida"`).
- `GET /api/submissions` (clave): lista de registros; `?id=<uuid>` descarga el PDF, `&view=1` para verlo, `&file=<n>` descarga un soporte.
- `PUT /api/submissions?action=visto` (clave): marca como vistas las alertas del admin (la fecha se guarda en `admin_estado`).
- `GET /api/submissions?live=1` (clave): datos para escuchar los avisos en vivo (Supabase Realtime, canal derivado de la clave).
- `POST /api/actividad`: registra que alguien entró a una sección o está llenando campos (tabla `visitas`) y avisa a la campana. Nunca incluye lo escrito.
- `POST /api/induccion`: registra la inducción terminada (videos vistos y lista de chequeo) y, si la persona ya entregó HV y soportes, le envía el manual.
- `DELETE /api/submissions?id=<uuid>` (clave): borra el registro, su PDF y sus soportes.
- `POST /api/soportes?action=start|upload|finish`: envío de HV y soportes, un archivo PDF por solicitud (máx. 4 MB).
- `GET|POST /api/votaciones`: configuración, padrón (con clave), verificación por PIN (cédula) y voto con principal y suplente.

Los PDF y registros contienen datos personales. Antes de abrir el sitio al público, la persona responsable de protección de datos de MOVID IPS debe validar los textos de autorización, la conservación y el encargo del tratamiento al proveedor de nube (Supabase).

## Desarrollo y pruebas

- `npm test`: valida campos y la generación de los PDF.
- No agregar consultas automáticas periódicas a la base de datos ni pruebas masivas contra producción.
