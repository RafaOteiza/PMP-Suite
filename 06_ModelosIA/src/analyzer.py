import os
import pandas as pd
import psycopg2
from dotenv import load_dotenv

script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, "../../03_Backend/pmp-api/.env")
load_dotenv(env_path)
DB_URL = os.getenv("DATABASE_URL")

def get_connection():
    if not DB_URL:
        raise ValueError("DATABASE_URL no encontrada en el archivo .env")
    return psycopg2.connect(DB_URL)

def analyze_failures():
    conn = get_connection()
    query = """
    SELECT
        COALESCE(validador_serie, consola_serie) AS serie_equipo,
        tipo_equipo,
        falla,
        fecha AS fecha_falla,
        (
            SELECT count(*)
            FROM pmp.ordenes_servicio o2
            WHERE COALESCE(o2.validador_serie, o2.consola_serie) =
                  COALESCE(o.validador_serie, o.consola_serie)
              AND o2.fecha < o.fecha
              AND o2.tipo_equipo = o.tipo_equipo
              AND o2.es_instalacion IS NOT TRUE AND o2.codigo_os !~ '^IN-'
        ) AS fallas_previas
    FROM pmp.ordenes_servicio o
    WHERE o.es_instalacion IS NOT TRUE AND o.codigo_os !~ '^IN-'
      AND COALESCE(o.validador_serie,o.consola_serie) IS NOT NULL
    """
    df = pd.read_sql(query, conn)
    conn.close()
    if df.empty:
        print("No hay datos suficientes para el análisis de IA.")
        return None

    df["fecha_falla"] = pd.to_datetime(df["fecha_falla"])
    fallas = df["falla"].fillna("")
    df["es_emv"] = fallas.str.contains("EMV", case=False).astype(int)
    df["es_barcode"] = fallas.str.contains("BARCODE|QR|LECTOR", case=False).astype(int)

    reincidentes = df[df["fallas_previas"] > 1]["serie_equipo"].unique()
    print("--- REPORTE DE INTELIGENCIA OPERATIVA ---")
    print(f"Total de Órdenes Analizadas: {len(df)}")
    print(f"Equipos con Reincidencia Detectada: {len(reincidentes)}")
    print(f"Predominancia EMV: {df['es_emv'].sum()} casos")
    print(f"Predominancia Lectores: {df['es_barcode'].sum()} casos")

    df["riesgo_score"] = (df["fallas_previas"] * 0.3 + df["es_emv"] * 0.5).clip(0, 1)
    return df

if __name__ == "__main__":
    import contextlib
    import io
    import sys

    if "--json" in sys.argv:
        with contextlib.redirect_stdout(io.StringIO()):
            results = analyze_failures()
        if results is None:
            print("[]")
        else:
            top_risk = (results.sort_values(by=["riesgo_score", "fecha_falla"], ascending=False)
                        .drop_duplicates(subset=["tipo_equipo", "serie_equipo"]).head(10))
            print(top_risk.to_json(orient="records"))
    else:
        results = analyze_failures()
        if results is not None:
            print("--- ANÁLISIS COMPLETADO ---")
