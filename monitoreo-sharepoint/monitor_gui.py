# -*- coding: utf-8 -*-
import os
import sys
import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk
import json
from datetime import datetime
import threading
import subprocess
import time
import re
import glob
# --- CONFIGURACIÓN PARA RECONOCIMIENTO EN LA BARRA DE TAREAS DE WINDOWS ---
import ctypes

try:
    # Fuerza a Windows a registrar este script/ejecutable con un ID único para fijar el logo correctamente
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("empresa.monitoreosharepoint.1.0")
except:
    pass
# -------------------------------------------------------------------------

ANCHO = 1000
ALTO = 700

RCLONE_EXE = r"C:\rclone\rclone-v1.74.3-windows-amd64\rclone.exe"
BASE_DIR = r"C:\monitoreo-sharepoint\backups"
LOG_DIR = r"C:\monitoreo-sharepoint\logs"

# --- DETECTAR RUTA DE EJECUCIÓN REAL (Script o .EXE) ---
if getattr(sys, 'frozen', False):
    RUTA_BASE_REAL = os.path.dirname(sys.executable)
else:
    RUTA_BASE_REAL = os.path.dirname(__file__)

CONFIG_SITIOS = [
    {"name": "CALIDAD", "remote": "share_calidad:"},
    {"name": "COMPRAS", "remote": "COMPRAS:"},
    {"name": "CONTABILIDAD", "remote": "share_contabilidad:"},
    {"name": "GESTION HUMANA", "remote": "sharepoint:"}
]

