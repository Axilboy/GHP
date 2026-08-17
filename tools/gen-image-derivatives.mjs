// Генерация лёгких деривативов из мастеров арта + сгенерированный CSS-маппинг.
// Мастера 1600x1000 (и 800x800 для *-square) режутся в два размера под телефонную
// оболочку (<=512px): card (768x480) и thumb (160x160, центр-кроп), в AVIF + WebP.
// Плюс JPEG-версия og-обложки для соцпревью (WebP там ненадёжен у части краулеров).
//
// Запуск: node tools/gen-image-derivatives.mjs
// Повесить на build (см. package.json). Новый мастер -> добавить в MASTERS -> перегенерить.

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(root, 'src', 'assets');
const PUBLIC = join(root, 'public');

const CARD = { w: 768, h: 480 };
const THUMB = { w: 160, h: 160 };

// coverId — идентификатор, из которого CSS строит класс .cover-<id> и .store-card-thumb.cover-<id>.
// hero-классы (баннеры) описаны отдельно в HERO.
const themes = ['base','city','travel','secret','pop','movies','fantasy','harry-potter','lotr','retro-movies','video-games','memes','fandom','everyday','party','drinks','couples','family','office-party','after-dark','adult-couples','adult-party','bold','wasteland','space','mystic','hard-medical','bunker-classic'];
const items = ['home','party','gadgets','couples','after-dark','weird','alcohol','computer-games'];
const games = ['spy','alias','bunker','truthdare'];

const snake = (s) => s.replace(/-/g, '_');

const MASTERS = [
  ...themes.map((k) => ({ master: `ghp-theme-${k}`, coverId: snake(k) })),
  ...items.map((k) => ({ master: `ghp-item-${k}`, coverId: `items_${snake(k)}` })),
  // Квадратные превью игр -> миниатюры и карточки game-thumb / .cover-<game>
  ...games.map((g) => ({ master: `ghp-game-${g}-square`, coverId: g })),
  // Товары магазина
  { master: 'ghp-store-weekend', coverId: 'store_weekend' },
  { master: 'ghp-store-pro', coverId: 'store_pro' },
];

// Баннеры-герои (широкие). Класс -> мастер (берём широкий *-hero / hero-home).
const HERO = [
  { selectors: ['.hub-art', '.project-hero:before'], master: 'ghp-hero-home' },
  { selectors: ['.spy-art', '.spy-hero:before', '.landing-game-art.spy-art'], master: 'ghp-game-spy-hero' },
  { selectors: ['.alias-hero-art', '.alias-art', '.landing-game-art.alias-art'], master: 'ghp-game-alias-hero' },
  { selectors: ['.bunker-hero-art', '.landing-game-art.bunker-art'], master: 'ghp-game-bunker-hero' },
  { selectors: ['.truthdare-hero-art', '.truthdare-art', '.landing-game-art.truthdare-art'], master: 'ghp-game-truthdare-hero' },
];

const heroMasters = [...new Set(HERO.map((h) => h.master))];

async function derive(masterBase, variant, size) {
  const src = join(ASSETS, `${masterBase}.webp`);
  if (!existsSync(src)) { console.warn('  ! пропущен, нет мастера:', masterBase); return null; }
  const out = {};
  for (const [fmt, opts] of [['avif', { quality: 52, effort: 4 }], ['webp', { quality: 78 }]]) {
    const file = `${masterBase}-${variant}.${fmt}`;
    const buf = await sharp(src)
      .resize(size.w, size.h, { fit: 'cover', position: 'attention' })
      [fmt](opts)
      .toBuffer();
    writeFileSync(join(ASSETS, file), buf);
    out[fmt] = { file, kb: Math.round(buf.length / 1024) };
  }
  return out;
}

function imageSetRule(selector, base) {
  // webp-фолбэк первой строкой, image-set второй (кто не поддерживает image-set — берёт webp).
  return `${selector}{background-image:url("./${base}.webp")}\n`
    + `${selector}{background-image:image-set(url("./${base}.avif") type("image/avif"),url("./${base}.webp") type("image/webp"))}\n`;
}

async function main() {
  let css = '/* СГЕНЕРИРОВАНО tools/gen-image-derivatives.mjs — не редактировать вручную. */\n';
  let totalCard = 0, totalThumb = 0, n = 0;

  console.log('Мастера -> card(768x480) + thumb(160x160), AVIF+WebP:');
  for (const { master, coverId } of MASTERS) {
    const card = await derive(master, 'card', CARD);
    const thumb = await derive(master, 'thumb', THUMB);
    if (!card || !thumb) continue;
    n++;
    totalCard += card.webp.kb; totalThumb += thumb.webp.kb;
    css += imageSetRule(`.cover-${coverId}`, `${master}-card`);
    css += imageSetRule(`.store-card-thumb.cover-${coverId}`, `${master}-thumb`);
    css += imageSetRule(`.game-thumb.${coverId}`, `${master}-card`);
    console.log(`  ${master.padEnd(30)} card ${String(card.webp.kb).padStart(3)}KB/${String(card.avif.kb).padStart(3)}KB  thumb ${thumb.webp.kb}KB/${thumb.avif.kb}KB`);
  }

  console.log('Баннеры-герои (card):');
  for (const { selectors, master } of HERO) {
    const card = await derive(master, 'card', CARD);
    if (!card) continue;
    css += imageSetRule(selectors.join(','), `${master}-card`);
    console.log(`  ${master.padEnd(30)} ${card.webp.kb}KB/${card.avif.kb}KB  -> ${selectors.join(', ')}`);
  }

  writeFileSync(join(ASSETS, 'covers.generated.css'), css);
  console.log(`\ncovers.generated.css записан: ${n} тем/предметов/игр + ${HERO.length} героев.`);
  console.log(`Суммарно WebP: card ${totalCard}KB, thumb ${totalThumb}KB (весь каталог обложек).`);

  // og JPEG из мастера (не пережимаем готовый webp повторно — берём исходный мастер).
  const ogMaster = join(PUBLIC, 'ghp-og-cover.webp');
  if (existsSync(ogMaster)) {
    const jpg = await sharp(ogMaster).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    writeFileSync(join(PUBLIC, 'ghp-og-cover.jpg'), jpg);
    console.log(`ghp-og-cover.jpg: ${Math.round(jpg.length / 1024)}KB`);
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
