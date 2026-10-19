# -*- coding: utf-8 -*-
"""
monitor_backup.py
Reemplaza al backup.bat: ejecuta rclone copy por cada sitio (mismos parametros
y misma estructura de carpetas con fecha), y guarda un registro JSON diario
para que la interfaz web/GUI lo muestre en tiempo real.

Ejecutar asi en el server (Programador de tareas):
    py C:\monitoreo-sharepoint\monitor_backup.py
"""

import json
import subprocess
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")

PALABRAS_ERROR = ["error", "failed", "corrupted", "couldn't", "denied", "timeout", "not found"]


def cargar_config():
    with open(CONFIG_PATH, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def extraer_causa(texto):
    for linea in texto.splitlines():
        low = linea.lower()
        if any(p in low for p in PALABRAS_ERROR):
            return linea.strip()
    return "No se identifico linea de error especifica, revisar log completo"


def guardar_estado_compartido(log_dir, fecha, datos_json):
    """Guarda el archivo JSON de inmediato para actualizar la GUI en tiempo real."""
    os.makedirs(log_dir, exist_ok=True)
    archivo_path = os.path.join(log_dir, f"{fecha}.json")
    with open(archivo_path, "w", encoding="utf-8") as f:
        json.dump(datos_json, f, ensure_ascii=False, indent=2)


def main():
    config = cargar_config()
    rclone_exe = config["rclone_exe"]
    base_dir = config["base_dir"]
    log_dir = os.path.join(BASE_DIR, config.get("log_dir", "logs"))
    
    fecha_hoy = datetime.now().strftime("%Y-%m-%d")
    inicio_global = datetime.now()

    # ====================================================
    # 1. INICIALIZACIÓN DEL JSON (Todos los sitios PENDIENTE)
    # ====================================================
    backup_status = {
        "fecha": fecha_hoy,
        "fecha_ejecucion": inicio_global.strftime("%Y-%m-%d %H:%M:%S"),
        "estado_global": "PROCESANDO",
        "sitio_actual": "Iniciando...",
        "inicio_global": inicio_global.strftime("%Y-%m-%d %H:%M:%S"),
        "fin_global": "--",
        "duracion_global": "--",
        "sitios": [],
        "sites": []  # Doble compatibilidad con interfaz gráfica anterior/nueva
    }

    for site in config["sites"]:
        estructura_sitio = {
            "nombre": site["name"],
            "name": site["name"], # Mapeado dual
            "remote": site["remote"],
            "estado": "PENDIENTE",
            "inicio": "--",
            "fin": "--",
            "duracion": "--",
            "duracion_segundos": 0,
            "codigo_salida": None,
            "causa_error": ""
        }
        backup_status["sitios"].append(estructura_sitio)
        backup_status["sites"].append(estructura_sitio)

    # Guardar estado inicial para que la GUI cambie a "Esperando"
    guardar_estado_compartido(log_dir, fecha_hoy, backup_status)

    # ====================================================
    # 2. PROCESAMIENTO DE SITIOS EN TIEMPO REAL
    # ====================================================
    for idx, site in enumerate(config["sites"]):
        # Buscar la referencia del sitio actual en nuestras estructuras JSON
        sitio_json_es = backup_status["sitios"][idx]
        sitio_json_en = backup_status["sites"][idx]
        
        # Actualizar datos de control para el inicio del proceso de este sitio
        backup_status["sitio_actual"] = site["name"]
        sitio_json_es["estado"] = "DESCARGANDO"
        sitio_json_en["estado"] = "DESCARGANDO"
        
        hora_inicio_sitio = datetime.now()
        sitio_json_es["inicio"] = hora_inicio_sitio.strftime("%Y-%m-%d %H:%M:%S")
        sitio_json_en["inicio"] = hora_inicio_sitio.strftime("%Y-%m-%d %H:%M:%S")
        
        # Guardar inmediatamente para reflejar "Descargando..." en la GUI
        print(f"[{idx+1}/{len(config['sites'])}] Procesando: {site['name']}...")
        guardar_estado_compartido(log_dir, fecha_hoy, backup_status)

        # Nueva estructura requerida: backups\<Nombre_sitio>\<Fecha>_Descarga
        destino = os.path.join(base_dir, site["name"], f"{fecha_hoy}_Descarga")
        os.makedirs(destino, exist_ok=True)

        comando = [
            rclone_exe, "copy", site["remote"], destino,
            "--update", "--retries", "3",
            "--low-level-retries", "10",
            "--ignore-errors"
        ]

        try:
            resultado = subprocess.run(
                comando,
                capture_output=True,
                text=True,
                timeout=3600 * 3
            )
            salida = (resultado.stdout or "") + "\n" + (resultado.stderr or "")
            exito = resultado.returncode == 0
            codigo = resultado.returncode
        except Exception as e:
            salida = str(e)
            exito = False
            codigo = -1

        hora_fin_sitio = datetime.now()
        segundos_totales = round((hora_fin_sitio - hora_inicio_sitio).total_seconds(), 1)
        
        # Formatear la duración de manera amigable
        if segundos_totales < 60:
            duracion_str = f"{int(segundos_totales)} seg"
        else:
            duracion_str = f"{int(segundos_totales / 60)} min"

        # ====================================================
        # 3. ACTUALIZACIÓN POST-EJECUCIÓN DEL SITIO
        # ====================================================
        estado_final = "OK" if exito else "ERROR"
        
        sitio_json_es["estado"] = estado_final
        sitio_json_en["estado"] = estado_final
        
        sitio_json_es["fin"] = hora_fin_sitio.strftime("%Y-%m-%d %H:%M:%S")
        sitio_json_en["fin"] = hora_fin_sitio.strftime("%Y-%m-%d %H:%M:%S")
        
        sitio_json_es["duracion_segundos"] = segundos_totales
        sitio_json_en["duracion_segundos"] = segundos_totales
        
        sitio_json_es["duracion"] = duracion_str
        sitio_json_en["duracion"] = duracion_str
        
        sitio_json_es["codigo_salida"] = codigo
        sitio_json_en["codigo_salida"] = codigo
        
        if not exito:
            causa = extraer_causa(salida)
            sitio_json_es["causa_error"] = causa
            sitio_json_en["causa_error"] = causa

        print(f"   -> Resultado: {estado_final} ({duracion_str})")
        
        # Guardar inmediatamente tras terminar este sitio
        guardar_estado_compartido(log_dir, fecha_hoy, backup_status)

    # ====================================================
    # 4. CIERRE Y FINALIZACIÓN GLOBAL
    # ====================================================
    fin_global = datetime.now()
    duracion_global_segundos = round((fin_global - inicio_global).total_seconds(), 1)
    
    backup_status["estado_global"] = "FINALIZADO"
    backup_status["sitio_actual"] = "Ninguno (Proceso Terminado)"
    backup_status["fin_global"] = fin_global.strftime("%Y-%m-%d %H:%M:%S")
    backup_status["duracion_global"] = f"{round(duracion_global_segundos / 60, 1)} minutos"

    guardar_estado_compartido(log_dir, fecha_hoy, backup_status)
    print(f"\nRespaldo completo finalizado. Log de monitoreo guardado en tiempo real.")


if __name__ == "__main__":
    main()