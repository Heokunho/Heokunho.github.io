import { test, expect } from '@playwright/test';

// Observe the real rig in the browser without adding diagnostics to production.
async function observeAvatar(page) {
  await page.route('**/studio/avatar.js', async route => {
    const response = await route.fetch();
    const source = (await response.text()).replace('export function createAvatar()', 'function buildAvatar()');
    await route.fulfill({ response, body: source + `
export function createAvatar() {
  const avatar = buildAvatar();
  const update = avatar.update;
  avatar.update = function (pose = {}) {
    update(pose);
    avatar.root.updateMatrixWorld(true);
    const snapshot = {
      x: avatar.root.position.x,
      z: avatar.root.position.z,
      visible: avatar.root.visible,
      open: document.getElementById('motion-studio').dataset.open,
      doorAngle: window.__studioRoom?.root.getObjectByName('Exit door hinge')?.rotation.y || 0,
    };
    window.__studioPose = snapshot;
    if (window.__studioCapture) window.__studioFrames.push(snapshot);
  };
  window.__studioFrames = [];
  return avatar;
}
` });
  });
  await page.goto('/');
  if (await page.locator('#studio-toggle').getAttribute('aria-expanded') === 'false') {
    await page.locator('#studio-toggle').click();
  }
  await expect(page.locator('#motion-studio')).toHaveAttribute('data-ready', 'true');
}

// Inspect and click the authored geometry through the real scene's picking path.
async function observeRoom(page, navigate = true) {
  await page.route('**/studio/room.js', async route => {
    const response = await route.fetch();
    const source = (await response.text()).replace('export function createRoom(', 'function buildRoom(');
    await route.fulfill({ response, body: source + `
export function createRoom(content) {
  const room = buildRoom(content);
  window.__studioRoom = room;
  window.__studioContent = content;
  return room;
}
` });
  });
  if (navigate) {
    await page.goto('/');
    if (await page.locator('#studio-toggle').getAttribute('aria-expanded') === 'false') {
      await page.locator('#studio-toggle').click();
    }
    await expect(page.locator('#motion-studio')).toHaveAttribute('data-ready', 'true');
  }
}

async function objectPoint(page, name, publicationIndex, localPoint) {
  await page.locator('#studio-canvas').scrollIntoViewIfNeeded();
  return page.evaluate(async ({ name, publicationIndex, localPoint }) => {
    const THREE = await import('/assets/js/vendor/three.module.min.js');
    const room = window.__studioRoom;
    room.root.updateMatrixWorld(true);
    let target;
    room.root.traverse(node => {
      if (name === 'book' && node.userData.publicationIndex === publicationIndex) target = node;
      if (name === 'news' && node.name === 'Research newspaper') target = node;
      if (name === 'door' && node.name === 'Exit door') target = node;
      if (name === 'lamp' && node.name === 'Theme lamp') target = node;
    });
    const point = name === 'floor'
      ? new THREE.Vector3(...(localPoint || [1.3, 0, 1.1]))
      : name === 'book'
        ? target.children.find(node => node.geometry?.type === 'PlaneGeometry').getWorldPosition(new THREE.Vector3())
        : name === 'door'
          ? target.localToWorld(new THREE.Vector3(...(localPoint || [0, 1.15, -0.04])))
          : name === 'lamp'
            ? target.localToWorld(new THREE.Vector3(-0.20, 1.72, 0))
            : target.localToWorld(new THREE.Vector3(-0.15, 0.015, 0));
    const rect = document.getElementById('studio-canvas').getBoundingClientRect();
    const aspect = rect.width / rect.height;
    const height = Math.max(4.25, 7.8 / aspect);
    const camera = new THREE.OrthographicCamera(-height * aspect / 2, height * aspect / 2, height / 2, -height / 2, 0.1, 50);
    camera.position.set(6.3, 7, 10);
    camera.lookAt(0, 0.25, 0);
    camera.updateMatrixWorld();
    point.project(camera);
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
  }, { name, publicationIndex, localPoint });
}

