"""
Backup SharePoint (rclone) - aplicacion de bandeja del sistema.

- Al abrirla NO ejecuta el backup: queda en segundo plano (iconos ocultos)
  y espera a la hora programada (por defecto 03:00) todos los dias.
- Copia cada sitio a BASE\\<NOMBRE>\\<YYYY-MM-DD>, igual que el script original.
- Los lunes, si todas las copias terminaron bien, elimina las carpetas de
  las semanas viejas. Se conservan SEMANAS_CONSERVAR semanas (por defecto 2:
  la semana actual y la anterior). Ej.: el lunes de la 3ra semana se borra
  la 1ra semana y queda la 2da completa.
- Si el equipo estaba suspendido a la hora programada, ejecuta al despertar.
"""

import configparser
import ctypes
import os
import shutil
import subprocess
import sys
import threading
import traceback
import winreg
from datetime import datetime, timedelta

import pystray
from PIL import Image, ImageDraw

APP_NOMBRE = "Backup SharePoint"
MUTEX_NOMBRE = "Global\\BackupSharePointRclone_Biosteel"
CLAVE_RUN = r"Software\Microsoft\Windows\CurrentVersion\Run"
VALOR_RUN = "BackupSharePointRclone"


def carpeta_app():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


CONFIG_PATH = os.path.join(carpeta_app(), "config.ini")

CONFIG_DEFECTO = r"""; Configuracion de Backup SharePoint
; Despues de modificar este archivo, cierre la app (clic derecho > Salir) y vuelva a abrirla.

[GENERAL]
RCLONE = C:\rclone\rclone-v1.74.3-windows-amd64\rclone.exe
BASE = C:\BACKUPS\rclone\sharepoint
LOG = C:\BACKUPS\rclone\logs\backup.log
ERRLOG = C:\BACKUPS\rclone\logs\errores.log
; Hora diaria de ejecucion (formato 24h, HH:MM)
HORA = 03:00
; Semanas de descargas que se conservan contando la actual (2 = esta semana + la anterior).
; Los lunes se borran las semanas mas viejas.
SEMANAS_CONSERVAR = 2

; NOMBRE DE CARPETA = remoto de rclone (se copian en este orden)
[SITIOS]
CALIDAD = share_calidad:
COMPRAS = COMPRAS:
CONTABILIDAD = share_contabilidad:
GESTION HUMANA = sharepoint:
ALMACEN = share_almacen:
SISTEMAS = share_sistemas:
FACTURACION = share_facturacion:
"""


def cargar_config():
    if not os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            f.write(CONFIG_DEFECTO)

    cp = configparser.ConfigParser(interpolation=None)
    cp.optionxform = str  # respetar mayusculas en los nombres de los sitios
    cp.read(CONFIG_PATH, encoding="utf-8")

    g = cp["GENERAL"]
    hora_txt = g.get("HORA", "03:00").strip()
    hh, mm = hora_txt.split(":")
    sitios = [(k.strip(), v.strip()) for k, v in cp["SITIOS"].items()]
    semanas = max(1, int(g.get("SEMANAS_CONSERVAR", "2").strip()))

    return {
        "RCLONE": g.get("RCLONE").strip(),
        "BASE": g.get("BASE").strip(),
        "LOG": g.get("LOG").strip(),
        "ERRLOG": g.get("ERRLOG").strip(),
        "HORA": int(hh),
        "MINUTO": int(mm),
        "SITIOS": sitios,
        "SEMANAS_CONSERVAR": semanas,
    }


CFG = cargar_config()
RCLONE = CFG["RCLONE"]
BASE = CFG["BASE"]
LOG = CFG["LOG"]
ERRLOG = CFG["ERRLOG"]
ESTADO_PATH = os.path.join(os.path.dirname(LOG), "ultima_ejecucion_programada.txt")

LOG_MAX_BYTES = 50 * 1024 * 1024

# ---------------------------------------------------------------------------
# Utilidades Windows
# ---------------------------------------------------------------------------

MB_OK = 0x0
MB_YESNO = 0x4
MB_ICONINFO = 0x40
MB_ICONWARNING = 0x30
MB_ICONERROR = 0x10
MB_TOPMOST = 0x40000
MB_SETFOREGROUND = 0x10000
IDYES = 6

ES_CONTINUOUS = 0x80000000
ES_SYSTEM_REQUIRED = 0x00000001

CREATE_NO_WINDOW = 0x08000000


def mensaje(texto, flags=MB_OK | MB_ICONINFO):
    return ctypes.windll.user32.MessageBoxW(
        0, texto, APP_NOMBRE, flags | MB_TOPMOST | MB_SETFOREGROUND
    )


