// Reescribe un producto importado de AliExpress al estilo de la tienda: nombre breve,
// descripción en español con la misma estructura que los productos ya publicados.
// Gemini (plan gratis de Google AI Studio, GEMINI_API_KEY) devuelve los textos en JSON y aquí se arma
// el HTML, así todos quedan con el mismo formato.
const MODELOS = [process.env.GEMINI_MODEL || 'gemini-flash-latest', 'gemini-flash-lite-latest'];

const ESTILO_H = 'font-family: Inter, sans-serif; font-weight: 700; color: #000000;';
const ESTILO_P = 'font-family: Inter, sans-serif; font-weight: 400; color: #333333;';

const SISTEMA = `Eres el redactor de PHRstore, una tienda online en Colombia que vende productos importados (electrónica, gaming, ropa deportiva, calzado, salud y bienestar, hogar y decoración, juguetes, belleza). Recibes los datos crudos de un producto importado de AliExpress (título y descripción normalmente en inglés, llenos de palabras clave) y devuelves los textos con los que se publica en la tienda.

Reglas de redacción:
- Todo en español neutro, natural y comercial (público colombiano). Conserva en su forma original solo marcas, modelos y términos técnicos que se usan así en el mercado (USB-C, Hot-Swap, Rapid Trigger, ANC, Bluetooth, RGB, IPS, 4K).
- Título: breve, máximo 60 caracteres. Fórmula: tipo de producto + marca + modelo + 1 o 2 atributos clave. Ejemplos reales de la tienda: "Teclado Mecánico YUNZII B75 PRO", "Monitor Portátil ARZOPA Z1C 16.1\\" FHD", "Mouse Gaming ATK A9 Ultra – Inalámbrico 8K 53g", "Corrector de Juanetes – Separador Ortopédico", "Conjunto Deportivo 3 Piezas Hombre – Secado Rápido". Si no hay marca reconocible, no inventes una ni pongas la del vendedor de AliExpress. Nada de relleno: "2026", "Nuevo", "Hot Sale", "Original", "Free Shipping", listas de compatibilidades.
- Encabezado (h2): el título ampliado con un poco más de detalle (máximo 90 caracteres).
- Intro: 2 o 3 frases. Empieza con un gancho corto que hable del beneficio para el cliente y luego explica qué es y para quién es.
- Características principales: de 4 a 8 puntos, cada uno con el formato "Atributo — beneficio concreto". Sin emojis (la tienda los agrega).
- Especificaciones técnicas: pares etiqueta/valor sacados de los datos (Marca, Modelo, Material, Tamaño, Conexión, Batería, Compatibilidad, Género, Temporada, Contenido del paquete, etc.). Cierra con "Origen": "China" si no hay otro dato.
- Guía de tallas: solo para ropa y calzado, 1 o 2 frases prácticas (ej. medir el pie de talón a punta). En otro caso, cadena vacía.
- No inventes datos: si algo no aparece en la información o en las imágenes, no lo pongas. Tampoco menciones envíos, tiempos de entrega, garantías, descuentos ni stock (ni en la descripción ni en el SEO). Convierte medidas a sistema métrico cuando venga en pulgadas o libras (las pulgadas de pantallas se dejan así).
- Productos de salud: describe el uso y la sensación de alivio o bienestar, sin prometer curas ni resultados médicos garantizados.
- Tipo de producto: usa una de estas categorías si encaja: Electrónica, Gaming, Audio, Ropa Deportiva, Ropa, Calzado, Salud y Bienestar, Belleza y Cuidado Personal, Hogar y Decoración, Iluminación, Juguetes, Bebés, Accesorios, Deportes, Mascotas, Herramientas. Si ninguna encaja, propone una corta en español.
- Handle: URL corta en español, minúsculas, palabras separadas por guiones, sin tildes ni ñ, máximo 60 caracteres.
- SEO: título de máximo 60 caracteres y descripción de 140 a 160 caracteres.
- Etiquetas: de 3 a 6, en español y minúsculas.
- Nombres de opciones: traduce cada nombre de opción de variante (Color → Color, Size → Talla, Shoe Size → Talla, Ships From → Enviado desde, Style → Estilo, Plug Type → Tipo de enchufe...).`;

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['titulo', 'encabezado', 'intro', 'caracteristicas', 'especificaciones', 'guia_tallas', 'tipo', 'handle', 'seo_titulo', 'seo_descripcion', 'etiquetas', 'opciones'],
  properties: {
    titulo: { type: 'string' },
    encabezado: { type: 'string' },
    intro: { type: 'string' },
    caracteristicas: { type: 'array', items: { type: 'string' } },
    especificaciones: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['etiqueta', 'valor'],
        properties: { etiqueta: { type: 'string' }, valor: { type: 'string' } },
      },
    },
    guia_tallas: { type: 'string' },
    tipo: { type: 'string' },
    handle: { type: 'string' },
    seo_titulo: { type: 'string' },
    seo_descripcion: { type: 'string' },
    etiquetas: { type: 'array', items: { type: 'string' } },
    opciones: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['original', 'traducido'],
        properties: { original: { type: 'string' }, traducido: { type: 'string' } },
      },
    },
  },
};

