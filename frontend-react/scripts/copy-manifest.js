import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.resolve(__dirname, "..", "manifest.json");
const dest = path.resolve(__dirname, "..", "dist", "manifest.json");
fs.copyFileSync(src, dest);

// copy public icons
const publicDir = path.resolve(__dirname, "..", "public");
const destPublic = path.resolve(__dirname, "..", "dist");
function copyRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  for (const ent of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, ent);
    const destPath = path.join(destDir, ent);
    if (fs.lstatSync(srcPath).isDirectory()) {
      if (!fs.existsSync(destPath)) fs.mkdirSync(destPath);
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
copyRecursive(publicDir, destPublic);

// copy src content files (e.g. piazza-styles.css) to dist/src/content so the
// extension manifest can reference them directly at runtime
const srcContentDir = path.resolve(__dirname, "..", "src", "content");
const destContentDir = path.resolve(__dirname, "..", "dist", "src", "content");
if (fs.existsSync(srcContentDir)) {
  if (!fs.existsSync(destContentDir))
    fs.mkdirSync(destContentDir, { recursive: true });
  copyRecursive(srcContentDir, destContentDir);
}

console.log("manifest and public files copied to dist");
