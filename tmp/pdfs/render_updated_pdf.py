from pathlib import Path
import pypdfium2 as pdfium

pdf_path = Path(r"C:\Users\kymfe\OneDrive\Desktop\cogic\COGIC-Live-Combined-Pitch.pdf")
output_dir = Path(r"C:\Users\kymfe\OneDrive\Desktop\cogic\tmp\pdfs\updated-render")
output_dir.mkdir(parents=True, exist_ok=True)

pdf = pdfium.PdfDocument(str(pdf_path))
print(f"Rendered pages: {len(pdf)}")
for index in range(len(pdf)):
    page = pdf[index]
    bitmap = page.render(scale=1)
    image = bitmap.to_pil()
    output = output_dir / f"page-{index + 1}.png"
    image.save(output)
    print(f"{index + 1}: {image.width}x{image.height}")
