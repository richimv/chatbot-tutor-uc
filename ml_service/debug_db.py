
import sys
import os

# Add the parent directory to sys.path to allow importing ml_service modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from ml_service.db_connector import get_courses_data

try:
    print("Testing get_courses_data()...")
    df = get_courses_data()
    print("Result DataFrame:")
    print(df.head())
    print("\nColumns:", df.columns)
    if 'careers' in df.columns:
        print("\nFirst row careers type:", type(df.iloc[0]['careers']))
        print("First row careers value:", df.iloc[0]['careers'])
except Exception as e:
    print(f"Error executing get_courses_data: {e}")
    import traceback
    traceback.print_exc()
