import os
import pytesseract
from PIL import Image

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

print("Test Tesseract version:")
try:
    print(pytesseract.get_tesseract_version())
    print("Tesseract is functioning.")
except Exception as e:
    print(f"Error: {e}")
