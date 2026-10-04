import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/');
  if (await page.locator('#studio-toggle').getAttribute('aria-expanded') === 'false') {
    await page.locator('#studio-toggle').click();
  }
  await expect(page.locator('#motion-studio')).toHaveAttribute('data-ready', 'true');
  await page.locator('#studio-canvas').scrollIntoViewIfNeeded();
}

async function clickWorldPoint(page, x, y, z, { touch = false } = {}) {
  await page.locator('#studio-canvas').scrollIntoViewIfNeeded();
  const point = await page.evaluate(async ({ x, y, z }) => {
    const THREE = await import('/assets/js/vendor/three.module.min.js');
    const rect = document.getElementById('studio-canvas').getBoundingClientRect();
    const aspect = rect.width / rect.height;
    const height = Math.max(4.25, 7.8 / aspect);
    const camera = new THREE.OrthographicCamera(-height * aspect / 2, height * aspect / 2, height / 2, -height / 2, 0.1, 50);
    camera.position.set(6.3, 7, 10);
    camera.lookAt(0, 0.25, 0);
    camera.updateMatrixWorld();
    const screen = new THREE.Vector3(x, y, z).project(camera);
    return { x: rect.left + (screen.x + 1) * rect.width / 2, y: rect.top + (1 - screen.y) * rect.height / 2 };
  }, { x, y, z });
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

async function expectHeaderHelpLayout(page) {
  const help = page.locator('#studio-help');
  await expect(help).toHaveCount(1);
  await expect(page.getByText('Click to walk · Select an object', { exact: true })).toHaveCount(1);
  await expect(page.locator('.studio-heading > #studio-help')).toBeVisible();
  await expect(page.locator('.studio-controls, .studio-actions, [data-studio-action]')).toHaveCount(0);
  await expect(page.locator('#studio-canvas')).toHaveAttribute('aria-describedby', 'studio-help');
  await expect(page.locator('#studio-panel')).toHaveCSS('padding-bottom', '16px');
  const titleBox = await page.locator('.studio-title').boundingBox();
  const helpBox = await help.boundingBox();
  const stageBox = await page.locator('#studio-stage').boundingBox();
  const panelBox = await page.locator('#studio-panel').boundingBox();
  expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(helpBox.y);
  expect(helpBox.y + helpBox.height).toBeLessThanOrEqual(stageBox.y);
  expect(panelBox.y + panelBox.height - stageBox.y - stageBox.height).toBeCloseTo(16, 0);
}

test('desktop starts folded below About Me on every load while manual theme survives reload', async ({ page }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.addInitScript(() => localStorage.setItem('kunho-studio-open', 'true'));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('#studio-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#studio-panel')).toBeHidden();
  expect(requests.some(url => url.includes('/studio/scene.js') || url.includes('/vendor/three'))).toBe(false);
  await page.locator('#studio-toggle').click();
  await expect(page.locator('#motion-studio')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#studio-toggle')).toHaveAttribute('aria-expanded', 'true');
  const studio = await page.locator('#motion-studio').boundingBox();
  const about = await page.getByRole('heading', { name: 'About Me', exact: true }).boundingBox();
  const introduction = await page.locator('.studio-invitation').locator('xpath=preceding-sibling::p[1]').boundingBox();
  const invitation = await page.locator('.studio-invitation').boundingBox();
  expect(about.y + about.height).toBeLessThan(introduction.y + 2);
  expect(introduction.y + introduction.height).toBeLessThan(invitation.y + 2);
  expect(invitation.y + invitation.height).toBeLessThan(studio.y + 2);
  await expect(page.locator('.studio-invitation svg')).toBeVisible();
  await expect(page.locator('#motion-studio')).not.toContainText('Motion Studio');
  await expect(page.locator('#motion-studio')).not.toContainText('Human motion, in context');
  await expect(page.getByText('3D Interaction', { exact: true })).toBeVisible();
  await expect(page.locator('#studio-motion')).toHaveCount(0);
  await expectHeaderHelpLayout(page);
  await page.locator('#studio-theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(32, 33, 43)');
  await page.locator('#studio-toggle').click();
  await expect(page.locator('#studio-panel')).toBeHidden();
  await expect(page.locator('#studio-theme')).toBeHidden();
  await expect(page.getByText('3D Interaction', { exact: true })).toBeHidden();
  const folded = await page.locator('#motion-studio').boundingBox();
  const shell = await page.locator('#studio-shell').boundingBox();
  expect(folded.width).toBeCloseTo(44, 0);
  expect(folded.height).toBeCloseTo(44, 0);
  expect(folded.x).toBeCloseTo(shell.x, 0);
  await page.reload();
  await expect(page.locator('#studio-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#studio-toggle').click();
  await expect(page.locator('#motion-studio')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByText('3D Interaction', { exact: true })).toBeVisible();
  await page.locator('#studio-theme').click();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.reload();
  await expect(page.locator('#studio-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#studio-panel')).toBeHidden();
  expect(errors).toEqual([]);
});

test('lamp theme changes on contact, with motion suspended while folded', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await ready(page);
  await clickWorldPoint(page, 0.56, 1.72, -1.30);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#studio-toggle').click();
  // Waiting beyond the normal walk/contact duration catches hidden animation.
  await page.waitForTimeout(5500);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#studio-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 15000 });
  await clickWorldPoint(page, 0.56, 1.72, -1.30);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light', { timeout: 10000 });
});

test('the bookshelf lists publications and only the chosen paper link navigates', async ({ page }) => {
  await ready(page);
  const position = await page.evaluate(() => window.scrollY);
  const publications = await page.locator('[data-studio-publication]').evaluateAll(entries => entries.map(entry => ({
    title: entry.dataset.title, href: entry.dataset.href,
  })));
  await clickWorldPoint(page, -2.50, 1.54, 0.40);
  await expect(page.locator('#studio-book-card')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.studio-book-list button')).toHaveCount(publications.length);
  await expect(page.locator('#studio-card-eyebrow')).toHaveText(`Publications · ${publications.length} Papers`);
  for (let index = 0; index < publications.length; index++) {
    await expect(page.locator(`[data-publication-index="${index}"]`)).toContainText(publications[index].title);
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(position);
  expect(new URL(page.url()).hash).toBe('');
  await page.locator('#studio-card-close').click();
  await expect(page.locator('#studio-book-card')).toBeHidden();
  await expect(page.locator('#studio-canvas')).toBeFocused();
  await clickWorldPoint(page, -2.50, 1.54, 0.40);
  await expect(page.locator('#studio-book-card')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-publication-index="0"]').focus();
  await page.locator('[data-publication-index="2"]').press('Enter');
  await expect(page.locator('#studio-book-card')).toHaveAttribute('data-reading', 'publication:2');
  await expect(page.locator('.studio-publication-title')).toHaveText(publications[2].title);
  await expect(page.locator('#studio-publication-link')).toBeFocused();
  await expect(page.locator('#studio-publication-link')).toHaveAttribute('href', publications[2].href);
  await expect(page.locator('#studio-book-card a')).toHaveCount(1);
  await expect(page.locator('#studio-book-card a')).toHaveText('View publication ↗');
  expect(await page.evaluate(() => window.scrollY)).toBe(position);
  expect(new URL(page.url()).hash).toBe('');
  await page.locator('#studio-publication-link').click();
  expect(new URL(page.url()).hash).toBe(publications[2].href);
  await expect(page.locator(publications[2].href)).toBeFocused();
});

test('newspaper shares the full News content and its optional link controls navigation', async ({ page }) => {
  await ready(page);
  const position = await page.evaluate(() => window.scrollY);
  const expected = await page.locator('.news-list > li').evaluateAll(entries => entries.map(entry => {
    const clone = entry.cloneNode(true);
    const date = clone.querySelector('strong');
    const dateText = date.textContent.replace(/^\[|\]$/g, '');
    date.remove();
    return { date: dateText, html: clone.innerHTML.trim() };
  }));
  await clickWorldPoint(page, -1.23, 0.99, -1.02);
  await expect(page.locator('#studio-book-card')).toHaveAttribute('data-reading', 'news', { timeout: 15000 });
  await expect(page.locator('.studio-news-list > li')).toHaveCount(expected.length);
  const actual = await page.locator('.studio-news-list > li').evaluateAll(entries => entries.map(entry => ({
    date: entry.querySelector('.studio-news-date').textContent,
    html: entry.querySelector('.studio-news-copy').innerHTML.trim(),
  })));
  expect(actual).toEqual(expected);
  expect(await page.evaluate(() => window.scrollY)).toBe(position);
  expect(new URL(page.url()).hash).toBe('');
  await page.locator('.studio-news-link').click();
  await expect(page).toHaveURL(/#news$/);
  await expect(page.locator('#news')).toBeFocused();
});

test('folding animates to an icon and rapid reversals preserve the final state', async ({ page }) => {
  await ready(page);
  const frame = await page.evaluate(() => {
    const container = document.getElementById('motion-studio');
    const before = container.getBoundingClientRect();
    document.getElementById('studio-toggle').click();
    const animation = container.getAnimations()[0];
    animation.pause();
    animation.currentTime = 150;
    const during = container.getBoundingClientRect();
    return { before: before.width, during: during.width, panelHidden: document.getElementById('studio-panel').hidden };
  });
  expect(frame.during).toBeGreaterThan(44);
  expect(frame.during).toBeLessThan(frame.before);
  expect(frame.panelHidden).toBe(false);
  await page.evaluate(() => {
    const toggle = document.getElementById('studio-toggle');
    toggle.click();
    toggle.click();
    toggle.click();
  });
  await expect(page.locator('#studio-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#studio-panel')).toBeVisible();
  await expect.poll(() => page.locator('#motion-studio').evaluate(element => element.getAnimations().length)).toBe(0);
  await page.locator('#studio-toggle').click();
  await expect(page.locator('#studio-panel')).toBeHidden();
  await expect(page.locator('#motion-studio')).toHaveCSS('width', '44px');
});

test('the 3D floor and lamp themselves respond to pointer picking', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await ready(page);
  await clickWorldPoint(page, -1.9, 0, 1.05);
  await expect(page.locator('#studio-status')).toContainText('Walking to the selected spot');
  await expect(page.locator('#studio-status')).toHaveText('Ready to explore.');
  await clickWorldPoint(page, 0.56, 1.72, -1.30);
  await expect(page.locator('#studio-status')).toContainText('Walking to the lamp');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 16000 });
});

test('mobile starts folded without fetching the scene and supports touch controls', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('#studio-panel')).toBeHidden();
  const folded = await page.locator('#motion-studio').boundingBox();
  const shell = await page.locator('#studio-shell').boundingBox();
  expect(folded.x).toBeCloseTo(shell.x, 0);
  expect(requests.some(url => url.includes('/vendor/three'))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('#studio-toggle').tap();
  await expect(page.locator('#motion-studio')).toHaveAttribute('data-ready', 'true');
  await expectHeaderHelpLayout(page);
  await clickWorldPoint(page, -2.50, 1.54, 0.40, { touch: true });
  await expect(page.locator('#studio-book-card')).toBeVisible({ timeout: 15000 });
  await context.close();
});

