import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const mojibakeFragments = [
  'Р',
  'Рџ',
  'Рў',
  'Рњ',
  'Рќ',
  'Р’',
  'Рі',
  'Р°',
  'Рµ',
  'РЎ',
  'СЃ',
  'С‚',
  'СЊ',
  'вЂ',
  'в‚',
  'Г—',
  'в€',
  'В·',
  'В«',
  'В»',
  '�',
];

test('public-facing sources do not contain broken UTF-8 text', () => {
  for (const file of ['src/App.jsx', 'src/RoadmapPanels.jsx', 'src/identity.js', 'src/socket.js', 'server/index.js', 'server/profileStore.js', 'README.md', 'PROJECT_STATE.md']) {
    const text = fs.readFileSync(path.resolve(file), 'utf8');
    for (const fragment of mojibakeFragments) {
      assert.equal(text.includes(fragment), false, `${file} contains mojibake fragment: ${fragment}`);
    }
  }
});
