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
  return page.evaluate(async ({ name, publicationIndex, localPoint }) => {
    const THREE = await import('/assets/js/vendor/three.module.min.js');
    const room = window.__studioRoom;
    room.root.updateMatrixWorld(true);
    let target;
    room.root.traverse(node => {
      if (name === 'book' && node.userData.publicationIndex === publicationIndex) target = node;
      if (name === 'news' && node.name === 'Research newspaper') target = node;
      if (name === 'door' && node.name === 'Exit door') target = node;
    });
    const point = name === 'book'
      ? target.children.find(node => node.geometry?.type === 'PlaneGeometry').getWorldPosition(new THREE.Vector3())
      : name === 'door'
        ? target.localToWorld(new THREE.Vector3(...(localPoint || [0, 1.15, -0.04])))
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

test('shelf contains one pickable volume per publication and spines select the exact paper', async ({ page }) => {
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
    await expect(page.locator('#studio-canvas')).toHaveAttribute('data-hover', `publication:${index}`);
    await expect(page.locator('#studio-hover')).toContainText(content.publications[index].title.slice(0, 45));
  }
  const point = await objectPoint(page, 'book', 2);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#studio-book-card')).toBeHidden();
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
  await page.getByRole('button', { name: 'Newspaper', exact: true }).click();
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
  await page.getByRole('button', { name: 'Lamp', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 15000 });
  const cancelled = await page.evaluate(() => window.__studioFrames);
  expect(cancelled.every(frame => frame.doorAngle === 0 && frame.open === 'true')).toBe(true);
  const nextPoint = await objectPoint(page, 'door');
  await page.mouse.click(nextPoint.x, nextPoint.y);
  await expect(page.locator('#studio-status')).toHaveText('Leaving the room.', { timeout: 15000 });
  await page.locator('#studio-toggle').click();
  await expect(page.locator('#studio-panel')).toBeHidden();
  await expectResetAfterExit(page);
  await page.getByRole('button', { name: 'Lamp', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light', { timeout: 15000 });
  await expect(page.locator('#studio-toggle')).toHaveAttribute('aria-expanded', 'true');
});
