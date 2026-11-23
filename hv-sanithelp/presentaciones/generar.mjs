// Genera las diapositivas de Inducción general (PDF 16:9) a partir de contenido.mjs.
// Las fotos de presentaciones/img se incrustan dentro de cada PDF, así se ven en cualquier
// servidor (Vercel incluido) sin depender de enlaces externos.
//
// Uso: npm run build:diapositivas   (requiere Google Chrome instalado)
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as icons from 'lucide-react'
import { chromium } from 'playwright-core'
import { PRESENTACIONES } from './contenido.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const IMG_DIR = resolve(ROOT, 'presentaciones/img')
const OUT_DIR = resolve(ROOT, 'public/induccion-general')
const ONLY = process.argv[2]
const STYLES_PATH = resolve(ROOT, 'presentaciones/estilos.css')

const escape = (value = '') => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function icon(name, size = 26) {
  const Icon = icons[name]
  if (!Icon) throw new Error(`Ícono no encontrado: ${name}`)
  return renderToStaticMarkup(createElement(Icon, { size, strokeWidth: 1.9, 'aria-hidden': true }))
}

const imageCache = new Map()
async function image(name) {
  if (!imageCache.has(name)) {
    const bytes = await readFile(resolve(IMG_DIR, name))
    imageCache.set(name, `data:image/jpeg;base64,${bytes.toString('base64')}`)
  }
  return imageCache.get(name)
}


function footer(deck, page, total) {
  return `<div class="footer"><div class="doc"><img src="${deck.logo}" alt=""><span>${escape(deck.codigo)} · ${escape(deck.titulo)}</span></div><div class="page">${page} / ${total}</div></div>`
}

