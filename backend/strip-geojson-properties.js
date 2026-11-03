#!/usr/bin/env node
/**
 * strip-geojson-properties.js
 *
 * Streams a large GeoJSON FeatureCollection (road_nodes.geojson / road_edges_cleaned.geojson)
 * character-by-character, extracts each top-level Feature individually, keeps only the
 * property keys actually used by the Cimahi Heritage importer (see
 * backend/src/scripts/import-routing-geojson.ts), and writes a much smaller "slim" GeoJSON
 * file to disk.
 *
 * This never holds the whole file (or the whole feature array) in memory at once — only one
 * Feature's raw text at a time — so it works even on machines with limited RAM, regardless of
 * how large the source file is.
 *
 * Usage:
 *   node strip-geojson-properties.js --type nodes --in road_nodes.geojson --out road_nodes.slim.geojson
 *   node strip-geojson-properties.js --type edges --in road_edges_cleaned.geojson --out road_edges_cleaned.slim.geojson
 *
 * No external dependencies — plain Node.js (fs streams) only.
 */

const fs = require('fs');
const readline = require('readline');

// Keep only what backend/src/scripts/import-routing-geojson.ts actually reads.
const NODE_KEEP_KEYS = new Set(['node_id']);
const EDGE_KEEP_KEYS = new Set([
  'edge_id',
  'id',
  'length_m',
  'cost',
  'reverse_cost',
  'oneway',
  'sakoci_allowed',
  'name',
  'road_name',
]);

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const type = get('--type');
  const inPath = get('--in');
  const outPath = get('--out');
  if (!type || !inPath || !outPath || !['nodes', 'edges'].includes(type)) {
    console.error(
      'Usage: node strip-geojson-properties.js --type nodes|edges --in <path> --out <path>',
    );
    process.exit(1);
  }
  return { type, inPath, outPath };
}

/**
 * Streams the input file char-by-char (via chunked read, not line-by-line — GeoJSON files
 * are not guaranteed to have one feature per line) and yields each top-level object found
 * inside the "features" array as a raw JSON substring, using brace-depth tracking that
 * respects strings/escapes so braces inside string values don't confuse it.
 */
async function* iterateFeatures(inPath) {
  const stream = fs.createReadStream(inPath, { encoding: 'utf8', highWaterMark: 1 << 20 });

  let buffer = '';
  let depth = 0;
  let inFeatures = false;
  let inString = false;
  let escaped = false;
  let featureStart = -1;
  let seenFeaturesKey = false;
  // Absolute index into `buffer` where scanning should resume. Using a persistent index
  // (instead of restarting at 0 each chunk) is essential: the tail of `buffer` carried
  // over from the previous chunk (an in-progress feature) was already scanned once, and
  // re-scanning it would double-count brace depth.
  let i = 0;

  for await (const chunk of stream) {
    buffer += chunk;

    while (i < buffer.length) {
      const ch = buffer[i];

      if (!seenFeaturesKey) {
        if (!inFeatures && buffer.startsWith('"features"', i)) {
          seenFeaturesKey = true;
          inFeatures = true;
          i += '"features"'.length;
          continue;
        }
        i += 1;
        continue;
      }

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        i += 1;
        continue;
      }

      if (ch === '"') {
        inString = true;
        i += 1;
        continue;
      }

      if (ch === '{') {
        if (depth === 0) featureStart = i;
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0 && featureStart >= 0) {
          yield buffer.slice(featureStart, i + 1);
          featureStart = -1;
        }
      }

      i += 1;
    }

    // Trim everything already fully consumed. Keep only the tail starting at the current
    // in-progress feature (if any), and shift `i` back by the same amount so scanning
    // resumes exactly where it left off once more data arrives.
    const keepFrom = featureStart >= 0 ? featureStart : buffer.length;
    buffer = buffer.slice(keepFrom);
    i -= keepFrom;
    featureStart = featureStart >= 0 ? 0 : -1;
  }
}

function slimNodeFeature(raw) {
  let feature;
  try {
    feature = JSON.parse(raw);
  } catch {
    return null;
  }
  if (feature?.geometry?.type !== 'Point') return null;
  const props = feature.properties ?? {};
  const slimProps = {};
  for (const key of NODE_KEEP_KEYS) {
    if (props[key] !== undefined) slimProps[key] = props[key];
  }
  return {
    type: 'Feature',
    properties: slimProps,
    geometry: feature.geometry,
  };
}

function slimEdgeFeature(raw) {
  let feature;
  try {
    feature = JSON.parse(raw);
  } catch {
    return null;
  }
  if (feature?.geometry?.type !== 'LineString') return null;
  const props = feature.properties ?? {};
  const slimProps = {};
  for (const key of EDGE_KEEP_KEYS) {
    if (props[key] !== undefined) slimProps[key] = props[key];
  }
  return {
    type: 'Feature',
    properties: slimProps,
    geometry: feature.geometry,
  };
}

async function main() {
  const { type, inPath, outPath } = parseArgs();
  const slimFn = type === 'nodes' ? slimNodeFeature : slimEdgeFeature;

  const out = fs.createWriteStream(outPath, { encoding: 'utf8' });
  out.write('{"type":"FeatureCollection","features":[\n');

  let count = 0;
  let skipped = 0;
  let first = true;

  for await (const rawFeature of iterateFeatures(inPath)) {
    const slim = slimFn(rawFeature);
    if (!slim) {
      skipped += 1;
      continue;
    }
    if (!first) out.write(',\n');
    first = false;
    out.write(JSON.stringify(slim));
    count += 1;
    if (count % 20000 === 0) {
      console.log(`  ... ${count} feature diproses`);
    }
  }

  out.write('\n]}\n');
  await new Promise((resolve, reject) => {
    out.end((err) => (err ? reject(err) : resolve()));
  });

  console.log(`Selesai: ${count} feature ditulis ke ${outPath}, ${skipped} feature dilewati (geometry tidak cocok / parse gagal).`);
}

main().catch((err) => {
  console.error('Gagal:', err);
  process.exitCode = 1;
});
