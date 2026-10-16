#!/usr/bin/env node
/**
 * Optional offline avatar optimization. Does not replace the production GLB.
 *
 * Install locally:
 *   npm install --no-save @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer
 * Run:
 *   node scripts/optimize-avatar.mjs
 *
 * Output: public/sarah-avatar-optimized.glb
 * Meshopt compression preserves existing textures, materials, animations and
 * morph targets; texture conversion is intentionally excluded until visual QA.
 */
import { NodeIO } from '@gltf-transform/core';
import { meshopt } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve('public/sarah-avatar.glb');
const target = resolve('public/sarah-avatar-optimized.glb');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});
const document = await io.read(source);
const inventory = (doc) => {
  const root = doc.getRoot();
  return {
    animations: root.listAnimations().length,
    skins: root.listSkins().length,
    skinnedNodes: root.listNodes().filter(node => node.getSkin()).length,
    meshes: root.listMeshes().length,
    morphTargets: root.listMeshes().reduce((count, mesh) =>
      count + mesh.listPrimitives().reduce((n, primitive) => n + primitive.listTargets().length, 0), 0),
  };
};
const before = inventory(document);
// Avoid structural transforms that may merge or remove avatar rig components.
await document.transform(meshopt({ encoder: MeshoptEncoder }));
await io.write(target, document);
const verified = await io.read(target);
const after = inventory(verified);
// Skin objects may be duplicated during glTF serialization when shared across nodes;
// validate skinned-node coverage instead of demanding identical skin object counts.
for (const field of ['animations', 'meshes', 'morphTargets', 'skinnedNodes']) {
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
  inventoryBefore: before,
  inventoryAfter: after,
  skinCountChanged: before.skins !== after.skins,
  productionAssetUnchanged: true,
}, null, 2));
if (before.skins !== after.skins) console.warn('Skin object count changed during serialization; manually verify rigging before deployment.');
console.log('Inspect appearance, skinning, facial expressions and gestures before deploying the optimized asset.');
