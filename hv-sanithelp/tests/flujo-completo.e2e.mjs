// Prueba de punta a punta: Sección 1 (HV), Sección 2 (soportes), constancia de inducción,
// evaluaciones pre y pos de Inducción general y Terminar.
// Comprueba que "Tu avance" sube 1/3 → 2/3 → 3/3, que el avance sobrevive a una recarga
// y que la constancia queda al principio del PDF de respuesta de esa persona.
//
// Uso: con `npm run dev` corriendo, ejecutar `npm run test:e2e`.
// El resultado se queda guardado en Resultados (data/personas.json y data/pdfs).
// Con BASE_URL apuntando al sitio publicado, los resultados se leen por la API con la clave
// (RESULTS_ACCESS_KEY); la base de respuestas se revisa aparte en el almacén Blob.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { EVALUACIONES } from '../src/evaluaciones.js'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const FIXTURES = resolve(ROOT, 'tests/fixtures')
const BROWSER_CHANNEL = process.env.BROWSER_CHANNEL || 'chrome'
// HEADED=1 abre el navegador visible, maximizado y más lento, para seguir la prueba con los ojos.
const HEADED = process.env.HEADED === '1'
const REMOTE = !/localhost|127\.0\.0\.1/.test(BASE_URL)
// En local, la clave de desarrollo de vite.config.js; contra el sitio publicado, RESULTS_ACCESS_KEY.
const ACCESS_KEY = process.env.RESULTS_ACCESS_KEY || 'clave-local'

async function readPeople() {
  if (!REMOTE) return JSON.parse(await readFile(resolve(ROOT, 'data/personas.json'), 'utf8'))
  const response = await fetch(`${BASE_URL}/api/people`, { headers: { 'x-access-key': ACCESS_KEY } })
  if (!response.ok) throw new Error(`No se pudo leer /api/people (${response.status})`)
  return response.json()
}

async function readResultPdf(id) {
  if (!REMOTE) return readFile(resolve(ROOT, 'data/pdfs', `${id}.pdf`))
  const response = await fetch(`${BASE_URL}/api/people/${id}/pdf`, { headers: { 'x-access-key': ACCESS_KEY } })
  if (!response.ok) throw new Error(`No se pudo leer el PDF (${response.status})`)
  return new Uint8Array(await response.arrayBuffer())
}

const PERSON = {
  firstName: 'Prueba',
  lastName: 'Automatizada',
  idNumber: '1098765432',
  role: 'Auxiliar de enfermería',
  email: 'prueba.automatizada@sanithelp.test',
}

function check(condition, message) {
  if (!condition) throw new Error(`FALLÓ: ${message}`)
  console.log(`  ✓ ${message}`)
}

async function makePdf(filename, title) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  pdf.addPage([595.28, 841.89]).drawText(title, { x: 60, y: 760, size: 22, font })
  const path = resolve(FIXTURES, filename)
  await writeFile(path, await pdf.save())
  return path
}

async function progressText(page) {
  return (await page.locator('.sidebar-progress-head strong').textContent()).trim()
}

async function expectProgress(page, expected, message) {
  await page.waitForFunction(
    (value) => document.querySelector('.sidebar-progress-head strong')?.textContent.trim() === value,
    expected,
    { timeout: 15000 },
  )
  check((await progressText(page)) === expected, `${message} (Tu avance = ${expected})`)
  if (HEADED) await highlightProgress(page, `${message}: Tu avance ${expected}`)
}

// Muestra arriba de la página un aviso con lo que está haciendo la prueba (solo con HEADED=1).
async function showBanner(page, text) {
  await page.evaluate((message) => {
    let banner = document.getElementById('prueba-aviso')
    if (!banner) {
      banner = document.createElement('div')
      banner.id = 'prueba-aviso'
      Object.assign(banner.style, {
        position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 99999,
        padding: '10px 20px', borderRadius: '999px', background: '#17325b', color: '#fff',
        font: '600 15px Inter, Segoe UI, sans-serif', boxShadow: '0 6px 20px rgba(0,0,0,.25)', pointerEvents: 'none',
      })
      document.body.appendChild(banner)
    }
    banner.textContent = message
  }, text)
}

async function step(page, title) {
  console.log(title)
  if (HEADED) {
    await showBanner(page, title)
    await page.waitForTimeout(1200)
  }
}

