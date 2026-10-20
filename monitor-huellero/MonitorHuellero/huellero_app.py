import time
import threading
import tkinter as tk
from datetime import datetime
import os
import subprocess
import pystray
from PIL import Image, ImageDraw

IP_HUELLERO = "10.10.50.32"
ARCHIVO_LOG = "registro_H.txt"

INTERVALO_ONLINE = 5     # segundos entre pings cuando está online
INTERVALO_CAIDO = 1      # segundos entre pings cuando está caído
TIMEOUT_PING_MS = 1000   # milisegundos de espera por respuesta (equivalente a -w)

# Evita que se abra una ventana de consola negra cada vez que se hace ping
CREATE_NO_WINDOW = 0x08000000

ventana = None
texto = None
icono = None


def ping_huellero():
    """
    Usa el mismo comando ping de Windows (el que ya confirmaste que funciona
    en el Símbolo del sistema), en vez de sockets crudos que en Windows
    suelen fallar por permisos y dar falsos negativos.
    """
    try:
        resultado = subprocess.run(
            ["ping", "-n", "1", "-w", str(TIMEOUT_PING_MS), IP_HUELLERO],
            capture_output=True,
            text=True,
            encoding="cp850",
            errors="ignore",
            creationflags=CREATE_NO_WINDOW
        )
        # returncode 0 = hubo respuesta. Además verificamos "TTL=" en la
        # salida como respaldo, por si el código de retorno fuera ambiguo.
        return resultado.returncode == 0 and "TTL=" in resultado.stdout.upper()
    except Exception as e:
        mostrar(f"ERROR AL EJECUTAR PING: {e}")
        return False


def log(msg):
    with open(ARCHIVO_LOG, "a", encoding="utf-8") as f:
        f.write(msg + "\n")


def mostrar(msg):
    if texto:
        texto.insert(tk.END, msg + "\n")
        texto.see(tk.END)


def monitor():
    while True:
        fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if ping_huellero():
            mostrar(f"{fecha} - ONLINE - {IP_HUELLERO}")
            time.sleep(INTERVALO_ONLINE)
        else:
            mostrar(f"{fecha} - CAIDO - {IP_HUELLERO}")
            log(f"{fecha} - CAIDO - {IP_HUELLERO}")
            time.sleep(INTERVALO_CAIDO)


def crear_icono():
    img = Image.new("RGB", (64, 64), "black")
    draw = ImageDraw.Draw(img)
    draw.rectangle((16, 16, 48, 48), outline="white", width=2)
    return img


def abrir():
    global ventana, texto
    ventana = tk.Tk()
    ventana.title("MONITOREO HUELLERO")
    ventana.geometry("520x340")
    ventana.configure(bg="white")

    frame = tk.Frame(ventana, bg="black", padx=2, pady=2)
    frame.pack(fill="both", expand=True, padx=8, pady=8)

    contenido = tk.Frame(frame, bg="white")
    contenido.pack(fill="both", expand=True)

    titulo = tk.Label(
        contenido,
        text="MONITOREO HUELLERO",
        bg="white",
        fg="black",
        font=("Arial", 14, "bold")
    )
    titulo.pack(pady=10)

    texto = tk.Text(
        contenido,
        bg="white",
        fg="black",
        font=("Consolas", 10, "bold"),
        insertbackground="black"
    )
    texto.pack(fill="both", expand=True)
    texto.insert(tk.END, "SISTEMA INICIADO...\n\n")

    ventana.protocol("WM_DELETE_WINDOW", ventana.withdraw)
    ventana.mainloop()


def tray():
    global icono
    menu = pystray.Menu(
        pystray.MenuItem(
            "Abrir panel",
            lambda: threading.Thread(target=abrir, daemon=True).start()
        ),
        pystray.MenuItem(
            "Salir",
            lambda: icono.stop()
        )
    )
    icono = pystray.Icon(
        "huellero",
        crear_icono(),
        "Monitoreo Huellero",
        menu
    )
    icono.run()


if not os.path.exists(ARCHIVO_LOG):
    with open(ARCHIVO_LOG, "w", encoding="utf-8") as f:
        f.write("REGISTRO HUELLERO\n\n")

threading.Thread(target=monitor, daemon=True).start()
tray()