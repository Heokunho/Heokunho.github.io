import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigator } from '../assets/js/studio/navigation.js';
import { createRoom } from '../assets/js/studio/room.js';

const bounds = { minX: -2.8, maxX: 2.8, minZ: -1.7, maxZ: 1.7 };
const furniture = [
  { minX: -2.51, maxX: -0.39, minZ: -1.435, maxZ: -0.605 },
  { minX: 1.76, maxX: 2.34, minZ: -1.21, maxZ: -0.63 },
  { minX: 0.305, maxX: 0.995, minZ: -0.01, maxZ: 0.67 },
];
const radius = 0.24;

function assertSafeRoute(start, route, boxes = furniture, room = bounds, padding = radius) {
  assert.ok(route, 'a route should exist');
  let from = start;
  for (const destination of route) {
    // Check actual collision geometry independently of navigator.canWalk.
    const samples = Math.max(2, Math.ceil(Math.hypot(destination.x - from.x, destination.z - from.z) / 0.002));
    for (let step = 0; step <= samples; step++) {
      const t = step / samples;
      const x = from.x + (destination.x - from.x) * t;
      const z = from.z + (destination.z - from.z) * t;
      assert.ok(x >= room.minX + padding - 1e-8 && x <= room.maxX - padding + 1e-8);
      assert.ok(z >= room.minZ + padding - 1e-8 && z <= room.maxZ - padding + 1e-8);
      for (const box of boxes) {
        assert.ok(x < box.minX - padding || x > box.maxX + padding ||
          z < box.minZ - padding || z > box.maxZ + padding,
        `route intersects expanded furniture at (${x}, ${z})`);
      }
    }
    from = destination;
  }
}

test('an unobstructed floor click gives only the destination', () => {
  const navigator = createNavigator(bounds, furniture);
  const start = { x: -1.5, z: 1.1 };
  const target = { x: -0.4, z: 0.4 };
  assert.deepEqual(navigator.findPath(start, target), [target]);
  assert.equal(navigator.canWalk(start, target), true);
});

test('the chair is routed around with clearance along every segment', () => {
  const navigator = createNavigator(bounds, furniture);
  const start = { x: -0.15, z: 0.3 };
  const target = { x: 1.55, z: 0.3 };
  const route = navigator.findPath(start, target);
  assert.equal(navigator.canWalk(start, target), false);
  assert.ok(route.length >= 3, 'walking across the chair requires corner waypoints');
  assert.deepEqual(route.at(-1), target);
  assertSafeRoute(start, route);
});

test('a desk is avoided rather than crossed diagonally', () => {
  const room = { minX: -4, maxX: 4, minZ: -3, maxZ: 3 };
  const desk = [furniture[0]];
  const navigator = createNavigator(room, desk);
  const start = { x: -3.2, z: -1.0 };
  const target = { x: 0.2, z: -1.0 };
  const route = navigator.findPath(start, target);
  assert.equal(navigator.canWalk(start, target), false);
  assert.ok(route.length >= 3);
  assertSafeRoute(start, route, desk, room);
  const length = route.reduce((state, point) => ({
    point, length: state.length + Math.hypot(point.x - state.point.x, point.z - state.point.z),
  }), { point: start, length: 0 }).length;
  const shortestLength = Math.hypot(0.45, 0.635) + 2.6 + Math.hypot(0.35, 0.635);
  assert.ok(Math.abs(length - shortestLength) < 0.001, 'the shorter side of the desk should be selected');
});

test('a blocked click projects to the nearest free furniture edge', () => {
  const navigator = createNavigator(bounds, furniture);
  const click = { x: 0.65, z: 0.20 };
  assert.equal(navigator.isWalkable(click), false);
  const safe = navigator.closestWalkable(click);
  assert.equal(navigator.isWalkable(safe), true);
  assert.equal(safe.x, click.x);
  assert.ok(safe.z < -0.25 && safe.z > -0.251);
  const start = { x: -0.25, z: 0.3 };
  const route = navigator.findPath(start, click);
  assert.deepEqual(route.at(-1), safe);
  assertSafeRoute(start, route);
});

test('out-of-room clicks leave the full character radius inside the room', () => {
  const navigator = createNavigator(bounds, furniture);
  const safe = navigator.closestWalkable({ x: 20, z: 20 });
  assert.equal(safe.x, bounds.maxX - radius);
  assert.equal(safe.z, bounds.maxZ - radius);
  assert.equal(navigator.isWalkable(safe), true);
  assert.equal(navigator.isWalkable({ x: bounds.maxX, z: 0 }), false);
});

test('a wall separating the room produces no route', () => {
  const room = { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
  const wall = [{ minX: -0.1, maxX: 0.1, minZ: -3, maxZ: 3 }];
  const navigator = createNavigator(room, wall);
  assert.equal(navigator.findPath({ x: -1, z: 0 }, { x: 1, z: 0 }), null);
});

test('every authored interaction is reachable from the floor and other objects', () => {
  const room = createRoom({ publications: Array.from({ length: 4 }, (_, index) => ({ title: `Publication ${index}` })) });
  const navigator = createNavigator(room.bounds, room.obstacles);
  const targets = Object.values(room.targets).map(({ x, z }) => ({ x, z }));
  for (const start of [{ x: -0.55, z: 0.85 }, ...targets]) {
    for (const target of targets) {
      assert.equal(navigator.isWalkable(target), true);
      const route = navigator.findPath(start, target);
      assertSafeRoute(start, route, room.obstacles, room.bounds);
      if (start.x !== target.x || start.z !== target.z) assert.deepEqual(route.at(-1), target);
    }
  }
});

test('a zero-length or almost-zero-length move has no waypoints', () => {
  const navigator = createNavigator(bounds, furniture);
  const start = { x: -0.6, z: 0.6 };
  assert.deepEqual(navigator.findPath(start, start), []);
  assert.deepEqual(navigator.findPath(start, { x: start.x + 1e-7, z: start.z }), []);
  assert.equal(navigator.canWalk(start, start), true);
});

test('segments grazing a furniture corner are rejected', () => {
  const room = { minX: -3, maxX: 3, minZ: -3, maxZ: 3 };
  const box = [{ minX: 0, maxX: 1, minZ: 0, maxZ: 1 }];
  const navigator = createNavigator(room, box, 0);
  assert.equal(navigator.canWalk({ x: -1, z: 1 }, { x: 1, z: -1 }), false);
  assert.equal(navigator.canWalk({ x: -1, z: -0.001 }, { x: 2, z: -0.001 }), true);
  const start = { x: -1, z: 1 };
  const route = navigator.findPath(start, { x: 1, z: -1 });
  assertSafeRoute(start, route, box, room, 0);
});

test('projection handles overlapping obstacles without returning their interior', () => {
  const room = { minX: -3, maxX: 3, minZ: -3, maxZ: 3 };
  const boxes = [
    { minX: -1, maxX: 1, minZ: -0.5, maxZ: 0.5 },
    { minX: -0.5, maxX: 0.5, minZ: -1, maxZ: 1 },
  ];
  const navigator = createNavigator(room, boxes, 0);
  const safe = navigator.closestWalkable({ x: 0, z: 0 });
  assert.equal(navigator.isWalkable(safe), true);
  assert.ok(Math.hypot(safe.x, safe.z) < 0.708, 'nearest exposed corner should be used');
});