def instancia_unica():
    ctypes.windll.kernel32.CreateMutexW(None, False, MUTEX_NOMBRE)
    return ctypes.windll.kernel32.GetLastError() != 183  # ERROR_ALREADY_EXISTS


def comando_inicio():
    if getattr(sys, "frozen", False):
        return f'"{sys.executable}"'
    pythonw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
    return f'"{pythonw}" "{os.path.abspath(__file__)}"'


def inicio_con_windows_activo():
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, CLAVE_RUN) as k:
            valor, _ = winreg.QueryValueEx(k, VALOR_RUN)
            return valor == comando_inicio()
    except OSError:
        return False


def activar_inicio_con_windows(activar):
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, CLAVE_RUN, 0, winreg.KEY_SET_VALUE) as k:
        if activar:
            winreg.SetValueEx(k, VALOR_RUN, 0, winreg.REG_SZ, comando_inicio())
        else:
            try:
                winreg.DeleteValue(k, VALOR_RUN)
            except OSError:
                pass


# ---------------------------------------------------------------------------
# Logica de backup (misma que el script original)
# ---------------------------------------------------------------------------

_log_lock = threading.Lock()


def ahora_txt():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def escribir_log(ruta, texto):
    with _log_lock:
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        with open(ruta, "a", encoding="utf-8") as archivo:
            archivo.write(texto + "\n")


def rotar_log():
    # Evita que backup.log crezca sin limite: conserva una copia anterior (backup.log.1)
    try:
        if os.path.exists(LOG) and os.path.getsize(LOG) > LOG_MAX_BYTES:
            anterior = LOG + ".1"
            if os.path.exists(anterior):
                os.remove(anterior)
            os.rename(LOG, anterior)
    except OSError:
        pass


def lunes_de_esta_semana(hoy):
    lunes = hoy - timedelta(days=hoy.weekday())
    return lunes.strftime("%Y-%m-%d")


def fecha_corte_limpieza(hoy):
    # Primer dia que se conserva: lunes de hace (SEMANAS_CONSERVAR - 1) semanas.
    # Con 2 semanas, el lunes de la 3ra semana el corte es el lunes de la 2da,
    # asi que se borra la 1ra semana y la 2da queda completa.
    lunes = hoy - timedelta(days=hoy.weekday())
    corte = lunes - timedelta(weeks=CFG["SEMANAS_CONSERVAR"] - 1)
    return corte.strftime("%Y-%m-%d")