// Resalta el recuadro "Tu avance" y hace una pausa para que se vea el cambio.
async function highlightProgress(page, text) {
  await showBanner(page, text)
  const panel = page.locator('.sidebar-progress')
  await panel.scrollIntoViewIfNeeded()
  await panel.evaluate((element) => {
    element.style.transition = 'box-shadow .2s, outline-color .2s'
    element.style.outline = '4px solid #f59e0b'
    element.style.outlineOffset = '3px'
    element.style.boxShadow = '0 0 0 10px rgba(245, 158, 11, .25)'
  })
  await page.waitForTimeout(2500)
  await panel.evaluate((element) => {
    element.style.outline = ''
    element.style.boxShadow = ''
  })
}

function field(page, label, nth = 0) {
  return page.locator('.form-field')
    .filter({ has: page.locator('span', { hasText: new RegExp(`^${label.replace(/[()?¿]/g, '\\$&')}$`) }) })
    .nth(nth)
    .locator('input')
}

// Responde el examen abierto eligiendo, en cada pregunta, la opción que devuelve `pick`.
async function answerEvaluation(page, documentId, pick) {
  const form = page.locator('form.evaluacion')
  await form.waitFor()
  for (const pregunta of EVALUACIONES[documentId]) {
    const fieldset = form.locator('fieldset').filter({ has: page.locator('legend', { hasText: pregunta.pregunta }) })
    await fieldset.locator('label').filter({ has: page.getByText(pick(pregunta), { exact: true }) }).click()
  }
  await form.locator('button[type="submit"]').click()
  await form.waitFor({ state: 'detached' })
}

async function openSection(page, label) {
  await page.locator('.menu-item').filter({ has: page.locator('strong').getByText(label, { exact: true }) }).click()
}