test('reduced motion permits keyboard commands and folds instantly without a pause control', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await ready(page);
  await expect(page.locator('#studio-motion')).toHaveCount(0);
  await page.locator('#studio-canvas').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#studio-status')).toContainText('Walking');
  await page.locator('#studio-theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const folded = await page.evaluate(() => {
    document.getElementById('studio-toggle').click();
    return { hidden: document.getElementById('studio-panel').hidden, animations: document.getElementById('motion-studio').getAnimations().length };
  });
  expect(folded).toEqual({ hidden: true, animations: 0 });
});

test('blocked storage does not prevent interaction', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } });
  });
  await ready(page);
  await page.locator('#studio-theme').click();
  await page.locator('#studio-toggle').click();
  await expect(page.locator('#studio-panel')).toBeHidden();
});

test('WebGL failure preserves the page and direct theme/publication controls', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (name, ...args) {
      if (name.startsWith('webgl')) return null;
      return original.call(this, name, ...args);
    };
  });
  await page.goto('/');
  await page.locator('#studio-toggle').click();
  await expect(page.locator('#studio-fallback')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'About Me', exact: true })).toBeVisible();
  await expect(page.locator('#studio-fallback a')).toHaveAttribute('href', '#publications');
  await page.locator('#studio-theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/);
});

test('preview renders every publication as HTML without Markdown code blocks', async ({ page }) => {
  await page.goto('/');
  const publicationCount = await page.locator('[data-studio-publication]').count();
  await expect(page.locator('.publications ol.bibliography > li')).toHaveCount(publicationCount);
  await expect(page.locator('.publications pre, .publications code')).toHaveCount(0);
  await expect(page.locator('.publications .title')).toHaveCount(publicationCount);
  await expect(page.locator('.publications .title').nth(2)).toContainText('ParTY');
});
