# ml_service/db_connector.py
import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# ✅ CORRECCIÓN: Usar el nombre específico para Python
DATABASE_URL = os.getenv("PYTHON_DATABASE_URL") 

def get_db_engine():
    if not DATABASE_URL:
        # El mensaje de error ya lo tenías bien, ahora el código coincide
        raise ValueError("❌ Error: PYTHON_DATABASE_URL no configurada en .env")
    
    return create_engine(
        DATABASE_URL, 
        pool_size=3,      
        max_overflow=2,   
        pool_timeout=30,
        pool_recycle=1800
    )
    
def get_courses_data():
    """
    Descarga cursos con temas Y carreras.
    CORRECCIÓN: Usamos 'c.name' directamente (sin alias 'as title')
    """
    query = """
    SELECT 
        c.id, 
        c.name,  
        c.description,
        string_agg(DISTINCT t.name, ' ') as topics_soup,
        COALESCE(
            json_agg(DISTINCT t.name) FILTER (WHERE t.id IS NOT NULL),
            '[]'
        ) as topics,
        COALESCE(
            json_agg(DISTINCT jsonb_build_object('name', car.name, 'area', car.area)) 
            FILTER (WHERE car.id IS NOT NULL), 
            '[]'
        ) as careers
    FROM courses c
    LEFT JOIN course_topics ct ON c.id = ct.course_id
    LEFT JOIN topics t ON ct.topic_id = t.id
    LEFT JOIN sections s ON c.id = s.course_id
    LEFT JOIN section_careers sc ON s.id = sc.section_id
    LEFT JOIN careers car ON sc.career_id = car.id
    GROUP BY c.id, c.name, c.description;
    """
    try:
        engine = get_db_engine()
        df = pd.read_sql(query, engine)
        print(f"📊 [DB] Cursos cargados: {len(df)} (Schema corregido: 'name')")
        return df
    except Exception as e:
        print(f"❌ [DB] Error descargando cursos: {e}")
        return pd.DataFrame()

def get_search_trends_data(days=30):
    """Historial de búsquedas crudo para análisis de tendencias"""
    query = text(f"""
    SELECT query, results_count, created_at 
    FROM search_history 
    WHERE created_at >= NOW() - INTERVAL '{days} days'
    AND query IS NOT NULL
    """)
    try:
        engine = get_db_engine()
        return pd.read_sql(query, engine)
    except Exception as e:
        print(f"❌ [DB] Error historial: {e}")
        return pd.DataFrame()

def get_all_topics():
    """Catálogo completo de temas"""
    try:
        engine = get_db_engine()
        return pd.read_sql("SELECT name FROM topics", engine)
    except:
        return pd.DataFrame()