async function highlightedObjects(page) {
  return page.evaluate(() => [...window.__studioRoom.highlights]
    .filter(([, entry]) => entry.amount > 0.001 && entry.meshes.some(node => {
      if (!node.geometry?.attributes.position.count) return false;
      for (let ancestor = node; ancestor; ancestor = ancestor.parent) {
        if (!ancestor.visible) return false;
      }
      return true;
    }))
    .map(([name]) => name).sort());
}

async function originalSurfaceColors(page) {
  return page.evaluate(() => {
    const materials = new Map();
    window.__studioRoom.root.traverse(node => {
      const material = node.material;
      if (!material || material.name.includes(' highlight ')) return;
      materials.set(material.uuid, {
        color: material.color?.getHexString(),
        emissive: material.emissive?.getHexString(),
        emissiveIntensity: material.emissiveIntensity,
      });
    });
    return Object.fromEntries(materials);
  });
}

test('desktop hover highlights only the pointed object in both themes and clears on leave or fold', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await observeRoom(page);
  const hardOutlines = await page.evaluate(() => {
    const names = [];
    window.__studioRoom.root.traverse(node => {
      if (node.isLineSegments && /highlight/i.test(node.name)) names.push(node.name);
    });
    return names;
  });
  expect(hardOutlines).toEqual([]);
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.locator('#studio-theme').click();
    }
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const surfaces = await originalSurfaceColors(page);
    for (const [name, expected] of [['book', 'books'], ['lamp', 'lamp'], ['news', 'news'], ['door', 'door']]) {
      const point = await objectPoint(page, name, 0);
      await page.mouse.move(point.x, point.y);
      await expect(page.locator('#studio-canvas')).toHaveAttribute('data-hover', expected);
      await expect.poll(() => highlightedObjects(page)).toEqual([expected]);
      expect(await originalSurfaceColors(page)).toEqual(surfaces);
    }
    await page.mouse.move(0, 0);
    await expect.poll(() => highlightedObjects(page)).toEqual([]);
  }
  const lamp = await objectPoint(page, 'lamp');
  await page.mouse.move(lamp.x, lamp.y);
  await expect.poll(() => highlightedObjects(page)).toEqual(['lamp']);
  await page.evaluate(() => document.getElementById('studio-toggle').click());
  await expect(page.locator('#studio-panel')).toBeHidden();
  expect(await highlightedObjects(page)).toEqual([]);
  await page.locator('#studio-toggle').click();
  await expect(page.locator('#studio-panel')).toBeVisible();
  expect(await highlightedObjects(page)).toEqual([]);
});

