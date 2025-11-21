# ml_service/utils.py
import json
import re
from unidecode import unidecode

def load_json_data(file_path):
    """Carga datos desde un archivo JSON."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error al cargar el archivo JSON {file_path}: {e}")
        return None

def normalize_text(text):
    """Normaliza el texto: minúsculas, sin acentos y sin caracteres especiales."""
    if not isinstance(text, str):
        return ""
    text = unidecode(text.lower())
    return re.sub(r'[^a-z0-9\s]', '', text)