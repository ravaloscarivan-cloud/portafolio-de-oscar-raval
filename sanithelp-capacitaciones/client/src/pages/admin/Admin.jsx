import { useState } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { api, sesion } from '../../api.js';
import AdminCapacitaciones from './AdminCapacitaciones.jsx';
import AdminRespuestas from './AdminRespuestas.jsx';

export default function Admin() {
  const [autenticado, setAutenticado] = useState(() => Boolean(sesion.obtener()));
  const salir = () => {
    sesion.cerrar();
    setAutenticado(false);
  };

  if (!autenticado) return <Login onEntrar={() => setAutenticado(true)} />;

  return (
    <>
      <div className="page-header page-header-flex">
        <div>
          <h1>Administrador</h1>
          <p className="muted">Descargue las respuestas de cada persona y administre qué capacitaciones ven los usuarios.</p>
        </div>
        <button className="btn btn-secundario" onClick={salir}>Cerrar sesión</button>
      </div>

      <nav className="admin-tabs">
        <NavLink to="/admin/respuestas" className={({ isActive }) => `admin-tab ${isActive ? 'activo' : ''}`}>Respuestas de usuarios</NavLink>
        <NavLink to="/admin/capacitaciones" className={({ isActive }) => `admin-tab ${isActive ? 'activo' : ''}`}>Capacitaciones</NavLink>
      </nav>

      <Routes>
        <Route index element={<Navigate to="respuestas" replace />} />
        <Route path="respuestas" element={<AdminRespuestas onSesionVencida={salir} />} />
        <Route path="capacitaciones" element={<AdminCapacitaciones onSesionVencida={salir} />} />
        <Route path="*" element={<Navigate to="respuestas" replace />} />
      </Routes>
    </>
  );
}

function Login({ onEntrar }) {
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await api.admin.entrar(contrasena);
      onEntrar();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={entrar}>
        <div className="login-icono">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>
        <h2>Acceso de administrador</h2>
        <p className="muted">Ingrese la contraseña para continuar.</p>
        <label className="campo">
          <span>Contraseña</span>
          <input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} autoFocus required autoComplete="current-password" />
        </label>
        {error && <div className="alerta alerta-error">{error}</div>}
        <button className="btn btn-primario btn-bloque" disabled={enviando}>{enviando ? 'Verificando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
