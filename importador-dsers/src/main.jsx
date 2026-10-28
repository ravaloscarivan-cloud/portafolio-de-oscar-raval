import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Identidad propia de esta pestaña: el servidor la entrega en la cookie dsers_tab al abrir la página; se guarda en
// sessionStorage (solo esta pestaña) y viaja en la cabecera x-prh-token de cada llamada a /api. Así el admin y un
// invitado pueden usar el mismo navegador sin que uno reemplace la sesión del otro.
let token = null;
try {
  const m = document.cookie.match(/(?:^|; )dsers_tab=([^;]+)/);
  if (m) {
    sessionStorage.setItem('prh_token', m[1]);
    document.cookie = 'dsers_tab=; Path=/; Max-Age=0; Secure; SameSite=Strict';
  }
  token = sessionStorage.getItem('prh_token');
} catch { /* sin storage: se usa la cookie */ }
if (token) {
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = (entrada, opciones = {}) => {
    const url = typeof entrada === 'string' ? entrada : entrada?.url || '';
    if (url.startsWith('/api/') || url.startsWith(`${location.origin}/api/`)) {
      const headers = new Headers(opciones.headers || (entrada instanceof Request ? entrada.headers : undefined));
      headers.set('x-prh-token', token);
      opciones = { ...opciones, headers };
    }
    return fetchOriginal(entrada, opciones);
  };
}

createRoot(document.getElementById('root')).render(<App />);
