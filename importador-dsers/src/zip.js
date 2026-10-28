// Crea un .zip sin compresión (método "store") a partir de archivos de texto.
// Alcanza para empaquetar la extensión y descargarla desde cualquier dispositivo.

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// archivos: [{ nombre: 'carpeta/archivo.js', texto: '...' }]
export function crearZip(archivos) {
  const enc = new TextEncoder();
  const partes = [];
  const central = [];
  let desplazamiento = 0;

  for (const { nombre, texto } of archivos) {
    const nombreBytes = enc.encode(nombre);
    const datos = enc.encode(texto);
    const crc = crc32(datos);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, 0, true); // sin compresión
    local.setUint32(14, crc, true);
    local.setUint32(18, datos.length, true);
    local.setUint32(22, datos.length, true);
    local.setUint16(26, nombreBytes.length, true);
    partes.push(local, nombreBytes, datos);

    const cab = new DataView(new ArrayBuffer(46));
    cab.setUint32(0, 0x02014b50, true);
    cab.setUint16(4, 20, true);
    cab.setUint16(6, 20, true);
    cab.setUint32(16, crc, true);
    cab.setUint32(20, datos.length, true);
    cab.setUint32(24, datos.length, true);
    cab.setUint16(28, nombreBytes.length, true);
    cab.setUint32(42, desplazamiento, true);
    central.push(cab, nombreBytes);

    desplazamiento += 30 + nombreBytes.length + datos.length;
  }

  const tamCentral = central.reduce((t, p) => t + p.byteLength, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, desplazamiento, true);

  return new Blob([...partes, ...central, fin], { type: 'application/zip' });
}