class Backup:
    def __init__(self):
        self.lock = threading.Lock()
        self.proceso = None
        self.cancelado = False
        self.en_curso = False
        self.sitio_actual = ""
        self.ultimo_resultado = "Sin ejecuciones todavia"
        self.ultimo_ok = True
        self.al_cambiar = lambda: None

    def copiar(self, nombre, remoto, fecha):
        destino = os.path.join(BASE, nombre, fecha)
        os.makedirs(destino, exist_ok=True)

        self.sitio_actual = nombre
        self.al_cambiar()

        escribir_log(LOG, "=" * 58)
        escribir_log(LOG, f"{nombre} - INICIO {ahora_txt()}")
        escribir_log(LOG, f"ORIGEN: {remoto}")
        escribir_log(LOG, f"DESTINO: {destino}")
        escribir_log(LOG, "=" * 58)

        comando = [
            RCLONE,
            "copy",
            remoto,
            destino,
            "--update",
            "--retries", "3",
            "--low-level-retries", "10",
            "--create-empty-src-dirs",
            "--stats=1m",
            "--stats-one-line",
            f"--log-file={LOG}",
            "--log-level=INFO",
        ]

        try:
            self.proceso = subprocess.Popen(
                comando,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=CREATE_NO_WINDOW,
            )
            rc = self.proceso.wait()
        except Exception as e:
            escribir_log(ERRLOG, f"[{ahora_txt()}] {nombre} - NO SE PUDO EJECUTAR RCLONE: {e}")
            rc = -1
        finally:
            self.proceso = None

        if rc == 0:
            escribir_log(LOG, f"[{ahora_txt()}] {nombre} - COMPLETADO")
            return True

        escribir_log(LOG, f"[{ahora_txt()}] {nombre} - ERROR - CODIGO {rc}")
        escribir_log(ERRLOG, f"[{ahora_txt()}] {nombre} - ERROR - CODIGO {rc}")
        return False

    def limpiar(self, nombre, corte):
        carpeta = os.path.join(BASE, nombre)
        escribir_log(LOG, f"[{ahora_txt()}] INICIANDO LIMPIEZA: {nombre}")

        try:
            if os.path.exists(carpeta):
                fecha_corte = datetime.strptime(corte, "%Y-%m-%d")

                for elemento in os.listdir(carpeta):
                    ruta = os.path.join(carpeta, elemento)
                    if not os.path.isdir(ruta):
                        continue
                    try:
                        fecha_carpeta = datetime.strptime(elemento, "%Y-%m-%d")
                    except ValueError:
                        continue

                    if fecha_carpeta < fecha_corte:
                        shutil.rmtree(ruta)
                        escribir_log(LOG, f"[{ahora_txt()}] ELIMINADO PERMANENTEMENTE: {ruta}")

            escribir_log(LOG, f"[{ahora_txt()}] LIMPIEZA {nombre} - COMPLETADA")

        except Exception as e:
            escribir_log(ERRLOG, f"[{ahora_txt()}] ERROR EN LIMPIEZA: {nombre} - {e}")

    def ejecutar(self, origen):
        """Ejecuta el backup completo. Devuelve False si ya habia uno en curso."""
        if not self.lock.acquire(blocking=False):
            return False

        self.en_curso = True
        self.cancelado = False
        self.al_cambiar()
        # Evita que el servidor entre en suspension mientras copia
        ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)

        error_global = False
        try:
            os.makedirs(os.path.dirname(LOG), exist_ok=True)
            os.makedirs(BASE, exist_ok=True)
            rotar_log()

            if not os.path.exists(RCLONE):
                escribir_log(ERRLOG, f"[{ahora_txt()}] ERROR CRITICO: No existe rclone.exe: {RCLONE}")
                error_global = True
                return True

            hoy = datetime.now()
            fecha = hoy.strftime("%Y-%m-%d")
            lunes = lunes_de_esta_semana(hoy)
            corte = fecha_corte_limpieza(hoy)
            es_lunes = hoy.weekday() == 0

            escribir_log(LOG, "=" * 58)
            escribir_log(LOG, f"INICIO BACKUP ({origen}) - {ahora_txt()}")
            escribir_log(LOG, f"FECHA: {fecha}")
            escribir_log(LOG, f"DIA: {hoy.strftime('%A')}")
            escribir_log(LOG, f"LUNES DE ESTA SEMANA: {lunes}")
            escribir_log(LOG, "=" * 58)

            for nombre, remoto in CFG["SITIOS"]:
                if self.cancelado:
                    error_global = True
                    escribir_log(LOG, f"[{ahora_txt()}] BACKUP CANCELADO POR EL USUARIO")
                    break
                if not self.copiar(nombre, remoto, fecha):
                    error_global = True

            self.sitio_actual = ""

            if es_lunes:
                if not error_global:
                    escribir_log(LOG, "=" * 58)
                    escribir_log(LOG, f"LIMPIEZA SEMANAL - {ahora_txt()}")
                    escribir_log(LOG, f"SEMANAS QUE SE CONSERVAN: {CFG['SEMANAS_CONSERVAR']}")
                    escribir_log(LOG, f"SE CONSERVA DESDE: {corte}")
                    escribir_log(LOG, "ELIMINACION PERMANENTE ACTIVADA")
                    escribir_log(LOG, "=" * 58)

                    for nombre, _ in CFG["SITIOS"]:
                        self.limpiar(nombre, corte)

                    escribir_log(LOG, f"[{ahora_txt()}] LIMPIEZA SEMANAL FINALIZADA")
                else:
                    escribir_log(LOG, f"[{ahora_txt()}] LIMPIEZA OMITIDA: HUBO ERRORES EN LAS COPIAS")
                    escribir_log(ERRLOG, f"[{ahora_txt()}] LIMPIEZA OMITIDA: HUBO ERRORES EN LAS COPIAS")

            escribir_log(LOG, "=" * 58)
            escribir_log(LOG, f"FIN BACKUP - {ahora_txt()}")
            escribir_log(LOG, "=" * 58)

        except Exception:
            error_global = True
            escribir_log(ERRLOG, f"[{ahora_txt()}] ERROR INESPERADO:\n{traceback.format_exc()}")

        finally:
            ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS)
            self.sitio_actual = ""
            self.en_curso = False
            self.ultimo_ok = not error_global
            estado = "OK" if not error_global else "CON ERRORES (ver errores.log)"
            self.ultimo_resultado = f"{datetime.now():%Y-%m-%d %H:%M} - {estado}"
            self.lock.release()
            self.al_cambiar()

        return True

    def cancelar(self):
        self.cancelado = True
        p = self.proceso
        if p is not None:
            try:
                p.terminate()
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Programador diario
# ---------------------------------------------------------------------------

