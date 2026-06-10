import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const layoutSource = await readFile(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

test('global UI theme uses #018FC7 as the darkest brand color', () => {
	assert.match(layoutSource, /--brand-dark:\s*#018FC7;/);
	assert.match(layoutSource, /--green:\s*var\(--brand-dark\);/);
	assert.match(layoutSource, /--blue:\s*var\(--brand-dark\);/);
	assert.doesNotMatch(layoutSource, /--green:\s*#167c64;/);
	assert.doesNotMatch(layoutSource, /--blue:\s*#245aa8;/);
});

test('header exposes bright and dark mode toggle before Korean nav links', () => {
	assert.match(layoutSource, /<html lang="ko" data-theme="bright">/);
	assert.match(layoutSource, /<button[\s\S]*data-theme-toggle[\s\S]*<\/button>[\s\S]*<nav aria-label="주요 메뉴">/);
	assert.match(layoutSource, /data-theme-label[\s\S]*밝은 모드/);
	assert.match(layoutSource, /data-theme-icon[\s\S]*☀/);
	assert.match(layoutSource, /document\.documentElement\.dataset\.theme = nextTheme;/);
});

test('selected item card keeps the protected design unchanged', () => {
	assert.match(indexSource, /\.selected-item-card \{[\s\S]*border: 2px solid #f4f1ff;[\s\S]*background: #4d4c78;[\s\S]*color: white;/);
	assert.match(indexSource, /\.selected-item-icon-frame \{[\s\S]*background: #c8c8d2;/);
});
