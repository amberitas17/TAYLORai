#!/usr/bin/env node
/**
 * Optional offline avatar optimization. Does not replace the production GLB.
 *
 * Install locally:
 *   npm install --no-save @gltf-transform/core @gltf-transform/functions meshoptimizer
 * Run:
 *   node scripts/optimize-avatar.mjs
 *
 * Output: public/sarah-avatar-optimized.glb
 * Meshopt compression preserves existing textures, materials, animations and
 * morph targets; texture conversion is intentionally excluded until visual QA.
 */
import { NodeIO } from '@gltf-transform/core';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve('public/sarah-avatar.glb');
const target = resolve('public/sarah-avatar-optimized.glb');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});
const document = await io.read(source);
const inventory = (doc) => {
  const root = doc.getRoot();
  return {
    animations: root.listAnimations().length,
    skins: root.listSkins().length,
    meshes: root.listMeshes().length,
    morphTargets: root.listMeshes().reduce((count, mesh) =>
      count + mesh.listPrimitives().reduce((n, primitive) => n + primitive.listTargets().length, 0), 0),
  };
};
const before = inventory(document);
await document.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder }));
await io.write(target, document);
const verified = await io.read(target);
const after = inventory(verified);
for (const field of Object.keys(before)) {
  if (before[field] !== after[field]) {
    throw new Error(`Validation failed: ${field} changed from ${before[field]} to ${after[field]}`);
  }
}
const [originalSize, optimizedSize] = await Promise.all([stat(source), stat(target)]);
console.log(JSON.stringify({
  original: source,
  optimized: target,
  originalBytes: originalSize.size,
  optimizedBytes: optimizedSize.size,
  reductionPercent: Number((100 * (1 - optimizedSize.size / originalSize.size)).toFixed(1)),
  inventory: after,
  productionAssetUnchanged: true,
}, null, 2));
console.log('Inspect appearance, skinning, facial expressions and gestures before deploying the optimized asset.');