const RENDERERS = {
  async portada(s, deck) {
    return `<section class="slide cover ${deck.titulo.length > 34 ? 'long' : ''}"><div class="accent"></div>
      <div class="content">
        <img class="logo" src="${deck.logo}" alt="SanitHelp">
        <div class="kicker">Inducción general · Gestión Humana</div>
        <h1>${escape(deck.titulo)}</h1>
        <p class="sub">${escape(s.subtitulo)}</p>
        <span class="code">${escape(deck.codigo)}</span>
        <div class="datos">${s.datos.map(([k, v]) => `<div><small>${escape(k)}</small><strong>${escape(v)}</strong></div>`).join('')}</div>
      </div>
      <div class="photo" style="background-image:url('${await image(s.imagen)}')"></div>
    </section>`
  },
  async mensaje(s, deck, page, total) {
    return `<section class="slide message">
      <div class="photo" style="background-image:url('${await image(s.imagen)}')"></div>
      <div class="content">
        <div class="kicker">${escape(s.kicker)}</div>
        <div class="mark">“</div>
        <p class="frase">${escape(s.frase)}</p>
        <p class="texto">${escape(s.texto)}</p>
      </div>${footer(deck, page, total)}</section>`
  },
  async tarjetas(s, deck, page, total) {
    return `<section class="slide"><div class="accent"></div><div class="inner">
      <div class="kicker">${escape(s.kicker)}</div><h2>${escape(s.titulo)}</h2>
      <div class="body"><div class="cards n${s.tarjetas.length}">${s.tarjetas.map((t) => `<div class="card"><div class="ico"${t.color ? ` style="background:${t.color};color:${t.colorIcono || '#fff'}"` : ''}>${icon(t.icono, s.tarjetas.length > 4 ? 26 : 30)}</div><h3>${escape(t.titulo)}</h3><p>${escape(t.texto)}</p></div>`).join('')}</div>
      ${s.nota ? `<div class="nota">${icon('BookOpen', 24)}${escape(s.nota)}</div>` : ''}</div>
    </div>${footer(deck, page, total)}</section>`
  },
  async lista(s, deck, page, total) {
    return `<section class="slide list"><div class="accent"></div><div class="inner">
      <div class="kicker">${escape(s.kicker)}</div><h2>${escape(s.titulo)}</h2>
      <div class="body"><div class="items n${s.items.length}">${s.items.map((item, index) => `<div class="item"><span class="num">${index + 1}</span><div><h3>${escape(item.titulo)}</h3><p>${escape(item.texto)}</p></div></div>`).join('')}</div>
      ${s.alerta ? `<div class="alerta">${icon('TriangleAlert', 22)}${escape(s.alerta)}</div>` : ''}</div>
    </div><div class="photo" style="background-image:url('${await image(s.imagen)}')"></div>${footer(deck, page, total)}</section>`
  },
  async pasos(s, deck, page, total) {
    return `<section class="slide"><div class="accent"></div><div class="inner">
      <div class="kicker">${escape(s.kicker)}</div><h2>${escape(s.titulo)}</h2>
      <div class="body"><div class="steps n${s.pasos.length}" style="grid-template-columns:repeat(${s.pasos.length}, 1fr)">${s.pasos.map((p, index) => `<div class="step"><span class="num">${index + 1}</span><h3>${escape(p.titulo)}</h3><p>${escape(p.texto)}</p></div>`).join('')}</div>
      ${s.nota ? `<div class="nota">${icon('Info', 24)}${escape(s.nota)}</div>` : ''}</div>
    </div>${footer(deck, page, total)}</section>`
  },
  async definicion(s, deck, page, total) {
    return `<section class="slide"><div class="accent"></div><div class="inner">
      <div class="kicker">${escape(s.kicker)}</div><h2>${escape(s.titulo)}</h2>
      <div class="body"><blockquote class="definition">${escape(s.frase)}</blockquote>
      ${s.nota ? `<div class="nota">${icon('BookOpen', 24)}${escape(s.nota)}</div>` : ''}</div>
    </div>${footer(deck, page, total)}</section>`
  },
  async normas(s, deck, page, total) {
    return `<section class="slide"><div class="accent"></div><div class="inner">
      <div class="kicker">${escape(s.kicker)}</div><h2>${escape(s.titulo)}</h2>
      <div class="body"><div class="normas">${s.normas.map((n) => `<div class="norma">${icon('Scale', 24)}${escape(n)}</div>`).join('')}</div></div>
    </div>${footer(deck, page, total)}</section>`
  },
  async servicios(s, deck, page, total) {
    return `<section class="slide services"><div class="accent"></div><div class="inner">
      <div class="kicker">${escape(s.kicker)}</div><h2>${escape(s.titulo)}</h2>
      <div class="body"><div class="wrap"><p class="texto">${escape(s.texto)}</p>
        <div class="tiles">${s.servicios.map((x) => `<div class="tile">${icon(x.icono, 36)}<p>${escape(x.texto)}</p></div>`).join('')}</div></div>
      <div class="nota">${icon('Users', 24)}${escape(s.nota)}</div></div>
    </div>${footer(deck, page, total)}</section>`
  },
  async documento(s, deck, page, total) {
    return `<section class="slide"><div class="accent"></div><div class="inner">
      <div class="kicker">${escape(s.kicker)}</div><h2>${escape(s.titulo)}</h2>
      <div class="body"><div class="tables">
        <div><h3>Responsables</h3><table><tr><th>Etapa</th><th>Responsable</th><th>Fecha</th></tr>${s.responsables.map((r) => `<tr>${r.map((c) => `<td>${escape(c)}</td>`).join('')}</tr>`).join('')}</table></div>
        <div><h3>Control de cambios</h3><table><tr><th>Cambio</th><th>Versión</th><th>Aprobación</th></tr>${s.cambios.map((r) => `<tr>${r.map((c) => `<td>${escape(c)}</td>`).join('')}</tr>`).join('')}</table></div>
      </div></div>
    </div>${footer(deck, page, total)}</section>`
  },
  async cierre(s, deck) {
    return `<section class="slide closing">
      <div class="photo" style="background-image:url('${await image(s.imagen)}')"></div><div class="shade"></div><div class="accent"></div>
      <div class="content">
        <img class="logo" src="${deck.logo}" alt="SanitHelp">
        <div class="kicker">${escape(deck.codigo)} · ${escape(deck.titulo)}</div>
        <h2>${escape(s.titulo)}</h2>
        <p>${escape(s.texto)}</p>
        <div class="firma"><strong>${escape(s.firma.nombre)}</strong><span>${escape(s.firma.cargo)}</span></div>
      </div>
    </section>`
  },
}

async function buildHtml(deck, styles) {
  const total = deck.diapositivas.length
  const slides = []
  for (const [index, slide] of deck.diapositivas.entries()) {
    const render = RENDERERS[slide.tipo]
    if (!render) throw new Error(`Tipo de diapositiva desconocido: ${slide.tipo}`)
    slides.push(await render(slide, deck, index + 1, total))
  }
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escape(deck.titulo)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap" rel="stylesheet">
    <style>${styles}</style></head><body>${slides.join('\n')}</body></html>`
}

async function main() {
  const logoBytes = await readFile(resolve(ROOT, 'src/assets/logo_sanithelp.png'))
  const logo = `data:image/png;base64,${logoBytes.toString('base64')}`
  const styles = await readFile(STYLES_PATH, 'utf8')
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    for (const deck of PRESENTACIONES.filter((item) => !ONLY || item.archivo.includes(ONLY))) {
      const html = await buildHtml({ ...deck, logo }, styles)
      if (process.env.HTML) await writeFile(resolve(process.env.HTML, deck.archivo.replace('.pdf', '.html')), html)
      await page.setContent(html, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      await page.pdf({
        path: resolve(OUT_DIR, deck.archivo),
        width: '1280px',
        height: '720px',
        printBackground: true,
        preferCSSPageSize: true,
      })
      console.log(`✓ ${deck.archivo} (${deck.diapositivas.length} diapositivas)`)
    }
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
