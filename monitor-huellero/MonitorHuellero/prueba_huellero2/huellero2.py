import sys
import ctypes
import time
import threading
import tkinter as tk
from datetime import datetime
import os
import pystray
from PIL import Image, ImageDraw
from ping3 import ping
import ping3

ping3.EXCEPTIONS = False  # si algo falla, ping() devuelve None en vez de lanzar excepción

IP_HUELLERO = "10.10.50.32"
ARCHIVO_LOG = "registro_H.txt"

INTERVALO_ONLINE = 5
TIMEOUT_PING = 1
INTERVALO_CAIDO = 0

ventana = None
texto = None
icono = None
lbl_estado = None


# ---------------------------------------------------------------
# ping3 necesita crear un socket ICMP "crudo", y en Windows eso
# SOLO funciona si el proceso corre como Administrador. Si no,
# ping() falla silenciosamente y siempre da "caído" aunque el
# equipo esté bien. Estas dos funciones detectan eso y relanzan
# el programa pidiendo permisos elevados (una sola vez, con UAC).
# ---------------------------------------------------------------
def es_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:
        return False


def relanzar_como_admin():
    script = os.path.abspath(sys.argv[0])
    parametros = " ".join([f'"{a}"' for a in sys.argv[1:]])
    ctypes.windll.shell32.ShellExecuteW(
        None, "runas", sys.executable, f'"{script}" {parametros}', None, 1
    )
    sys.exit(0)


def ping_huellero():
    try:
        respuesta = ping(IP_HUELLERO, timeout=TIMEOUT_PING)
        return respuesta is not None
    except Exception as e:
        mostrar(f"ERROR AL HACER PING: {e}")
        return False


def log(msg):
    with open(ARCHIVO_LOG, "a", encoding="utf-8") as f:
        f.write(msg + "\n")


def mostrar(msg):
    global texto, lbl_estado

    if not texto:
        return

    if "ONLINE" in msg:

        lbl_estado.config(
            text="Estado: ONLINE",
            fg="green"
        )

        texto.insert(
            tk.END,
            msg + "\n",
            "online"
        )

    elif "CAIDO" in msg:

        lbl_estado.config(
            text="Estado: CAÍDO",
            fg="red"
        )

        texto.insert(
            tk.END,
            msg + "\n",
            "caido"
        )

    else:
        texto.insert(
            tk.END,
            msg + "\n"
        )

    

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
    global ventana, texto, lbl_estado

    ventana = tk.Tk()
    ventana.title("Monitoreo de Huellero")
    ventana.geometry("560x420")
    ventana.resizable(False, False)

    # ===== Título =====
    titulo = tk.Label(
        ventana,
        text="MONITOREO DE HUELLERO",
        font=("Segoe UI", 14, "bold")
    )
    titulo.pack(pady=10)

    # ===== Información =====
    info = tk.LabelFrame(
        ventana,
        text="Información",
        padx=10,
        pady=10
    )
    info.pack(fill="x", padx=10)

    tk.Label(
        info,
        text=f"IP: {IP_HUELLERO}",
        font=("Segoe UI", 10)
    ).pack(anchor="w")

    lbl_estado = tk.Label(
        info,
        text="Estado: INICIANDO...",
        fg="orange",
        font=("Segoe UI", 11, "bold")
    )

    lbl_estado.pack(anchor="w", pady=5)

    # ===== Registro =====
    registro = tk.LabelFrame(
        ventana,
        text="Registro",
        padx=5,
        pady=5
    )

    registro.pack(
        fill="both",
        expand=True,
        padx=10,
        pady=10
    )

    scrollbar = tk.Scrollbar(registro)

    scrollbar.pack(
        side="right",
        fill="y"
    )

    texto = tk.Text(
        registro,
        font=("Consolas", 10),
        yscrollcommand=scrollbar.set
    )

    texto.pack(
        fill="both",
        expand=True
    )

    scrollbar.config(command=texto.yview)

    texto.tag_config(
        "online",
        foreground="green"
    )

    texto.tag_config(
        "caido",
        foreground="red"
    )

    texto.insert(
        tk.END,
        "Sistema iniciado (Administrador)\n\n"
    )

    # ===== Pie =====
    pie = tk.Label(
        ventana,
        text="Monitoreando dispositivo...",
        relief="sunken",
        anchor="w"
    )

    pie.pack(
        fill="x",
        side="bottom"
    )

    ventana.protocol(
        "WM_DELETE_WINDOW",
        ventana.withdraw
    )

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


if __name__ == "__main__":
    # Si no somos administradores, nos relanzamos pidiendo elevación
    # (esto abre el cuadro de UAC de Windows una sola vez).
    if os.name == "nt" and not es_admin():
        relanzar_como_admin()
    else:
        if not os.path.exists(ARCHIVO_LOG):
            with open(ARCHIVO_LOG, "w", encoding="utf-8") as f:
                f.write("REGISTRO HUELLERO\n\n")

        threading.Thread(target=monitor, daemon=True).start()
        tray()