const path = require('node:path');
const {
  buildPatentSequenceIndexFromFile,
  writePatentSequenceIndex
} = require('./patent-sequence-service.cjs');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'invest-on-invent-kg.json', 'invest-on-invent-KG.json');
const outputPath = path.join(__dirname, 'patent-sequence-index.json');

const startedAt = Date.now();
const index = buildPatentSequenceIndexFromFile(sourcePath);
writePatentSequenceIndex(outputPath, index);

console.log(JSON.stringify({
  outputPath,
  generatedAt: index.meta.generatedAt,
  patentCount: index.meta.patentCount,
  companyCount: index.meta.companyCount,
  relationCount: index.meta.relationCount,
  linkedPatentCount: index.meta.linkedPatentCount,
  sharedPatentCount: index.meta.sharedPatentCount,
  unlinkedPatentCount: index.meta.unlinkedPatentCount,
  elapsedMs: Date.now() - startedAt
}, null, 2));
