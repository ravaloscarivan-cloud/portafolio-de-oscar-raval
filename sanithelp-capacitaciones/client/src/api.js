const CLAVE_TOKEN = 'sanithelp-admin-token';

export const sesion = {
  obtener() {
    try { return sessionStorage.getItem(CLAVE_TOKEN); } catch { return null; }
  },
  guardar(token) {
    try { sessionStorage.setItem(CLAVE_TOKEN, token); } catch { /* sin almacenamiento */ }
  },
  cerrar() {
    try { sessionStorage.removeItem(CLAVE_TOKEN); } catch { /* sin almacenamiento */ }
  },
};

export class SesionVencida extends Error {}

async function request(url, options = {}) {
  const token = options.admin ? sesion.obtener() : null;
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && options.admin) {
    sesion.cerrar();
    throw new SesionVencida(data.error || 'Sesión vencida');
  }
  if (!res.ok) throw new Error(data.error || 'Error de conexión con el servidor');
  return data;
}

export const api = {
  asistencias: {
    enviar: (body) => request('/api/asistencias', { method: 'POST', body }),
  },
  capacitaciones: {
    ocultas: () => request('/api/capacitaciones'),
  },
  evaluacion: {
    obtener: (id) => request(`/api/evaluacion?id=${encodeURIComponent(id)}`),
    enviar: (body) => request('/api/evaluacion', { method: 'POST', body }),
    progreso: (correo) => request(`/api/progreso?correo=${encodeURIComponent(correo)}`),
  },
  admin: {
    async entrar(contrasena) {
      const { token } = await request('/api/admin/login', { method: 'POST', body: { contrasena } });
      sesion.guardar(token);
    },
    capacitaciones: () => request('/api/admin/fijas', { admin: true }),
    cambiarEstado: (id, estado) => request('/api/admin/fijas', { method: 'POST', body: { id, estado }, admin: true }),
    personas: () => request('/api/admin/respuestas', { admin: true }),
    respuestas: (correo) => request(`/api/admin/respuestas?correo=${encodeURIComponent(correo)}`, { admin: true }),
    borrarRespuestas: (correo) => request(`/api/admin/respuestas?correo=${encodeURIComponent(correo)}`, { method: 'DELETE', admin: true }),
  },
};
