// Todas las rutas del administrador (/api/admin/...) llegan aquí por la regla de vercel.json: el plan de Vercel permite
// pocas funciones y server/adminApi.js ya decide qué hacer según la ruta.
import { handle } from '../../server/vercel.js'

export const GET = handle
export const POST = handle
export const PUT = handle
export const DELETE = handle
