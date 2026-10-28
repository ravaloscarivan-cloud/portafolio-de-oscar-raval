# Evaluaciones psicométricas

Aplicación web de cuestionarios (VALANTI, DISC y 16PF) con React + Vite en el frontend y funciones en `api/` (desplegadas en Vercel), base de datos Turso/libSQL y envío de PDFs por correo.

## Puesta en marcha

1. Instalar Node.js 20 o superior.
2. Clonar el repositorio e instalar dependencias:
   ```
   git clone https://github.com/ravaloscarivan-cloud/evaluaciones-psicometricas.git
   cd evaluaciones-psicometricas
   npm install
   ```
3. Copiar `.env.example` a `.env.local` y rellenar las credenciales (pídelas al responsable del proyecto; nunca se suben a GitHub).
4. Ejecutar:
   - `npm run dev` — frontend en modo desarrollo
   - `npm run server` — servidor Express local (`server.js`)
   - `npm run build` — compilar para producción

## Estructura

- `src/` — aplicación React (`App.jsx`, preguntas 16PF, estilos)
- `api/` — funciones serverless (cuestionarios, respuestas)
- `reportes/` — generación de PDFs de resultados (VALANTI, DISC, 16PF)
- `public/` — recursos estáticos

## No incluido en el repositorio

- Archivos `.env*` con credenciales
- Bases de datos locales (`valanti.db`) y archivos con datos de participantes
- Material de referencia del 16PF (`16_pf/`)
