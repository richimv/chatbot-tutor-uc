import os
from pdf2image import convert_from_path

# Replace with the path to one of the user's PDFs
pdf_file = r"C:\Users\ricar\Downloads\PROYECTOS\chatbot-tutor-uc\biblioteca_medica\01_Normas_Tecnicas\Resolucion-ministerial-n-682-2025-minsa.pdf"
poppler_path = r"C:\poppler\Library\bin"

print(f"Testing pdf2image on {pdf_file}")
print(f"Using poppler path: {poppler_path}")

try:
    print("Converting first page...")
    images = convert_from_path(pdf_file, first_page=1, last_page=1, dpi=300, poppler_path=poppler_path)
    print(f"Success! Converted {len(images)} page(s).")
except Exception as e:
    import traceback
    print(f"Error converting PDF to image: {e}")
    traceback.print_exc()
