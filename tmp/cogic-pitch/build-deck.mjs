import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const imagePaths = Array.from({ length: 6 }, (_, i) =>
  `C:\\Users\\kymfe\\Downloads\\cogic pitch\\slide ${i + 1}.png`
);
const dimensions = [
  [1024, 1536],
  [1024, 1536],
  [1086, 1448],
  [941, 1672],
  [941, 1672],
  [941, 1672],
];
const outputPath = "C:\\Users\\kymfe\\OneDrive\\Desktop\\cogic\\COGIC-Live-Combined-Pitch.pptx";
const renderDir = "C:\\Users\\kymfe\\OneDrive\\Desktop\\cogic\\tmp\\cogic-pitch\\artifact-renders";

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(renderDir, { recursive: true });
  const slideWidth = 1024;
  const slideHeight = 1536;
  const presentation = Presentation.create({
    slideSize: { width: slideWidth, height: slideHeight },
  });

  for (let i = 0; i < imagePaths.length; i += 1) {
    const [imageWidth, imageHeight] = dimensions[i];
    const scale = Math.min(slideWidth / imageWidth, slideHeight / imageHeight);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    const left = (slideWidth - width) / 2;
    const top = (slideHeight - height) / 2;
    const bytes = await fs.readFile(imagePaths[i]);
    const blob = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    const slide = presentation.slides.add();
    slide.background.fill = "#000000";
    slide.images.add({
      blob,
      contentType: "image/png",
      alt: `COGIC Live pitch artwork, page ${i + 1}`,
      fit: "contain",
      position: { left, top, width, height },
    });
    slide.speakerNotes.textFrame.setText(
      `[Sources]\n- User-provided image: ${path.basename(imagePaths[i])}\n[/Sources]`
    );
    await writeBlob(
      path.join(renderDir, `slide-${String(i + 1).padStart(2, "0")}.png`),
      await presentation.export({ slide, format: "png", scale: 1 })
    );
  }

  await writeBlob(
    path.join(renderDir, "montage.webp"),
    await presentation.export({ format: "webp", montage: true, scale: 0.5 })
  );
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