def proxima_ejecucion(desde):
    objetivo = desde.replace(hour=CFG["HORA"], minute=CFG["MINUTO"], second=0, microsecond=0)
    if objetivo <= desde:
        objetivo += timedelta(days=1)
    return objetivo


def leer_ultima_programada():
    try:
        with open(ESTADO_PATH, "r", encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


def guardar_ultima_programada(fecha_txt):
    try:
        os.makedirs(os.path.dirname(ESTADO_PATH), exist_ok=True)
        with open(ESTADO_PATH, "w", encoding="utf-8") as f:
            f.write(fecha_txt)
    except OSError:
        pass


class Programador(threading.Thread):
    def __init__(self, backup, al_refrescar, al_finalizar):
        super().__init__(daemon=True)
        self.backup = backup
        self.al_refrescar = al_refrescar
        self.al_finalizar = al_finalizar
        self.detener = threading.Event()
        # Al abrir la app NO se ejecuta: se espera a la proxima hora programada
        self.proxima = proxima_ejecucion(datetime.now())

    def run(self):
        while not self.detener.is_set():
            try:
                ahora = datetime.now()
                # Comprueba con el reloj real cada 20 s: funciona aunque el equipo
                # se suspenda o cambie la hora del sistema.
                if ahora >= self.proxima:
                    clave = self.proxima.strftime("%Y-%m-%d")
                    if leer_ultima_programada() != clave:
                        guardar_ultima_programada(clave)
                        escribir_log(LOG, f"[{ahora_txt()}] EJECUCION PROGRAMADA ({clave} {CFG['HORA']:02d}:{CFG['MINUTO']:02d})")
                        if not self.backup.ejecutar("PROGRAMADO"):
                            # Habia uno manual en curso: esperar a que termine y ejecutar igual
                            with self.backup.lock:
                                pass
                            self.backup.ejecutar("PROGRAMADO")
                        self.proxima = proxima_ejecucion(datetime.now())
                        self.al_finalizar()
                    self.proxima = proxima_ejecucion(datetime.now())
                    self.al_refrescar()
            except Exception:
                try:
                    escribir_log(ERRLOG, f"[{ahora_txt()}] ERROR EN PROGRAMADOR:\n{traceback.format_exc()}")
                except Exception:
                    pass
                self.proxima = proxima_ejecucion(datetime.now())
            self.detener.wait(20)


# ---------------------------------------------------------------------------
# Icono de bandeja
# ---------------------------------------------------------------------------

def crear_imagen(color):
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((2, 2, 62, 62), fill=color)
    # flecha de descarga
    blanco = (255, 255, 255, 255)
    d.rectangle((27, 12, 37, 34), fill=blanco)
    d.polygon([(16, 32), (48, 32), (32, 48)], fill=blanco)
    d.rectangle((16, 50, 48, 54), fill=blanco)
    return img


COLOR_OK = (30, 130, 76, 255)
COLOR_TRABAJANDO = (230, 126, 34, 255)
COLOR_ERROR = (192, 57, 43, 255)

IMG_OK = crear_imagen(COLOR_OK)
IMG_TRABAJANDO = crear_imagen(COLOR_TRABAJANDO)
IMG_ERROR = crear_imagen(COLOR_ERROR)


def abrir(ruta):
    try:
        if not os.path.exists(ruta):
            if os.path.splitext(ruta)[1]:
                escribir_log(ruta, "")
            else:
                os.makedirs(ruta, exist_ok=True)
        os.startfile(ruta)
    except Exception as e:
        threading.Thread(target=mensaje, args=(f"No se pudo abrir:\n{ruta}\n\n{e}", MB_OK | MB_ICONERROR), daemon=True).start()


def main():
    if not instancia_unica():
        mensaje("La aplicacion ya se esta ejecutando.\nBusquela en los iconos ocultos de la barra de tareas.", MB_OK | MB_ICONWARNING)
        return

    backup = Backup()
    icono = pystray.Icon("BackupSharePoint", IMG_OK, APP_NOMBRE)

    def refrescar():
        if backup.en_curso:
            icono.icon = IMG_TRABAJANDO
            texto = f"{APP_NOMBRE}\nCopiando: {backup.sitio_actual or '...'}"
        else:
            icono.icon = IMG_OK if backup.ultimo_ok else IMG_ERROR
            texto = f"{APP_NOMBRE}\nProxima: {programador.proxima:%Y-%m-%d %H:%M}"
        icono.title = texto[:127]
        try:
            icono.update_menu()
        except Exception:
            pass

    def avisar_fin():
        refrescar()
        try:
            if backup.ultimo_ok:
                icono.notify(f"Backup finalizado correctamente.\n{backup.ultimo_resultado}", APP_NOMBRE)
            else:
                icono.notify("Backup finalizado CON ERRORES. Revise errores.log", APP_NOMBRE)
        except Exception:
            pass

    backup.al_cambiar = refrescar
    programador = Programador(backup, refrescar, lambda: avisar_fin())

    def ejecutar_ahora(_icon, _item):
        def tarea():
            if backup.en_curso:
                mensaje("Ya hay un backup en curso.", MB_OK | MB_ICONWARNING)
                return
            r = mensaje(
                "Desea ejecutar el backup AHORA?\n\n"
                "(No es necesario: se ejecuta solo todos los dias a las "
                f"{CFG['HORA']:02d}:{CFG['MINUTO']:02d})",
                MB_YESNO | MB_ICONWARNING,
            )
            if r == IDYES:
                if backup.ejecutar("MANUAL"):
                    avisar_fin()
        threading.Thread(target=tarea, daemon=True).start()

    def cancelar_backup(_icon, _item):
        def tarea():
            r = mensaje("Desea CANCELAR el backup en curso?", MB_YESNO | MB_ICONWARNING)
            if r == IDYES:
                backup.cancelar()
        threading.Thread(target=tarea, daemon=True).start()

    def alternar_inicio(_icon, _item):
        try:
            activar_inicio_con_windows(not inicio_con_windows_activo())
        except Exception as e:
            threading.Thread(target=mensaje, args=(f"No se pudo cambiar el inicio automatico:\n{e}", MB_OK | MB_ICONERROR), daemon=True).start()
        refrescar()

    def salir(_icon, _item):
        def tarea():
            if backup.en_curso:
                txt = "Hay un backup EN CURSO. Si sale, se detendra.\n\nDesea salir de todas formas?"
            else:
                txt = ("Si cierra la aplicacion NO se haran los backups de las "
                       f"{CFG['HORA']:02d}:{CFG['MINUTO']:02d}.\n\nDesea salir?")
            if mensaje(txt, MB_YESNO | MB_ICONWARNING) == IDYES:
                programador.detener.set()
                backup.cancelar()
                icono.stop()
        threading.Thread(target=tarea, daemon=True).start()

    icono.menu = pystray.Menu(
        pystray.MenuItem(
            lambda i: f"Estado: copiando {backup.sitio_actual}..." if backup.en_curso else "Estado: en espera",
            None, enabled=False),
        pystray.MenuItem(lambda i: f"Proxima ejecucion: {programador.proxima:%Y-%m-%d %H:%M}", None, enabled=False),
        pystray.MenuItem(lambda i: f"Ultimo backup: {backup.ultimo_resultado}", None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Ejecutar backup ahora", ejecutar_ahora, enabled=lambda i: not backup.en_curso),
        pystray.MenuItem("Cancelar backup en curso", cancelar_backup, enabled=lambda i: backup.en_curso),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Abrir log", lambda i, it: abrir(LOG), default=True),
        pystray.MenuItem("Abrir log de errores", lambda i, it: abrir(ERRLOG)),
        pystray.MenuItem("Abrir carpeta de backups", lambda i, it: abrir(BASE)),
        pystray.MenuItem("Abrir configuracion", lambda i, it: abrir(CONFIG_PATH)),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Iniciar con Windows", alternar_inicio, checked=lambda i: inicio_con_windows_activo()),
        pystray.MenuItem("Salir", salir),
    )

    # Registrar inicio automatico al iniciar sesion
    try:
        if not inicio_con_windows_activo():
            activar_inicio_con_windows(True)
    except Exception:
        pass

    def al_iniciar(icon):
        icon.visible = True
        escribir_log(LOG, f"[{ahora_txt()}] APLICACION INICIADA - PROXIMA EJECUCION: {programador.proxima:%Y-%m-%d %H:%M}")
        programador.start()
        refrescar()
        try:
            icon.notify(
                f"En segundo plano. El backup se ejecutara todos los dias a las "
                f"{CFG['HORA']:02d}:{CFG['MINUTO']:02d}.\nProxima: {programador.proxima:%Y-%m-%d %H:%M}",
                APP_NOMBRE,
            )
        except Exception:
            pass

    icono.run(setup=al_iniciar)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        try:
            escribir_log(ERRLOG, f"[{ahora_txt()}] ERROR FATAL EN LA APLICACION:\n{traceback.format_exc()}")
        except Exception:
            pass
        mensaje(f"Error fatal:\n{traceback.format_exc()}", MB_OK | MB_ICONERROR)