class MonitorSharePoint:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Monitoreo Backups SharePoint")
        self.root.geometry(f"{ANCHO}x{ALTO}")
        self.root.configure(bg="#ECECEC")
        self.root.resizable(False, False)
        
        # --- CARGAR LOGO.PNG COMO ICONO DE LA VENTANA ---
        logo_path = os.path.join(RUTA_BASE_REAL, "logo.png")
        try:
            img_icono = Image.open(logo_path)
            self.icono_ventana = ImageTk.PhotoImage(img_icono)
            self.root.wm_iconphoto(True, self.icono_ventana)
        except:
            pass
        # -----------------------------------------------
        
        os.makedirs(BASE_DIR, exist_ok=True)
        os.makedirs(LOG_DIR, exist_ok=True)
        
        self.crear_interfaz()
        self.inicializar_tabla_limpia()
        self.cargar_ultimo_registro_guardado()
        
        self.root.mainloop()

    def crear_interfaz(self):
        encabezado = tk.Frame(self.root, bg="#003B6D", height=95)
        encabezado.pack(fill="x")
        encabezado.pack_propagate(False)

        # --- CARGAR LOGO.PNG EN EL ENCABEZADO DE LA INTERFAZ ---
        logo_path = os.path.join(RUTA_BASE_REAL, "logo.png")
        try:
            imagen = Image.open(logo_path)
            imagen = imagen.resize((70, 70))
            self.logo = ImageTk.PhotoImage(imagen)
            tk.Label(encabezado, image=self.logo, bg="#003B6D").pack(side="left", padx=20)
        except:
            tk.Label(encabezado, text="LOGO", bg="white", width=10, height=4).pack(side="left", padx=20)

        tk.Label(
            encabezado, text="MONITOREO BACKUPS SHAREPOINT", font=("Segoe UI", 22, "bold"), fg="white", bg="#003B6D"
        ).pack(side="left")

        contenedor = tk.Frame(self.root, bg="#ECECEC")
        contenedor.pack(fill="both", expand=True, padx=20, pady=20)

        estado_frame = tk.LabelFrame(contenedor, text="Estado General", font=("Segoe UI", 12, "bold"), padx=15, pady=10)
        estado_frame.pack(fill="x")

        self.lbl_servicio = tk.Label(estado_frame, text="🟢 Servicio: Activo", font=("Segoe UI", 11))
        self.lbl_servicio.pack(anchor="w")

        self.lbl_rclone = tk.Label(estado_frame, text="🟢 rclone: Verificando...", font=("Segoe UI", 11))
        self.lbl_rclone.pack(anchor="w")
        self.verificar_rclone()

        frame_fecha_click = tk.Frame(estado_frame)
        frame_fecha_click.pack(anchor="w")

        tk.Label(frame_fecha_click, text="🟢 Última copia: ", font=("Segoe UI", 11)).pack(side="left")
        
        self.lbl_backup_fecha = tk.Label(
            frame_fecha_click, 
            text="En espera", 
            font=("Segoe UI", 11, "underline"), 
            fg="#0056B3", 
            cursor="hand2"
        )
        self.lbl_backup_fecha.pack(side="left")
        self.lbl_backup_fecha.bind("<Button-1>", lambda e: self.abrir_contenedor_registro())

        frame_sitios = tk.LabelFrame(contenedor, text="Sitios", font=("Segoe UI", 12, "bold"), padx=10, pady=10)
        frame_sitios.pack(fill="both", expand=True, pady=15)

        columnas = ("estado", "inicio", "fin", "duracion")
        self.tabla = ttk.Treeview(frame_sitios, columns=columnas, show="tree headings", height=8)

        self.tabla.heading("#0", text="Sitio")
        self.tabla.heading("estado", text="Estado")
        self.tabla.heading("inicio", text="Inicio")
        self.tabla.heading("fin", text="Fin")
        self.tabla.heading("duracion", text="Duración")

        self.tabla.column("#0", width=220)
        self.tabla.column("estado", width=140)
        self.tabla.column("inicio", width=180)
        self.tabla.column("fin", width=180)
        self.tabla.column("duracion", width=120)

        self.tabla.pack(fill="both", expand=True)

        frame_progreso = tk.LabelFrame(contenedor, text="Progreso de la Operación", font=("Segoe UI", 12, "bold"), padx=10, pady=15)
        frame_progreso.pack(fill="x", pady=10)

        self.lbl_progreso = tk.Label(
            frame_progreso, 
            text="Esperando inicio del proceso...", 
            font=("Segoe UI", 12, "italic"), 
            fg="#555555",
            anchor="w"
        )
        self.lbl_progreso.pack(fill="x", padx=10)

        botones = tk.Frame(contenedor, bg="#ECECEC")
        botones.pack(pady=20)

        self.btn_limpiar = ttk.Button(botones, text="Reiniciar Vista", width=18, command=self.inicializar_tabla_limpia)
        self.btn_limpiar.pack(side="left", padx=10)
        
        self.btn_backup = ttk.Button(botones, text="Ejecutar Backup", width=18, command=self.iniciar_proceso_backup)
        self.btn_backup.pack(side="left", padx=10)

        estado_barra = tk.Label(self.root, text="Sistema listo.", bg="#003B6D", fg="white", anchor="w", padx=10)
        estado_barra.pack(fill="x", side="bottom")

    def verificar_rclone(self):
        try:
            resultado = subprocess.run(
                [RCLONE_EXE, "version"], capture_output=True, text=True, timeout=5
            )
            if resultado.returncode == 0:
                self.lbl_rclone.config(text="🟢 rclone: Disponible")
            else:
                self.lbl_rclone.config(text="🔴 rclone: Error de ejecución")
        except Exception:
            self.lbl_rclone.config(text="🔴 rclone: No encontrado en la ruta")

    def inicializar_tabla_limpia(self):
        for item in self.tabla.get_children():
            self.tabla.delete(item)

        for sitio in CONFIG_SITIOS:
            self.tabla.insert(
                "", "end", iid=sitio["name"], text=sitio["name"], values=("Esperando", "--", "--", "--")
            )
        self.lbl_progreso.config(text="Esperando inicio del proceso...", fg="#555555")

    def cargar_ultimo_registro_guardado(self):
        archivos = glob.glob(os.path.join(LOG_DIR, "log_backup_*.txt"))
        if not archivos:
            return

        ultimo_archivo = max(archivos, key=os.path.getmtime)
        
        try:
            with open(ultimo_archivo, "r", encoding="utf-8") as f:
                datos = json.load(f)
                
            fecha = datos.get("fecha", "--")
            errores = sum(1 for s in datos.get("sitios", []) if s.get("estado") == "ERROR")
            
            if errores == 0:
                self.lbl_backup_fecha.config(text=f"{fecha} (Sin Errores)", fg="#0056B3")
            else:
                self.lbl_backup_fecha.config(text=f"{fecha} ({errores} Errores)", fg="#A80000")
        except Exception:
            pass

    def iniciar_proceso_backup(self):
        self.btn_backup.config(state="disabled")
        self.btn_limpiar.config(state="disabled")
        
        for sitio in CONFIG_SITIOS:
            self.tabla.item(sitio["name"], values=("Esperando", "--", "--", "--"))
            
        hilo = threading.Thread(target=self.proceso_descarga_secuencial, daemon=True)
        hilo.start()

    def proceso_descarga_secuencial(self):
        total_sitios = len(CONFIG_SITIOS)
        fecha_hoy = datetime.now().strftime("%Y-%m-%d")
        
        log_json_data = {
            "fecha": fecha_hoy,
            "estado_global": "PROCESANDO",
            "inicio_global": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "sitios": []
        }
        
        errores_detectados = 0
        patron_global_pct = re.compile(r"Transferred:.*\s+(\d+)%\s*,")

        for idx, sitio in enumerate(CONFIG_SITIOS):
            nombre = sitio["name"]
            remoto = sitio["remote"]
            
            hora_inicio = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            t_inicio = time.time()
            
            self.tabla.item(nombre, values=("Descargando...", hora_inicio, "--", "--"))
            self.lbl_progreso.config(text=f"▶ [{idx+1}/{total_sitios}] Conectando a {nombre}...", fg="#003B6D")
            self.root.update_idletasks()
            
            ruta_destino = os.path.join(BASE_DIR, nombre, fecha_hoy)
            os.makedirs(ruta_destino, exist_ok=True)
            
            comando = [
                RCLONE_EXE, "copy", remoto, ruta_destino, 
                "--update", "--retries", "3", "--low-level-retries", "10", "--ignore-errors",
                "--progress", "--stats", "1s", "--stats-one-line"
            ]
            
            estado_resultado = "Finalizado"
            try:
                proceso = subprocess.Popen(
                    comando, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, bufsize=1, creationflags=0x08000000
                )
                
                while True:
                    linea = proceso.stdout.readline()
                    if not linea and proceso.poll() is not None:
                        break
                    
                    if linea:
                        match = patron_global_pct.search(linea)
                        if match:
                            pct_real = int(match.group(1))
                            if pct_real <= 100:
                                self.lbl_progreso.config(
                                    text=f"⏳ Descargando {nombre}: {pct_real}% completado del sitio..."
                                )
                                self.root.update_idletasks()
                
                if proceso.returncode != 0:
                    estado_resultado = "Error"
                    errores_detectados += 1
                    
            except Exception:
                estado_resultado = "Error"
                errores_detectados += 1

            hora_fin = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            duracion_segundos = int(time.time() - t_inicio)
            duracion_str = f"{duracion_segundos} seg" if duracion_segundos < 60 else f"{int(duracion_segundos/60)} min"
            
            self.tabla.item(nombre, values=(estado_resultado, hora_inicio, hora_fin, duracion_str))
            self.root.update_idletasks()
            
            log_json_data["sitios"].append({
                "nombre": nombre,
                "remote": remoto,
                "estado": "OK" if estado_resultado == "Finalizado" else "ERROR",
                "inicio": hora_inicio,
                "fin": hora_fin,
                "duracion": duracion_str
            })

        log_json_data["estado_global"] = "FINALIZADO"
        log_json_data["fin_global"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        archivo_log = os.path.join(LOG_DIR, f"log_backup_{fecha_hoy}.txt")
        try:
            with open(archivo_log, "w", encoding="utf-8") as f:
                json.dump(log_json_data, f, indent=4, ensure_ascii=False)
        except Exception as e:
            print(f"Error escribiendo el archivo log .txt: {e}")

        if errores_detectados == 0:
            self.lbl_progreso.config(text="✔ Todos los respaldos se han completado secuencialmente.", fg="green")
            self.lbl_backup_fecha.config(text=f"{fecha_hoy} (Sin Errores)", fg="#0056B3")
        else:
            self.lbl_progreso.config(text=f"⚠ Procesamiento finalizado con {errores_detectados} errores.", fg="#A80000")
            self.lbl_backup_fecha.config(text=f"{fecha_hoy} ({errores_detectados} Errores)", fg="#A80000")
            
        self.btn_backup.config(state="normal")
        self.btn_limpiar.config(state="normal")

    def abrir_contenedor_registro(self):
        fecha_actual = self.lbl_backup_fecha.cget("text").split(" ")[0]
        
        if fecha_actual == "En" or fecha_actual == "espera":
            return

        ruta_log = os.path.join(LOG_DIR, f"log_backup_{fecha_actual}.txt")

        ventana_pop = tk.Toplevel(self.root)
        ventana_pop.title(f"Registro de Copia - {fecha_actual}")
        ventana_pop.geometry("620x350")
        ventana_pop.configure(bg="#F5F5F5")
        ventana_pop.resizable(False, False)
        ventana_pop.grab_set()

        tk.Label(
            ventana_pop, text=f"Detalles del Respaldo: {fecha_actual}", 
            font=("Segoe UI", 12, "bold"), bg="#003B6D", fg="white", pady=8
        ).pack(fill="x")

        frame_datos = tk.Frame(ventana_pop, bg="#F5F5F5", padx=15, pady=15)
        frame_datos.pack(fill="both", expand=True)

        if not os.path.exists(ruta_log):
            tk.Label(
                frame_datos, text="❌ Archivo de registro diario no encontrado en disco.", 
                font=("Segoe UI", 11, "bold"), fg="red", bg="#F5F5F5"
            ).pack(pady=50)
            return

        try:
            with open(ruta_log, "r", encoding="utf-8") as f:
                datos_log = json.load(f)

            columnas_pop = ("inicio", "fin", "estado")
            tabla_pop = ttk.Treeview(frame_datos, columns=columnas_pop, show="tree headings", height=5)
            
            tabla_pop.heading("#0", text="Sitio")
            tabla_pop.heading("inicio", text="Hora Inicio")
            tabla_pop.heading("fin", text="Hora Fin")
            tabla_pop.heading("estado", text="Estado")

            tabla_pop.column("#0", width=140)
            tabla_pop.column("inicio", width=150)
            tabla_pop.column("fin", width=150)
            tabla_pop.column("estado", width=120)

            for sitio in datos_log.get("sitios", []):
                icono_estado = "✔ OK" if sitio["estado"] == "OK" else "❌ ERROR"
                tabla_pop.insert(
                    "", "end", text=sitio["nombre"], 
                    values=(sitio["inicio"], sitio["fin"], icono_estado)
                )

            tabla_pop.pack(fill="both", expand=True)

            tk.Label(
                frame_datos, text=f"Finalización General: {datos_log.get('fin_global', '--')}", 
                font=("Segoe UI", 9, "italic"), bg="#F5F5F5", fg="#555555"
            ).pack(anchor="w", pady=5)

        except Exception as e:
            tk.Label(
                frame_datos, text=f"Error leyendo el log plano: {str(e)}", 
                font=("Segoe UI", 10), fg="red", bg="#F5F5F5"
            ).pack(pady=50)

        ttk.Button(ventana_pop, text="Cerrar", width=12, command=ventana_pop.destroy).pack(pady=10)

if __name__ == "__main__":
    MonitorSharePoint()