test('the selected object casts a soft halo beyond its silhouette', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await observeRoom(page);
  await page.addStyleTag({ content: '#studio-hover { visibility: hidden !important; }' });
  const point = await objectPoint(page, 'lamp');
  await page.mouse.move(0, 0);
  const canvas = page.locator('#studio-canvas');
  const bounds = await page.evaluate(async () => {
    const THREE = await import('/assets/js/vendor/three.module.min.js');
    const room = window.__studioRoom;
    room.root.updateMatrixWorld(true);
    const { width, height } = document.getElementById('studio-canvas').getBoundingClientRect();
    const aspect = width / height;
    const span = Math.max(4.25, 7.8 / aspect);
    const camera = new THREE.OrthographicCamera(-span * aspect / 2, span * aspect / 2, span / 2, -span / 2, 0.1, 50);
    camera.position.set(6.3, 7, 10);
    camera.lookAt(0, 0.25, 0);
    camera.updateMatrixWorld();
    const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    const vertex = new THREE.Vector3();
    for (const mesh of room.highlights.get('lamp').meshes) {
      const positions = mesh.geometry.attributes.position;
      for (let index = 0; index < positions.count; index++) {
        vertex.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld).project(camera);
        const x = (vertex.x + 1) * width / 2;
        const y = (1 - vertex.y) * height / 2;
        bounds.minX = Math.min(bounds.minX, x);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxY = Math.max(bounds.maxY, y);
      }
    }
    return bounds;
  });
  const before = await canvas.screenshot({ scale: 'css' });
  await page.mouse.move(point.x, point.y);
  await expect.poll(() => highlightedObjects(page)).toEqual(['lamp']);
  const after = await canvas.screenshot({ scale: 'css' });
  await testInfo.attach('lamp-halo', { body: after, contentType: 'image/png' });
  const pixels = await page.evaluate(async ({ before, after, bounds }) => {
    async function decode(base64) {
      const image = new Image();
      image.src = 'data:image/png;base64,' + base64;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    }
    const [plain, highlighted] = await Promise.all([decode(before), decode(after)]);
    const peaks = [0, 0, 0];
    const levels = new Set();
    let exteriorPixels = 0;
    for (let y = Math.max(0, Math.floor(bounds.minY - 12)); y < Math.min(plain.height, Math.ceil(bounds.maxY + 12)); y++) {
      for (let x = Math.max(0, Math.floor(bounds.minX - 12)); x < Math.min(plain.width, Math.ceil(bounds.maxX + 12)); x++) {
        const distance = Math.max(bounds.minX - x, x - bounds.maxX, bounds.minY - y, y - bounds.maxY);
        if (distance < 1 || distance >= 12) continue;
        const offset = (y * plain.width + x) * 4;
        const delta = Math.max(...[0, 1, 2].map(channel => Math.abs(plain.data[offset + channel] - highlighted.data[offset + channel])));
        const band = distance < 3 ? 0 : distance < 6 ? 1 : 2;
        peaks[band] = Math.max(peaks[band], delta);
        if (delta > 0) {
          exteriorPixels++;
          levels.add(delta);
        }
      }
    }
    return { peaks, exteriorPixels, levels: levels.size };
  }, { before: before.toString('base64'), after: after.toString('base64'), bounds });
  // A frame or surface tint cannot change pixels this far outside the geometry.
  expect(pixels.exteriorPixels).toBeGreaterThan(10);
  expect(pixels.peaks[0]).toBeGreaterThan(2);
  expect(pixels.peaks[1]).toBeGreaterThan(0);
  expect(pixels.peaks[0]).toBeGreaterThan(pixels.peaks[2]);
  expect(pixels.levels).toBeGreaterThanOrEqual(3);
});

