// Inicio de sesión automático en DSers: si aparece la pantalla de login y en este Chrome hay una cuenta
// guardada (desde el panel, solo el admin), llena correo y contraseña y entra. La cuenta vive solo en
// chrome.storage.local de este equipo; no está en el código de la app ni de la extensión.

const INTENTO_KEY = 'prh-dsers-login-intento';

const visible = (el) => el && el.offsetParent !== null && !el.disabled;

// Escribe en un input de React/Vue para que el formulario detecte el valor.
function escribir(input, valor) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  input.focus();
  setter.call(input, valor);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
}

function buscarCampos() {
  const clave = [...document.querySelectorAll('input[type="password"]')].find(visible);
  if (!clave) return null;
  const textos = [...document.querySelectorAll('input:not([type]), input[type="email"], input[type="text"]')].filter(visible);
  const correo = textos.find((i) => /mail|correo|account|user/i.test(`${i.type} ${i.name} ${i.id} ${i.placeholder} ${i.autocomplete}`))
    || textos.find((i) => clave.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_PRECEDING);
  return correo ? { correo, clave } : null;
}

function botonEntrar(clave) {
  const zona = clave.closest('form') || document;
  const botones = [...zona.querySelectorAll('button, input[type="submit"]')].filter(visible);
  return botones.find((b) => b.type === 'submit')
    || botones.find((b) => /log\s*in|sign\s*in|iniciar|entrar|acceder/i.test(b.textContent || b.value || ''));
}

async function intentar() {
  const campos = buscarCampos();
  if (!campos) return false;
  // Un solo intento por minuto: si la cuenta está mal no se queda en bucle.
  const ultimo = Number(sessionStorage.getItem(INTENTO_KEY) || 0);
  if (Date.now() - ultimo < 60000) return true;
  const { dsersCuenta } = await chrome.storage.local.get('dsersCuenta');
  if (!dsersCuenta?.correo || !dsersCuenta?.clave) return true;
  sessionStorage.setItem(INTENTO_KEY, String(Date.now()));
  escribir(campos.correo, dsersCuenta.correo);
  escribir(campos.clave, dsersCuenta.clave);
  setTimeout(() => {
    const boton = botonEntrar(campos.clave);
    if (boton) boton.click();
    else campos.clave.closest('form')?.requestSubmit();
  }, 400);
  return true;
}

// DSers carga el formulario después (es una app de una sola página): se revisa un rato.
let vueltas = 0;
const revisar = setInterval(async () => {
  vueltas += 1;
  if ((await intentar()) || vueltas > 60) clearInterval(revisar);
}, 500);
