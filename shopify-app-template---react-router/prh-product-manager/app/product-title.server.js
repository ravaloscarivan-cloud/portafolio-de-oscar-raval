// Compact Spanish catalog labels live in the app database; Shopify's source title
// remains untouched. Unknown words are kept so product models/features survive.
const translations = new Map(Object.entries({
  pressure: "presión", cleaner: "hidrolavadora", washer: "lavadora", induction: "inducción",
  silicone: "silicona", children: "infantil", child: "infantil", tabletop: "mesa",
  microscope: "microscopio", digital: "digital", industrial: "industrial", camera: "cámara",
  card: "tarjeta", review: "reseñas", google: "Google", black: "negro", white: "blanco",
  premium: "", wear: "", resistant: "resistente", finish: "acabado", reusable: "reutilizable",
  tap: "contacto", nfc: "NFC", tool: "herramienta", tools: "herramientas", motorcycle: "moto",
  repair: "reparación", box: "maletín", heavy: "reforzado", duty: "", set: "kit", kit: "kit",
  wrench: "llave", socket: "dados", bra: "brasier", push: "push", up: "up", front: "frontal",
  closure: "cierre", seamless: "sin costuras", lingerie: "lencería", car: "auto", plug: "tapón",
  patch: "parche", gum: "neumático", height: "alto", custom: "personalizado", made: "",
  curtain: "cortina", curtains: "cortinas", blackout: "opaca", smartwatch: "reloj inteligente",
  smart: "inteligente", watch: "reloj", blood: "oxígeno", oxygen: "sanguíneo", inch: "pulgadas",
  ultra: "ultra", thin: "delgado", digitalcamera: "cámara digital", phone: "teléfono",
  stand: "soporte", mobile: "móvil", childrens: "infantil",
  korea: "Corea", japan: "Japón", south: "del Sur", clock: "reloj", salvador: "Salvador",
  dali: "Dalí", youth: "juvenil", edition: "edición", electric: "eléctrico", insulated: "aislado",
  screwdriver: "destornillador", screwdrivers: "destornilladores", magnetic: "magnético",
  professional: "profesional", wood: "madera", garden: "jardín", wireless: "inalámbrico",
  portable: "portátil", projector: "proyector", speaker: "altavoz",
  hair: "cabello", dryer: "secador", kitchen: "cocina", storage: "almacenamiento",
  organizer: "organizador", led: "LED", lamp: "lámpara", light: "luz", toy: "juguete",
  pet: "mascota", water: "agua", bottle: "botella", bag: "bolso", case: "estuche",
  holder: "soporte", vacuum: "aspiradora",
  "4k": "4K", "1080p": "Full HD", "100v": "100 V", "1000v": "1000 V",
}));

export function suggestSpanishTitle(title = "", vendor = "") {
  let parts = title
    .replace(/\b\d+(?:\.\d+)?\s*(?:pcs?|pieces?|set|inch|inches|cm|mm|bar)\b/gi, (m) => m.trim())
    .replace(/[|•·]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
  const vendorKey = vendor.trim().toLocaleLowerCase("es");
  if (vendorKey) parts = parts.filter((word) => word.toLocaleLowerCase("es") !== vendorKey);

  const seen = new Set();
  const result = [];
  for (const part of parts) {
    const key = part.toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]/gu, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const translated = translations.get(key) ?? part;
    if (!translated) continue;
    for (const word of translated.split(" ")) {
      if (result.length >= 6) break;
      result.push(word);
    }
    if (result.length >= 6) break;
  }
  const value = result.join(" ").replace(/\s+/g, " ").trim();
  return value ? value[0].toLocaleUpperCase("es") + value.slice(1) : title.slice(0, 56);
}

export async function syncProductTitles(prisma, shop, products) {
  if (!products.length) return new Map();
  const current = await prisma.productTitle.findMany({
    where: { shop, productGid: { in: products.map((p) => p.id) } },
  });
  const byId = new Map(current.map((row) => [row.productGid, row]));
  await prisma.$transaction(products.map((product) => {
    const existing = byId.get(product.id);
    const changedTitle = existing && existing.sourceTitle !== product.title;
    return prisma.productTitle.upsert({
      where: { shop_productGid: { shop, productGid: product.id } },
      create: {
        shop,
        productGid: product.id,
        handle: product.handle,
        sourceTitle: product.title,
        spanishTitle: suggestSpanishTitle(product.title, product.vendor),
      },
      update: {
        handle: product.handle,
        sourceTitle: product.title,
        ...(changedTitle ? { spanishTitle: suggestSpanishTitle(product.title, product.vendor) } : {}),
      },
    });
  }));
  const rows = await prisma.productTitle.findMany({
    where: { shop, productGid: { in: products.map((p) => p.id) } },
  });
  return new Map(rows.map((row) => [row.productGid, row]));
}
