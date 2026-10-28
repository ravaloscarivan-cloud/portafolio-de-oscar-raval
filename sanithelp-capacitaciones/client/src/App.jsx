import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Asistencia from './pages/Asistencia.jsx';
import Capacitaciones from './pages/Capacitaciones.jsx';
import CapacitacionDetalle from './pages/CapacitacionDetalle.jsx';
import Admin from './pages/admin/Admin.jsx';

export default function App() {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="layout">
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

      <div className="contenido">
        <header className="topbar">
          <button className="btn-menu" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú">
            <span /><span /><span />
          </button>
          <span className="topbar-titulo">Gestión de Capacitaciones</span>
        </header>

        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/capacitaciones" replace />} />
            <Route path="/asistencia" element={<Asistencia />} />
            <Route path="/asistencia/:id" element={<Asistencia />} />
            <Route path="/capacitaciones" element={<Capacitaciones />} />
            <Route path="/capacitaciones/:id" element={<CapacitacionDetalle />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route path="*" element={<Navigate to="/capacitaciones" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