// Las descripciones de AliExpress traen sobre todo imágenes y estilos: solo interesa el texto.
function textoPlano(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

const escapar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function armarHtml(t) {
  const partes = [
    `<h2 style="${ESTILO_H}">${escapar(t.encabezado)}</h2>`,
    `<p style="${ESTILO_P}">${escapar(t.intro)}</p>`,
    `<h3 style="${ESTILO_H}">Características principales</h3>`,
    `<ul style="${ESTILO_P}">\n${t.caracteristicas.map((c) => `<li>✅ ${escapar(c)}</li>`).join('\n')}\n</ul>`,
  ];
  if (t.especificaciones.length) {
    partes.push(
      `<h3 style="${ESTILO_H}">Especificaciones técnicas</h3>`,
      `<p style="${ESTILO_P}">${t.especificaciones.map((e) => `<strong>${escapar(e.etiqueta)}:</strong> ${escapar(e.valor)}`).join('<br>')}</p>`,
    );
  }
  if (t.guia_tallas.trim()) {
    partes.push(`<h3 style="${ESTILO_H}">Guía de tallas</h3>`, `<p style="${ESTILO_P}">${escapar(t.guia_tallas)}</p>`);
  }
  return partes.join('');
}

function normalizarHandle(h) {
  return String(h).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}

// JSON Schema → formato de Gemini (tipos en mayúscula, sin additionalProperties).
function esquemaGemini(e) {
  const out = { type: String(e.type).toUpperCase() };
  if (e.properties) out.properties = Object.fromEntries(Object.entries(e.properties).map(([k, v]) => [k, esquemaGemini(v)]));
  if (e.items) out.items = esquemaGemini(e.items);
  if (e.required) out.required = e.required;
  return out;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Gemini (plan gratis): Flash y, si está saturado (503/429), Flash Lite; con reintentos.
async function pedir(partes) {
  const cuerpo = JSON.stringify({
    systemInstruction: { parts: [{ text: SISTEMA }] },
    contents: [{ role: 'user', parts: partes }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: esquemaGemini(ESQUEMA) },
  });
  let ultimo = 'sin respuesta';
  for (let intento = 0; intento < 3; intento++) {
    for (const modelo of MODELOS) {
      let r;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
          body: cuerpo,
          // Una consulta colgada no debe consumir todo el tiempo de la función (máx. 300 s).
          signal: AbortSignal.timeout(60000),
        });
      } catch (err) {
        ultimo = `sin conexión con Gemini (${err.message})`;
        continue;
      }
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) {
        ultimo = `Gemini respondió ${r.status}${datos.error?.message ? `: ${datos.error.message.slice(0, 120)}` : ''}`;
        if ([429, 500, 503].includes(r.status)) continue; // saturado: probar el respaldo
        throw new Error(ultimo);
      }
      const candidato = datos.candidates?.[0] || {};
      const texto = (candidato.content?.parts || []).map((p) => p.text || '').join('');
      if ((candidato.finishReason && candidato.finishReason !== 'STOP') || !texto) {
        ultimo = `Gemini no terminó la respuesta (${candidato.finishReason || 'vacía'})`;
        continue;
      }
      return JSON.parse(texto);
    }
    await dormir(2000 * (intento + 1));
  }
  throw new Error(`La IA no está disponible ahora mismo: ${ultimo}.`);
}

// Gemini no descarga URLs: las fotos se envían en base64.
async function fotoEnLinea(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  const tipo = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!/^image\/(jpeg|png|webp)$/.test(tipo)) return null;
  return { inline_data: { mime_type: tipo, data: Buffer.from(await r.arrayBuffer()).toString('base64') } };
}

// producto: { title, descriptionHtml, vendor, productType, options: [{ name, optionValues: [{ name }] }], imagenes: [url], precio }
export async function redactar(producto) {
  const datos = [
    `Título original: ${producto.title}`,
    `Proveedor: ${producto.vendor || '-'}`,
    `Precio de venta: ${producto.precio || '-'}`,
    `Opciones de variante:\n${(producto.options || []).map((o) => `- ${o.name}: ${o.optionValues.map((v) => v.name).slice(0, 30).join(', ')}`).join('\n') || '-'}`,
    `Descripción original (texto):\n${textoPlano(producto.descriptionHtml).slice(0, 20000) || '-'}`,
  ].join('\n\n');
  const texto = { text: `${datos}\n\nRedacta los textos de este producto para la tienda.` };
  // Si alguna foto no se puede descargar, se sigue con las demás (o solo con el texto).
  const imagenes = (await Promise.all((producto.imagenes || []).slice(0, 3).map((url) => fotoEnLinea(url).catch(() => null)))).filter(Boolean);
  const t = await pedir([...imagenes, texto]);
  return {
    titulo: t.titulo.trim(),
    descripcionHtml: armarHtml(t),
    tipo: t.tipo.trim(),
    handle: normalizarHandle(t.handle || t.titulo),
    seo: { title: t.seo_titulo.trim(), description: t.seo_descripcion.trim() },
    etiquetas: t.etiquetas.map((e) => e.trim().toLowerCase()).filter(Boolean),
    opciones: t.opciones,
  };
}
