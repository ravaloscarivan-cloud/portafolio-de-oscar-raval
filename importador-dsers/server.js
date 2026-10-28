const express = require('express');
const path = require('path');
const { chromium } = require('playwright-core');

const PORT = 3000;
const DSERS_URL = 'https://www.dsers.com/application/import_list';
const ESPERA_ENTRE_LINKS_MS = 5000;
// Perfil de Chrome propio de la app: la primera vez inicias sesión en DSers y queda guardada.
const PERFIL_CHROME = path.join(__dirname, 'chrome-profile');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let context = null;
const estado = {
  corriendo: false,
  total: 0,
  actual: 0,
  log: [],
};

function log(msg) {
  const linea = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(linea);
  estado.log.push(linea);
  if (estado.log.length > 500) estado.log.shift();
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function obtenerContexto() {
  if (context) return context;
  context = await chromium.launchPersistentContext(PERFIL_CHROME, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    args: ['--start-maximized'],
  });
  context.on('close', () => { context = null; });
  return context;
}

async function abrirDsers() {
  const ctx = await obtenerContexto();
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.bringToFront();
  if (!page.url().startsWith(DSERS_URL)) {
    await page.goto(DSERS_URL, { waitUntil: 'domcontentloaded' });
  }
  return page;
}

async function buscarInput(page) {
  const selectores = [
    'input[placeholder*="DSers"]',
    'input[placeholder*="enlace"]',
    'input[placeholder*="link"]',
    'input[placeholder*="URL"]',
  ];
  for (const sel of selectores) {
    const loc = page.locator(sel).first();
    try {
      await loc.waitFor({ state: 'visible', timeout: 3000 });
      return loc;
    } catch { /* probar el siguiente */ }
  }
  return null;
}

async function importarLinks(links) {
  estado.corriendo = true;
  estado.total = links.length;
  estado.actual = 0;
  estado.log = [];
  try {
    log('Abriendo DSers...');
    const page = await abrirDsers();

    let input = await buscarInput(page);
    if (!input) {
      log('No encontré el campo de URL. Si no has iniciado sesión en DSers, hazlo en la ventana de Chrome que se abrió (tienes 3 minutos).');
      await page.locator('input[placeholder*="DSers"], input[placeholder*="enlace"]').first()
        .waitFor({ state: 'visible', timeout: 180000 });
      input = await buscarInput(page);
    }
    if (!input) throw new Error('No se encontró el campo para pegar el enlace.');

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      estado.actual = i + 1;
      log(`(${i + 1}/${links.length}) Importando: ${link}`);

      await input.click();
      await input.fill('');
      await input.fill(link);

      const botonOk = page.getByRole('button', { name: /^\s*OK\s*$/i }).first();
      await botonOk.click();
      log('  -> OK pulsado');

      if (i < links.length - 1) {
        log(`  Esperando ${ESPERA_ENTRE_LINKS_MS / 1000} segundos...`);
        await esperar(ESPERA_ENTRE_LINKS_MS);
        input = (await buscarInput(page)) || input;
      }
    }
    log('✅ Terminado: todos los links fueron enviados.');
  } catch (err) {
    log(`❌ Error: ${err.message}`);
  } finally {
    estado.corriendo = false;
  }
}

app.post('/api/importar', (req, res) => {
  if (estado.corriendo) return res.status(409).json({ error: 'Ya hay una importación en curso.' });
  const links = (req.body.links || [])
    .map((l) => String(l).trim())
    .filter((l) => /^https?:\/\/\S*aliexpress\.\S+/i.test(l));
  if (links.length === 0) return res.status(400).json({ error: 'No hay links válidos de AliExpress.' });
  importarLinks(links);
  res.json({ ok: true, total: links.length });
});

app.post('/api/abrir-dsers', async (req, res) => {
  try {
    await abrirDsers();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/estado', (req, res) => res.json(estado));

app.listen(PORT, () => {
  console.log(`App lista en http://localhost:${PORT}`);
});