test('mobile taps briefly highlight objects while floor taps, swipes, cancellation and folding clear feedback', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  try {
    await observeRoom(page);
    const lamp = await objectPoint(page, 'lamp');
    await page.touchscreen.tap(lamp.x, lamp.y);
    expect(await highlightedObjects(page)).toEqual(['lamp']);
    await expect(page.locator('#studio-hover')).toBeHidden();
    // Real touch completion dispatches pointerleave: the tap feedback must survive it.
    await page.waitForTimeout(200);
    expect(await highlightedObjects(page)).toEqual(['lamp']);
    const book = await objectPoint(page, 'book', 0);
    await page.touchscreen.tap(book.x, book.y);
    expect(await highlightedObjects(page)).toEqual(['books']);
    const floor = await objectPoint(page, 'floor');
    await page.touchscreen.tap(floor.x, floor.y);
    expect(await highlightedObjects(page)).toEqual([]);
    await expect(page.locator('#studio-status')).toHaveText('Walking to the selected spot.');

    const canvas = page.locator('#studio-canvas');
    const touch = { pointerType: 'touch', pointerId: 10, isPrimary: true, button: 0, clientX: lamp.x, clientY: lamp.y };
    // End the swipe on the lamp so a mistaken click would visibly select it.
    await canvas.dispatchEvent('pointerdown', { ...touch, clientY: touch.clientY - 30 });
    await canvas.dispatchEvent('pointermove', touch);
    await canvas.dispatchEvent('pointerup', touch);
    expect(await highlightedObjects(page)).toEqual([]);
    await canvas.dispatchEvent('pointerdown', touch);
    await canvas.dispatchEvent('pointercancel', touch);
    await canvas.dispatchEvent('pointerup', touch);
    expect(await highlightedObjects(page)).toEqual([]);
    await expect(page.locator('#studio-status')).not.toHaveText('Walking to the lamp.');

    await page.touchscreen.tap(book.x, book.y);
    expect(await highlightedObjects(page)).toEqual(['books']);
    await expect.poll(() => highlightedObjects(page), { timeout: 3000 }).toEqual([]);
    await page.touchscreen.tap(lamp.x, lamp.y);
    expect(await highlightedObjects(page)).toEqual(['lamp']);
    await canvas.dispatchEvent('pointercancel', touch);
    expect(await highlightedObjects(page)).toEqual([]);
    await page.touchscreen.tap(book.x, book.y);
    expect(await highlightedObjects(page)).toEqual(['books']);
    await page.locator('#studio-toggle').tap();
    await expect(page.locator('#studio-panel')).toBeHidden();
    expect(await highlightedObjects(page)).toEqual([]);
    await page.locator('#studio-toggle').tap();
    await expect(page.locator('#studio-panel')).toBeVisible();
    expect(await highlightedObjects(page)).toEqual([]);
  } finally {
    await context.close();
  }
});

