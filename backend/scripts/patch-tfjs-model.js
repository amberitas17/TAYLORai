// scripts/patch-tfjs-model.js
import fs from 'fs';
import path from 'path';

function patch(file) {
  const p = path.resolve(file);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));

  // Keras JSON usually stores layers in j.modelTopology.model_config.config.layers
  const layers =
    j?.modelTopology?.model_config?.config?.layers ||
    j?.modelTopology?.config?.layers; // handle slight schema variants

  if (!Array.isArray(layers)) {
    console.error(`[SKIP] Could not find layers in ${file}`);
    return;
  }

  let changed = 0;
  for (const layer of layers) {
    if (layer?.class_name === 'InputLayer' && layer?.config) {
      const c = layer.config;

      // Normalize possible key casings
      const hasInputShape = Object.prototype.hasOwnProperty.call(c, 'inputShape') || Object.prototype.hasOwnProperty.call(c, 'input_shape');
      const hasBatchInputShape = Object.prototype.hasOwnProperty.call(c, 'batchInputShape') || Object.prototype.hasOwnProperty.call(c, 'batch_input_shape');

      // Prefer keeping batchInputShape (null, H, W, C)
      if (hasInputShape && hasBatchInputShape) {
        // Delete the inputShape variant(s)
        delete c.inputShape;
        delete c.input_shape;
        changed++;
      }
    }
  }

  if (changed > 0) {
    fs.writeFileSync(p, JSON.stringify(j, null, 2));
    console.log(`[OK] Patched ${file}: removed inputShape from ${changed} InputLayer(s).`);
  } else {
    console.log(`[OK] No changes needed for ${file}.`);
  }
}

// CLI: node scripts/patch-tfjs-model.js path/to/model.json [...]
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/patch-tfjs-model.js <model.json> [more model.json]');
  process.exit(1);
}
files.forEach(patch);