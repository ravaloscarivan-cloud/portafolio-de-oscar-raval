"""Extrae el texto de un PowerPoint (.pptx) o Word (.docx), diapositiva por diapositiva.

Las diapositivas que son solo una imagen (sin texto) se guardan como PNG/JPG en la carpeta
de salida para poder leerlas visualmente. Los PDF no se procesan aquí: se leen directamente.

Uso: python -I -X utf8 scripts/extraer-documento.py <archivo> <carpeta-salida>
"""
import os
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
REL = '{http://schemas.openxmlformats.org/package/2006/relationships}'


def numero(nombre):
    return int(re.findall(r'\d+', nombre.rsplit('/', 1)[-1])[0])


def pptx(ruta, salida):
    z = zipfile.ZipFile(ruta)
    slides = sorted((n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n)), key=numero)
    for s in slides:
        n = numero(s)
        raiz = ET.fromstring(z.read(s))
        parrafos = [''.join(t.text or '' for t in p.iter(A + 't')).strip() for p in raiz.iter(A + 'p')]
        texto = [p for p in parrafos if p]
        print(f'\n--- Diapositiva {n} ---')
        print('\n'.join(texto) if texto else '(sin texto)')
        # Imágenes de la diapositiva: se exportan si la diapositiva casi no tiene texto
        rels = f'ppt/slides/_rels/slide{n}.xml.rels'
        if len(' '.join(texto)) < 40 and rels in z.namelist():
            for r in ET.fromstring(z.read(rels)).iter(REL + 'Relationship'):
                if r.get('Type', '').endswith('/image'):
                    origen = os.path.normpath(os.path.join('ppt/slides', r.get('Target'))).replace('\\', '/')
                    ext = os.path.splitext(origen)[1].lower()
                    if ext in ('.png', '.jpg', '.jpeg') and origen in z.namelist():
                        destino = os.path.join(salida, f'diapositiva-{n:02d}{ext}')
                        with open(destino, 'wb') as f:
                            f.write(z.read(origen))
                        print(f'[imagen guardada: {destino}]')


def docx(ruta):
    z = zipfile.ZipFile(ruta)
    raiz = ET.fromstring(z.read('word/document.xml'))
    for p in raiz.iter(W + 'p'):
        t = ''.join(x.text or '' for x in p.iter(W + 't')).strip()
        if t:
            print(t)


if __name__ == '__main__':
    ruta, salida = sys.argv[1], sys.argv[2]
    os.makedirs(salida, exist_ok=True)
    ext = os.path.splitext(ruta)[1].lower()
    if ext == '.pptx':
        pptx(ruta, salida)
    elif ext == '.docx':
        docx(ruta)
    else:
        sys.exit(f'Formato no soportado por el extractor: {ext}')