for (const width of [1280, 390]) {
  test(`Door tooltip follows the cursor and stays inside the scene at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await observeRoom(page);
    await page.locator('#studio-canvas').scrollIntoViewIfNeeded();
    const tooltip = page.locator('#studio-hover');
    let previous;
    for (const localPoint of [[-0.22, 1.15, -0.04], [0.22, 1.15, -0.04]]) {
      const point = await objectPoint(page, 'door', undefined, localPoint);
      await page.mouse.move(point.x, point.y);
      await expect(page.locator('#studio-canvas')).toHaveAttribute('data-hover', 'door');
      await expect(tooltip).toHaveText('Door');
      await expect(tooltip).toBeVisible();
      const box = await tooltip.boundingBox();
      const stage = await page.locator('.studio-stage').boundingBox();
      // A short label should remain beside the cursor, even near the right edge.
      expect(Math.abs(box.x - point.x)).toBeLessThanOrEqual(20);
      expect(Math.abs(box.y + box.height - point.y)).toBeLessThanOrEqual(16);
      expect(box.x).toBeGreaterThanOrEqual(stage.x + 7);
      expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width - 7);
      expect(box.y).toBeGreaterThanOrEqual(stage.y + 7);
      expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height - 7);
      if (previous) {
        expect(Math.abs(box.x - previous.x) + Math.abs(box.y - previous.y)).toBeGreaterThan(4);
      }
      previous = box;
    }
  });
}

test('book spines all select the bookshelf and papers are chosen from its list', async ({ page }) => {
  await observeRoom(page);
  const content = await page.evaluate(() => {
    const books = [];
    window.__studioRoom.root.traverse(node => {
      if (Number.isInteger(node.userData.publicationIndex)) books.push(node.userData.publicationIndex);
    });
    return { books, publications: window.__studioContent.publications };
  });
  const count = await page.locator('[data-studio-publication]').count();
  expect(content.books).toEqual(Array.from({ length: count }, (_, index) => index));
  for (let index = 0; index < count; index++) {
    const point = await objectPoint(page, 'book', index);
    await page.mouse.move(point.x, point.y);
    await expect(page.locator('#studio-canvas')).toHaveAttribute('data-hover', 'books');
    await expect(page.locator('#studio-hover')).toHaveText('Bookshelf · publications');
  }
  const point = await objectPoint(page, 'book', 2);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#studio-book-card')).toBeHidden();
  await expect(page.locator('#studio-book-card')).toHaveAttribute('data-reading', 'books', { timeout: 15000 });
  await expect(page.locator('#studio-card-eyebrow')).toHaveText(`Publications · ${count} Papers`);
  await expect(page.locator('.studio-book-list button')).toHaveText(content.publications.map((publication, index) =>
    `${String(index + 1).padStart(2, '0')}${publication.title}`));
  await page.locator('[data-publication-index="2"]').click();
  await expect(page.locator('#studio-book-card')).toHaveAttribute('data-reading', 'publication:2', { timeout: 15000 });
  await expect(page.locator('.studio-publication-title')).toHaveText(content.publications[2].title);
  expect(new URL(page.url()).hash).toBe('');
});

test('the physical newspaper opens News and receives current headlines', async ({ page }) => {
  await observeRoom(page);
  const newspaper = await page.evaluate(() => {
    const object = window.__studioRoom.root.getObjectByName('Research newspaper');
    return { count: object.userData.newsCount, headline: object.userData.latestHeadline };
  });
  const count = await page.locator('.news-list > li').count();
  const headline = await page.locator('#studio-news-data .studio-news-copy').first().textContent();
  expect(newspaper).toEqual({ count, headline: headline.trim() });
  const point = await objectPoint(page, 'news');
  await page.mouse.move(point.x, point.y);
  await expect(page.locator('#studio-canvas')).toHaveAttribute('data-hover', 'news');
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#studio-book-card')).toBeHidden();
  await expect(page.locator('#studio-book-card')).toHaveAttribute('data-reading', 'news', { timeout: 15000 });
  await expect(page.locator('.studio-news-list > li')).toHaveCount(count);
  expect(new URL(page.url()).hash).toBe('');
});

async function expectResetAfterExit(page) {
  await page.locator('#studio-toggle').click();
  await expect(page.locator('#studio-panel')).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({
    x: window.__studioPose.x,
    z: window.__studioPose.z,
    visible: window.__studioPose.visible,
    doorAngle: window.__studioRoom.root.getObjectByName('Exit door hinge').rotation.y,
  }))).toEqual({ x: -0.55, z: 0.85, visible: true, doorAngle: 0 });
}

test('clicking the door folds only after walking outside and supports a second exit', async ({ page }) => {
  test.setTimeout(45000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await observeRoom(page, false);
  await observeAvatar(page);
  await page.evaluate(() => { window.__studioCapture = true; });
  const point = await objectPoint(page, 'door');
  await page.mouse.move(point.x, point.y);
  await expect(page.locator('#studio-canvas')).toHaveAttribute('data-hover', 'door');
  await expect(page.locator('#studio-hover')).toHaveText('Door');
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#studio-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#studio-status')).toHaveText('Opening the door.', { timeout: 15000 });
  await expect(page.locator('#studio-panel')).toBeVisible();
  const contact = await page.evaluate(() => ({
    x: window.__studioPose.x,
    doorX: window.__studioRoom.targets.door.lookAt.x,
  }));
  expect(contact.x).toBeLessThan(contact.doorX);
  await expect(page.locator('#studio-status')).toHaveText('Leaving the room.');
  await expect(page.locator('#studio-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#studio-panel')).toBeHidden({ timeout: 15000 });
  await expect(page.locator('#studio-toggle')).toBeFocused();
  const departure = await page.evaluate(() => ({
    pose: window.__studioPose,
    doorX: window.__studioRoom.targets.door.lookAt.x,
    frames: window.__studioFrames,
  }));
  expect(departure.pose.x).toBeGreaterThan(departure.doorX + 0.2);
  expect(departure.pose.visible).toBe(false);
  expect(departure.frames.some(frame => frame.open === 'true' && frame.x > departure.doorX && frame.visible)).toBe(true);
  expect(departure.frames.some(frame => Math.abs(frame.doorAngle) > 0.4)).toBe(true);
  await expectResetAfterExit(page);
  const reopenedDoor = await objectPoint(page, 'door');
  await page.mouse.click(reopenedDoor.x, reopenedDoor.y);
  await expect(page.locator('#studio-panel')).toBeHidden({ timeout: 15000 });
  await expect(page.locator('#studio-toggle')).toBeFocused();
  await page.reload();
  await expect(page.locator('#studio-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('the avatar leaves the newspaper through the relocated door without furniture collisions or jumps', async ({ page }) => {
  test.setTimeout(45000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await observeRoom(page, false);
  await observeAvatar(page);
  const removedChair = await page.evaluate(() => ({
    geometry: Boolean(window.__studioRoom.root.getObjectByName('Reading chair')),
    target: Boolean(window.__studioRoom.targets.chair),
    pickable: window.__studioRoom.pickables.some(object => object.userData.interaction === 'chair'),
  }));
  expect(removedChair).toEqual({ geometry: false, target: false, pickable: false });
  const newspaper = await objectPoint(page, 'news');
  await page.mouse.click(newspaper.x, newspaper.y);
  await expect(page.locator('#studio-book-card')).toHaveAttribute('data-reading', 'news', { timeout: 15000 });
  await page.locator('#studio-card-close').click();
  await page.evaluate(() => {
    window.__studioFrames = [window.__studioPose];
    window.__studioCapture = true;
  });
  const point = await objectPoint(page, 'door');
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#studio-panel')).toBeHidden({ timeout: 20000 });
  const { frames, furniture } = await page.evaluate(() => {
    const room = window.__studioRoom;
    const door = room.targets.door.lookAt;
    return {
      frames: window.__studioFrames,
      // Crossing the opening is deliberate; all other furniture must stay clear.
      furniture: room.obstacles.filter(box => !(door.x >= box.minX && door.x <= box.maxX && door.z >= box.minZ && door.z <= box.maxZ)),
    };
  });
  expect(frames.length).toBeGreaterThan(15);
  expect(frames.at(-1).x).toBeGreaterThan(3);
  for (const frame of frames) {
    for (const box of furniture) {
      expect(frame.x < box.minX - 0.239 || frame.x > box.maxX + 0.239 ||
        frame.z < box.minZ - 0.239 || frame.z > box.maxZ + 0.239).toBe(true);
    }
  }
  for (let index = 1; index < frames.length; index++) {
    expect(Math.hypot(frames[index].x - frames[index - 1].x, frames[index].z - frames[index - 1].z)).toBeLessThan(0.07);
  }
});

test('door approach can be cancelled and reopening during departure restores the room', async ({ page }) => {
  test.setTimeout(45000);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await observeRoom(page, false);
  await observeAvatar(page);
  await page.evaluate(() => { window.__studioCapture = true; });
  const point = await objectPoint(page, 'door');
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#studio-status')).toHaveText('Walking to the door.');
  const lamp = await objectPoint(page, 'lamp');
  await page.mouse.click(lamp.x, lamp.y);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 15000 });
  const cancelled = await page.evaluate(() => window.__studioFrames);
  expect(cancelled.every(frame => frame.doorAngle === 0 && frame.open === 'true')).toBe(true);
  const nextPoint = await objectPoint(page, 'door');
  await page.mouse.click(nextPoint.x, nextPoint.y);
  await expect(page.locator('#studio-status')).toHaveText('Leaving the room.', { timeout: 15000 });
  await page.locator('#studio-toggle').click();
  await expect(page.locator('#studio-panel')).toBeHidden();
  await expectResetAfterExit(page);
  const reopenedLamp = await objectPoint(page, 'lamp');
  await page.mouse.click(reopenedLamp.x, reopenedLamp.y);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light', { timeout: 15000 });
  await expect(page.locator('#studio-toggle')).toHaveAttribute('aria-expanded', 'true');
});
