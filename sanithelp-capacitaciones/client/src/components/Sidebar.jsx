import { NavLink } from 'react-router-dom';
import logo from '../assets/logo_sanithelp.png';

const IconoFirma = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17c3-4 5-9 7-9s-1 9 1 9 3-5 5-5-1 5 1 5 3-2 4-3" />
    <path d="M3 21h18" />
  </svg>
);

const IconoCapacitacion = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10 12 5 2 10l10 5 10-5z" />
    <path d="M6 12v5c3 2 9 2 12 0v-5" />
  </svg>
);

const IconoAdmin = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <rect x="9" y="11" width="6" height="5" rx="1" />
    <path d="M10 11V9.5a2 2 0 0 1 4 0V11" />
  </svg>
);

const items = [
  { to: '/asistencia', texto: 'Asistencia', icono: <IconoFirma /> },
  { to: '/capacitaciones', texto: 'Capacitaciones', icono: <IconoCapacitacion /> },
];

export default function Sidebar({ abierto, onCerrar }) {
  return (
    <>
      <div className={`overlay ${abierto ? 'visible' : ''}`} onClick={onCerrar} />
      <aside className={`sidebar ${abierto ? 'abierto' : ''}`}>
        <div className="sidebar-logo">
          <img src={logo} alt="SanitHelp" />
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-seccion">Menú</span>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCerrar}
              className={({ isActive }) => `sidebar-item ${isActive ? 'activo' : ''}`}
            >
              {item.icono}
              <span>{item.texto}</span>
            </NavLink>
          ))}
        </nav>

        <NavLink
          to="/admin"
          onClick={onCerrar}
          className={({ isActive }) => `sidebar-item sidebar-admin ${isActive ? 'activo' : ''}`}
          title="Administrador"
        >
          <IconoAdmin />
          <span>Administrador</span>
        </NavLink>

        <div className="sidebar-pie">© {new Date().getFullYear()} SanitHelp</div>
      </aside>
    </>
  );
}