async function main() {
  await mkdir(FIXTURES, { recursive: true })
  const cvPdf = await makePdf('hoja-de-vida-personal.pdf', 'Hoja de vida personal - Prueba Automatizada')
  const idPdf = await makePdf('cedula.pdf', 'Cedula ampliada - Prueba Automatizada')
  const contractPdf = await makePdf('contrato.pdf', 'Contrato - Prueba Automatizada')

  const peopleBefore = await readPeople()
  const browser = await chromium.launch({
    channel: BROWSER_CHANNEL,
    headless: !HEADED,
    slowMo: HEADED ? 60 : 0,
    args: HEADED ? ['--start-maximized'] : [],
  })
  // Visible: la ventana toma el tamaño de la pantalla para que "Tu avance" no quede por fuera.
  const context = await browser.newContext({ viewport: HEADED ? null : { width: 1360, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', (error) => console.error('Error en la página:', error.message))

  try {
    await page.goto(BASE_URL)
    await step(page, 'Inicio')
    await expectProgress(page, '0 / 4', 'Registro nuevo empieza sin avance')

    await step(page, 'Sección 1 — Formato HV')
    await field(page, 'Fecha de actualización').fill('2026-10-01')
    await field(page, 'Cargo').fill(PERSON.role)
    await field(page, 'Dependencia').fill('Gestión Humana')
    await field(page, 'Apellidos').fill(PERSON.lastName)
    await field(page, 'Nombres').fill(PERSON.firstName)
    await field(page, 'Documento de identidad').fill(PERSON.idNumber)
    await field(page, 'Lugar de expedición').fill('Bucaramanga')
    await field(page, 'Dirección de domicilio').fill('Calle 10 # 20-30')
    await field(page, 'Barrio').fill('Centro')
    await field(page, 'Ciudad o municipio').fill('Bucaramanga')
    await field(page, 'Celular').fill('3001234567')
    await field(page, 'Correo personal').fill(PERSON.email)
    await field(page, 'Estado civil').fill('Soltero(a)')
    await field(page, 'Fecha de nacimiento').fill('1995-05-20')
    await field(page, 'Profesión').fill('Auxiliar de enfermería')
    await field(page, 'Años de experiencia').fill('5')
    await field(page, 'Socio(a) a').fill('Clínica Prueba S.A.S.')
    await field(page, 'EPS').fill('Nueva EPS')
    await field(page, 'ARL').fill('Sura')
    await field(page, 'Firma').fill('Prueba Automatizada')
    await expectProgress(page, '0 / 4', 'Llenar sin guardar todavía no suma')

    await page.getByRole('button', { name: 'Guardar' }).click()
    await page.locator('.workflow-message.success').waitFor({ timeout: 60000 })
    await expectProgress(page, '1 / 4', 'Guardar la HV completa la Sección 1')

    // El avance es de esta persona y sobrevive a una recarga.
    await page.waitForTimeout(800)
    await page.reload()
    await expectProgress(page, '1 / 4', 'Tras recargar se conserva la Sección 1')
    await page.waitForFunction(() => [...document.querySelectorAll('.form-field')]
      .some((item) => item.querySelector('span')?.textContent === 'Nombres' && item.querySelector('input')?.value === 'Prueba'))
    check(await field(page, 'Documento de identidad').inputValue() === PERSON.idNumber, 'Tras recargar se recuperan los datos escritos en la HV')

    await step(page, 'Sección 2 — HV y soportes')
    await openSection(page, 'HV y soportes')
    const rows = page.locator('.support-row')
    const rowFor = (label) => rows.filter({ hasText: label })
    await rowFor('Subir hoja de vida personal').locator('input[type="file"]').setInputFiles(cvPdf)
    await rowFor('Fotocopia ampliada de la cédula').locator('input[type="file"]').setInputFiles(idPdf)
    await rowFor('Copia del contrato').locator('input[type="file"]').setInputFiles(contractPdf)
    await rowFor('Copia del contrato').locator('.attached-file').waitFor()
    await expectProgress(page, '1 / 4', 'Soportes a medias no completan la Sección 2')

    const pending = await rows.evaluateAll((items) => items
      .filter((item) => !item.classList.contains('is-attached') && !item.classList.contains('is-skipped'))
      .map((item) => item.querySelector('h2').textContent))
    for (const label of pending) {
      await rowFor(label).locator('.not-applicable input').check()
    }
    check((await page.locator('.support-count').textContent()).includes('11 / 11'), 'Los 11 soportes quedan adjuntos o como no aplica')
    await expectProgress(page, '2 / 4', 'Sección 2 completa')

    await step(page, 'Inducción — Constancia')
    await openSection(page, 'Inducción')
    const [constanciaPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('a.induction-open-link').click(),
    ])
    await constanciaPage.waitForLoadState()
    check(constanciaPage.url().includes('registro='), 'El enlace de la constancia lleva el registro de esta persona')
    const nombres = constanciaPage.getByLabel('Nombres')
    await nombres.waitFor()
    check(await nombres.inputValue() === PERSON.firstName, 'La constancia se precarga con los nombres de la HV')
    check(await constanciaPage.getByLabel('Cédula').inputValue() === PERSON.idNumber, 'La constancia se precarga con la cédula de la HV')
    check(await constanciaPage.getByLabel('Correo electrónico').inputValue() === PERSON.email, 'La constancia se precarga con el correo de la HV')

    for (const checkbox of await constanciaPage.locator('.ci-check input[type="checkbox"]').all()) {
      await checkbox.check()
    }
    await constanciaPage.getByLabel('Comentarios').fill('Prueba automatizada del flujo completo.')
    const canvas = constanciaPage.locator('.signature-pad canvas')
    await canvas.scrollIntoViewIfNeeded()
    const box = await canvas.boundingBox()
    await constanciaPage.mouse.move(box.x + 40, box.y + box.height * 0.6)
    await constanciaPage.mouse.down()
    for (let step = 1; step <= 24; step += 1) {
      await constanciaPage.mouse.move(
        box.x + 40 + step * 14,
        box.y + box.height * (0.6 - 0.25 * Math.sin(step / 3)),
      )
    }
    await constanciaPage.mouse.up()
    await constanciaPage.getByRole('button', { name: 'Enviar' }).click()
    await constanciaPage.locator('.ci-success').waitFor({ timeout: 60000 })
    check(true, 'Constancia enviada')

    await page.bringToFront()
    await expectProgress(page, '3 / 4', 'La constancia de inducción firmada suma sin recargar')
    await constanciaPage.close()
    check((await page.locator('.induction-status.done').textContent()).includes('Prueba Automatizada'), 'Inducción muestra la constancia de esta persona')

    await step(page, 'Inducción general — Pre-test, pos-test y constancia de evaluaciones')
    // Sin la constancia de los test, Terminar no deja avanzar y lleva a Inducción general.
    await openSection(page, 'HV y soportes')
    await page.getByRole('button', { name: 'Terminar' }).click()
    await page.locator('.workflow-message.error', { hasText: 'constancia de evaluaciones' }).waitFor()
    check(await page.locator('.general-induction').count() === 1, 'Terminar sin la constancia de los test lleva a Inducción general')
    await expectProgress(page, '3 / 4', 'Sin la constancia de los test el avance queda en 3 de 4')
    const documentIds = Object.keys(EVALUACIONES)
    const constanciaItem = page.locator('.general-document-constancia')
    check((await constanciaItem.textContent()).includes('Bloqueada · 0 de 5'), 'La constancia de evaluaciones empieza bloqueada')
    await constanciaItem.click()
    check(await page.locator('.constancia-evaluaciones button[type="submit"]').isDisabled(), 'El formulario bloqueado no deja enviar')

    for (const [index, documentId] of documentIds.entries()) {
      await page.locator('.general-document').nth(index).click()
      check(await page.locator('.general-induction-pdf').count() === 0, `${documentId}: la presentación se bloquea hasta hacer el pre-test`)
      await answerEvaluation(page, documentId, (pregunta) => pregunta.opciones[1])
      await page.locator('.general-induction-pdf').waitFor()
      const preFeedback = await page.locator('.evaluation-feedback').textContent()
      check(preFeedback.includes('Pre-test enviado') && !/\d\/\d/.test(preFeedback), `${documentId}: pre-test enviado sin puntaje`)

      await page.getByRole('button', { name: 'Presentar pos-test' }).click()
      await answerEvaluation(page, documentId, (pregunta) => pregunta.opciones[0])
      const isLast = index === documentIds.length - 1
      if (!isLast) {
        check((await page.locator('.evaluation-feedback').textContent()).includes('Pos-test enviado'), `${documentId}: pos-test enviado, política completada`)
        check(await page.getByRole('button', { name: 'Enviar', exact: true }).count() === 0, `${documentId}: aún no aparece el botón Enviar`)
        check((await constanciaItem.textContent()).includes(`Bloqueada · ${index + 1} de ${documentIds.length}`), `${documentId}: la constancia sigue bloqueada (${index + 1} de ${documentIds.length})`)
      }
    }

    check((await page.locator('.evaluation-feedback').textContent()).includes('Completaste el pre-test y el pos-test de todas las políticas'), 'Al terminar el último pos-test se avisa que se completó todo')
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    const constanciaForm = page.locator('form.constancia-evaluaciones')
    await constanciaForm.waitFor()
    check(!(await constanciaForm.locator('button[type="submit"]').isDisabled()), 'El botón Enviar lleva a la constancia, ya desbloqueada')
    check(await constanciaForm.getByLabel('Cédula').inputValue() === PERSON.idNumber, 'La constancia de evaluaciones se precarga con la cédula de la HV')
    await constanciaForm.locator('.constancia-evaluaciones-declara input').check()
    const firma = constanciaForm.locator('.signature-pad canvas')
    await firma.scrollIntoViewIfNeeded()
    const firmaBox = await firma.boundingBox()
    await page.mouse.move(firmaBox.x + 40, firmaBox.y + firmaBox.height * 0.6)
    await page.mouse.down()
    for (let step = 1; step <= 20; step += 1) {
      await page.mouse.move(firmaBox.x + 40 + step * 14, firmaBox.y + firmaBox.height * (0.6 - 0.25 * Math.sin(step / 3)))
    }
    await page.mouse.up()
    await constanciaForm.getByRole('button', { name: 'Enviar constancia' }).click()
    await page.locator('.constancia-evaluaciones .evaluation-feedback.ok').waitFor()
    check((await constanciaItem.textContent()).includes('Enviada'), 'Constancia de evaluaciones enviada')
    check(await page.locator('.menu-item.done').filter({ hasText: 'Inducción general' }).count() === 1, 'Enviar la constancia marca Inducción general como completada')
    await expectProgress(page, '4 / 4', 'Enviar la constancia de los test completa Tu avance')

    await step(page, 'Terminar')
    await openSection(page, 'HV y soportes')
    await page.getByRole('button', { name: 'Terminar' }).click()
    await page.locator('.workflow-message.success', { hasText: 'Proceso terminado' }).waitFor({ timeout: 60000 })
    check(true, 'Proceso terminado y resultado guardado')
    await expectProgress(page, '0 / 4', 'Al terminar se empieza un registro nuevo para la siguiente persona')

    const peopleAfter = await readPeople()
    const saved = peopleAfter.find((person) => !peopleBefore.some((before) => before.id === person.id))
    check(saved?.name === 'Prueba Automatizada', `Resultado guardado en ${REMOTE ? 'el almacén de Vercel' : 'data/personas.json'} (${saved?.id})`)

    if (!REMOTE) {
    const { respuestas } = JSON.parse(await readFile(resolve(ROOT, 'data/respuestas.json'), 'utf8'))
    const respuesta = respuestas.find((document) => document.resultadoId === saved.id)
    check(respuesta?.procesoCompleto === true, 'La respuesta queda en data/respuestas.json ligada a su resultado')
    check(/^\d{2,}$/.test(respuesta._id), `Base de respuestas: número de participante consecutivo (${respuesta._id})`)
    check(respuesta.nombre === PERSON.firstName && respuesta.apellido === PERSON.lastName, 'Base de respuestas: nombre y apellido')
    check(respuesta.telefono === '3001234567', 'Base de respuestas: teléfono (celular)')
    check(respuesta.correo === PERSON.email, 'Base de respuestas: correo')
    check(respuesta.empresa === 'Clínica Prueba S.A.S.', 'Base de respuestas: empresa')
    check(Object.keys(respuesta).sort().join() === '_id,actualizadoEn,apellido,completadoEn,constanciaEvaluaciones,correo,empresa,evaluaciones,nombre,pasos,pdfUrl,procesoCompleto,resultadoId,telefono',
      'Base de respuestas: solo guarda los campos pedidos, las evaluaciones y su constancia')
    check(respuesta.evaluaciones.length === 5 && respuesta.evaluaciones.every((e) => e.pre === 'Completado' && e.pos === 'Completado' && Object.keys(e).length === 4),
      'Base de respuestas: pre y pos completados en las 5 políticas, sin puntaje')
    check(respuesta.constanciaEvaluaciones.firmada === true && respuesta.constanciaEvaluaciones.cedula === PERSON.idNumber,
      'Base de respuestas: constancia de evaluaciones firmada')
    }

    const resultPdfBytes = await readResultPdf(saved.id)
    const resultPdf = await PDFDocument.load(resultPdfBytes)
    // Constancia de inducción (1) + constancia de evaluaciones (1) + HV formato (1 + continuación con los
    // textos largos) + 3 soportes adjuntos (1 c/u).
    check(resultPdf.getPageCount() === 7, `PDF de respuesta con constancia + constancia de evaluaciones + HV + soportes (${resultPdf.getPageCount()} páginas)`)
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const pdfText = await pdfjs.getDocument({ data: new Uint8Array(resultPdfBytes).slice() }).promise
    const secondPageText = (await (await pdfText.getPage(2)).getTextContent()).items.map((item) => item.str).join(' ')
    check(secondPageText.includes('Constancia de evaluaciones') && secondPageText.includes(PERSON.idNumber) && secondPageText.includes('PL-GH-006'),
      'La segunda página, debajo de la constancia de inducción, es la constancia de evaluaciones, con la cédula y las políticas')
    check((secondPageText.match(/Completado/g) || []).length === 10, 'La constancia de evaluaciones muestra pre y pos completados en las 5 políticas')
    const firstPage = resultPdf.getPage(0)
    check(Math.round(firstPage.getWidth()) === 595 || Math.round(firstPage.getWidth()) === 596, 'La constancia va en la primera página (A4)')

    await page.screenshot({ path: resolve(FIXTURES, 'resultado-final.png') })
    if (HEADED) {
      await showBanner(page, 'Prueba completa: todo correcto')
      await page.waitForTimeout(3000)
    }
    console.log('\nPrueba completa: todo correcto.')
  } catch (error) {
    await page.screenshot({ path: resolve(FIXTURES, 'error.png') }).catch(() => {})
    throw error
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
