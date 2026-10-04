// A tiny visibility-graph navigator for a bounded room with rectangular furniture.
// The character is a circle in the x/z plane; padding accounts for its radius.
export function createNavigator(bounds, obstacles, radius = 0.24) {
  const EPSILON = 1e-9;
  const CORNER_CLEARANCE = 1e-4;
  const ARRIVAL_DISTANCE = 1e-5;
  const finite = (value) => Number.isFinite(value);
  const validBox = (box) => box &&
    [box.minX, box.maxX, box.minZ, box.maxZ].every(finite) &&
    box.minX <= box.maxX && box.minZ <= box.maxZ;

  if (!validBox(bounds) || !finite(radius) || radius < 0 || !obstacles.every(validBox)) {
    throw new TypeError('Navigation requires finite bounds, obstacles, and a nonnegative radius.');
  }

  const area = {
    minX: bounds.minX + radius, maxX: bounds.maxX - radius,
    minZ: bounds.minZ + radius, maxZ: bounds.maxZ - radius,
  };
  if (area.minX >= area.maxX || area.minZ >= area.maxZ) {
    throw new RangeError('The room is too small for the character radius.');
  }
  const blocked = obstacles.map((box) => ({
    minX: box.minX - radius, maxX: box.maxX + radius,
    minZ: box.minZ - radius, maxZ: box.maxZ + radius,
  }));
  const squaredDistance = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function isWalkable(point) {
    if (!point || !finite(point.x) || !finite(point.z)) return false;
    if (point.x < area.minX - EPSILON || point.x > area.maxX + EPSILON ||
        point.z < area.minZ - EPSILON || point.z > area.maxZ + EPSILON) return false;
    return !blocked.some((box) =>
      point.x >= box.minX - EPSILON && point.x <= box.maxX + EPSILON &&
      point.z >= box.minZ - EPSILON && point.z <= box.maxZ + EPSILON);
  }

  function closestWalkable(point) {
    if (!point || !finite(point.x) || !finite(point.z)) {
      throw new TypeError('A navigation point must contain finite x and z coordinates.');
    }
    const clamped = {
      x: clamp(point.x, area.minX, area.maxX),
      z: clamp(point.z, area.minZ, area.maxZ),
    };
    if (isWalkable(clamped)) return clamped;

    // The nearest point outside a union of axis-aligned boxes lies on an exposed
    // edge or corner. Include all edge coordinates to handle overlapping boxes.
    const xs = [clamped.x, area.minX, area.maxX];
    const zs = [clamped.z, area.minZ, area.maxZ];
    for (const box of blocked) {
      xs.push(clamp(box.minX - CORNER_CLEARANCE, area.minX, area.maxX));
      xs.push(clamp(box.maxX + CORNER_CLEARANCE, area.minX, area.maxX));
      zs.push(clamp(box.minZ - CORNER_CLEARANCE, area.minZ, area.maxZ));
      zs.push(clamp(box.maxZ + CORNER_CLEARANCE, area.minZ, area.maxZ));
    }
    let nearest = null;
    let distance = Infinity;
    for (const x of xs) {
      for (const z of zs) {
        const candidate = { x, z };
        if (!isWalkable(candidate)) continue;
        const candidateDistance = squaredDistance(point, candidate);
        if (candidateDistance < distance) {
          nearest = candidate;
          distance = candidateDistance;
        }
      }
    }
    if (!nearest) throw new RangeError('The room has no walkable space.');
    return nearest;
  }

  function intersectsBox(from, to, box) {
    // Closed slab intersection also rejects a segment that only grazes a corner.
    let enter = 0;
    let leave = 1;
    for (const [axis, low, high] of [['x', 'minX', 'maxX'], ['z', 'minZ', 'maxZ']]) {
      const delta = to[axis] - from[axis];
      if (Math.abs(delta) < EPSILON) {
        if (from[axis] < box[low] - EPSILON || from[axis] > box[high] + EPSILON) return false;
        continue;
      }
      const a = (box[low] - from[axis]) / delta;
      const b = (box[high] - from[axis]) / delta;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
      if (enter > leave + EPSILON) return false;
    }
    return enter <= leave + EPSILON;
  }

  function canWalk(from, to) {
    return isWalkable(from) && isWalkable(to) &&
      !blocked.some((box) => intersectsBox(from, to, box));
  }

  const corners = [];
  function addCorner(point) {
    if (isWalkable(point) && !corners.some((other) => squaredDistance(other, point) < EPSILON ** 2)) {
      corners.push(point);
    }
  }
  for (const box of blocked) {
    for (const x of [box.minX - CORNER_CLEARANCE, box.maxX + CORNER_CLEARANCE]) {
      for (const z of [box.minZ - CORNER_CLEARANCE, box.maxZ + CORNER_CLEARANCE]) {
        addCorner({ x, z });
      }
    }
  }
  for (const x of [area.minX, area.maxX]) {
    for (const z of [area.minZ, area.maxZ]) addCorner({ x, z });
  }
  // Furniture is stationary, so cache visibility among its corner nodes.
  const cornerEdges = corners.map((from, i) => corners.map((to, j) =>
    i !== j && canWalk(from, to) ? Math.sqrt(squaredDistance(from, to)) : Infinity));

  function findPath(from, to) {
    const start = closestWalkable(from);
    const destination = closestWalkable(to);
    if (squaredDistance(start, destination) <= ARRIVAL_DISTANCE ** 2) return [];
    if (canWalk(start, destination)) return [destination];

    const nodes = [start, destination, ...corners];
    const edges = nodes.map(() => Array(nodes.length).fill(Infinity));
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const length = i >= 2 ? cornerEdges[i - 2][j - 2] :
          canWalk(nodes[i], nodes[j]) ? Math.sqrt(squaredDistance(nodes[i], nodes[j])) : Infinity;
        edges[i][j] = length;
        edges[j][i] = length;
      }
    }

    const distances = Array(nodes.length).fill(Infinity);
    const previous = Array(nodes.length).fill(-1);
    const visited = Array(nodes.length).fill(false);
    distances[0] = 0;
    for (let step = 0; step < nodes.length; step++) {
      let current = -1;
      for (let i = 0; i < nodes.length; i++) {
        if (!visited[i] && (current === -1 || distances[i] < distances[current])) current = i;
      }
      if (current === -1 || !finite(distances[current])) return null;
      if (current === 1) break;
      visited[current] = true;
      for (let next = 0; next < nodes.length; next++) {
        const candidate = distances[current] + edges[current][next];
        if (candidate < distances[next]) {
          distances[next] = candidate;
          previous[next] = current;
        }
      }
    }
    if (!finite(distances[1])) return null;
    const route = [];
    for (let current = 1; current !== 0; current = previous[current]) {
      route.push({ ...nodes[current] });
    }
    return route.reverse();
  }

  return { findPath, isWalkable, closestWalkable, canWalk };
}
