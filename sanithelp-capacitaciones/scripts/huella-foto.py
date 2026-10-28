"""Huella visual (dHash de 64 bits) de cada foto: dos fotos iguales con distinto tamaño o compresión
dan huellas casi idénticas. La usan scripts/fotos.js y scripts/validar-capacitaciones.js.

Uso: python -I scripts/huella-foto.py <foto> [<foto> ...]   → una línea "<huella hex> <ruta>" por foto
"""
import sys

from PIL import Image


def huella(ruta):
    im = Image.open(ruta).convert('L').resize((9, 8), Image.LANCZOS)
    px = list(im.getdata())
    bits = 0
    for fila in range(8):
        for col in range(8):
            bits = (bits << 1) | (px[fila * 9 + col] > px[fila * 9 + col + 1])
    return f'{bits:016x}'


for ruta in sys.argv[1:]:
    try:
        print(huella(ruta), ruta)
    except Exception as e:  # foto dañada o formato no soportado
        print('-' * 16, ruta, file=sys.stderr)
