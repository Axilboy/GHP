import test from 'node:test';
import assert from 'node:assert/strict';
import { getContentThemeIds, getThemePass, listThemePasses } from './thematicPasses.js';

test('franchise theme passes unlock specific and umbrella fandom content', () => {
  const passes = listThemePasses().map((pass) => pass.id);
  assert.ok(passes.includes('theme_harry_potter'));
  assert.ok(passes.includes('theme_lotr'));
  assert.ok(passes.includes('theme_retro_movies'));
  assert.ok(passes.includes('theme_video_games'));
  assert.equal(getThemePass('theme_harry_potter').themeId, 'harry_potter');

  assert.deepEqual(getContentThemeIds('spy', 'harry_potter'), ['harry_potter', 'fandom']);
  assert.deepEqual(getContentThemeIds('alias', 'video_games'), ['video_games', 'fandom']);
  assert.deepEqual(getContentThemeIds('bunker', 'lotr'), ['lotr', 'fandom']);
  assert.deepEqual(getContentThemeIds('truthdare', 'retro_movies'), ['retro_movies', 'fandom']);
});
