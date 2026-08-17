import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalRedirectTarget, publicPages, renderPublicPage } from './publicPages.js';

const template = '<!doctype html><html><head><title>Old</title><meta name="description" content="old"><meta property="og:title" content="old"><meta property="og:description" content="old"><meta property="og:url" content="old"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';

test('every public page gets server-rendered content and canonical metadata', () => {
  for (const [pathname, page] of Object.entries(publicPages)) {
    const html = renderPublicPage(template, pathname);
    assert.match(html, new RegExp(page.heading));
    assert.match(html, new RegExp(`<title>${page.title}`));
    assert.match(html, new RegExp(`rel="canonical" href="https://gamehubparty.ru${pathname === '/' ? '/' : pathname}`));
    assert.match(html, new RegExp(page.index === false ? 'noindex,follow' : 'index,follow'));
  }
});

test('unknown routes do not render the SPA shell', () => {
  assert.equal(renderPublicPage(template, '/definitely-not-real'), null);
});

test('www host redirects to the canonical apex domain', () => {
  assert.equal(canonicalRedirectTarget('www.gamehubparty.ru', '/games/spy?x=1'), 'https://gamehubparty.ru/games/spy?x=1');
  assert.equal(canonicalRedirectTarget('gamehubparty.ru', '/'), null);
});
