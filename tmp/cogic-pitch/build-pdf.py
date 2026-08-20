from pathlib import Path
from PIL import Image
from reportlab.pdfgen import canvas

source_dir = Path(r"C:\Users\kymfe\Downloads\cogic pitch")
output = Path(r"C:\Users\kymfe\OneDrive\Desktop\cogic\COGIC-Live-Combined-Pitch.pdf")

pdf = canvas.Canvas(str(output), pagesize=(1024, 1536), pageCompression=1)
for number in range(1, 7):
    image_path = source_dir / f"slide {number}.png"
    with Image.open(image_path) as image:
        width, height = image.size
    pdf.setPageSize((width, height))
    pdf.drawImage(str(image_path), 0, 0, width=width, height=height, preserveAspectRatio=True)
    pdf.showPage()
pdf.save()
