/**
 * Thumbnail generation CLI.
 *
 * Usage: node scripts/generate-thumbnails.ts <input> --out <dir>
 *
 * Reads an input image (PNG/JPEG/WebP — any sharp-supported format) and writes
 * <basename>-{64,128,256,512}.webp to the output directory.
 *
 * Uses sharp (devDep 0.34.5). No additional CLI-arg-parsing dependency.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import sharp from 'sharp';

const THUMBNAIL_SIZES = [64, 128, 256, 512] as const;

/**
 * Generate WebP thumbnails at 64/128/256/512 px (square, fit cover) for the
 * given input image path. Output files are written to `outDir` as
 * `<basename>-<size>.webp`. The output directory is created if it does not
 * exist. Running twice is idempotent (files are overwritten).
 *
 * @throws If the input file cannot be read by sharp (e.g., missing or corrupt).
 */
export async function generateThumbnails(inputPath: string, outDir: string): Promise<void> {
  // Verify input exists and is readable before creating the output dir,
  // so we don't leave empty directories behind on failure.
  const inputBuffer = await fs.readFile(inputPath);

  await fs.mkdir(outDir, { recursive: true });

  const basename = path.basename(inputPath, path.extname(inputPath));

  await Promise.all(
    THUMBNAIL_SIZES.map(async (size) => {
      const outFile = path.join(outDir, `${basename}-${size}.webp`);
      await sharp(inputBuffer)
        .resize(size, size, { fit: 'cover' })
        .webp()
        .toFile(outFile);
    }),
  );
}

// CLI entrypoint — only runs when invoked directly (not when imported by tests).
// Detect via checking if this module is the main entry point.
const isMain = process.argv[1] !== undefined && process.argv[1].endsWith('generate-thumbnails.ts');
if (isMain) {
  const args = process.argv.slice(2);
  const inputArg = args[0];
  const outFlagIndex = args.indexOf('--out');
  const outArg = outFlagIndex !== -1 ? args[outFlagIndex + 1] : undefined;

  if (!inputArg || !outArg) {
    process.stderr.write('Usage: node scripts/generate-thumbnails.ts <input> --out <dir>\n');
    process.exit(1);
  }

  generateThumbnails(inputArg, outArg).catch((err: unknown) => {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
