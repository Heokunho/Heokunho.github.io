import * as THREE from '../vendor/three.module.min.js';

// All dimensions are in metres. The top of the walking surface is y = 0.
export function createRoom({ publications = [], news = [] } = {}) {
  const root = new THREE.Group();
  root.name = 'Research study';
  const pickables = [];
  const themeMaterials = [];
  const colorTarget = new THREE.Color();
  const daylight = new THREE.Color('#fff7e7');
  const moonlight = new THREE.Color('#c1d3f5');
  const lightGround = new THREE.Color('#aa9780');
  const darkGround = new THREE.Color('#344558');
  const geometryCache = new Map();
  let illumination = 1;
  let targetIllumination = 1;
  let newspaperOpen = 0;
  let targetNewspaperOpen = 0;
  let doorOpen = 0;
  let targetDoorOpen = 0;
  const publicationBooks = [];

  function material(light, dark = light, options = {}) {
    const result = new THREE.MeshStandardMaterial({ color: light, roughness: 0.78, ...options });
    themeMaterials.push({ material: result, light: new THREE.Color(light), dark: new THREE.Color(dark) });
    return result;
  }

  const floorMaterial = material('#e7e5dd', '#344450');
  const edgeMaterial = material('#c9cbc5', '#24323e');
  const wood = material('#b99168', '#826b57');
  const woodEdge = material('#d0ad81', '#a18465');
  const slate = material('#566b72', '#4a5c69');
  const darkMetal = material('#465055', '#64747e', { metalness: 0.25, roughness: 0.55 });
  const ivory = material('#f4f0e7', '#bdc7c8');
  const paper = material('#fbf7ed', '#c4cbd0');
  const sage = material('#889b8e', '#7d9990');
  const ochre = material('#c6a06f', '#b69771');
  const leaf = material('#768a72', '#617965');
  const rugMaterial = material('#aebda5', '#405b59');
  const lampInner = material('#fff1cf', '#a8b2b8', { emissive: '#ffe0a3', emissiveIntensity: 0.6 });

  function roundedGeometry(width, height, depth, radius = 0.025) {
    const bevel = Math.min(radius, width / 4, height / 4, depth / 4);
    const key = [width, height, depth, bevel].join(':');
    if (geometryCache.has(key)) return geometryCache.get(key);
    const halfWidth = width / 2 - bevel;
    const halfHeight = height / 2 - bevel;
    const shape = new THREE.Shape();
    shape.moveTo(-halfWidth, -halfHeight);
    shape.lineTo(halfWidth, -halfHeight);
    shape.lineTo(halfWidth, halfHeight);
    shape.lineTo(-halfWidth, halfHeight);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth - bevel * 2,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 3,
      steps: 1,
      curveSegments: 1,
    });
    geometry.center();
    geometryCache.set(key, geometry);
    return geometry;
  }

  function mesh(geometry, surface, x, y, z, parent = root) {
    const object = new THREE.Mesh(geometry, surface);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function box(w, h, d, surface, x, y, z, parent = root, radius = 0.025) {
    return mesh(roundedGeometry(w, h, d, radius), surface, x, y, z, parent);
  }

  function cylinder(top, bottom, height, surface, x, y, z, parent = root, segments = 24) {
    return mesh(new THREE.CylinderGeometry(top, bottom, height, segments), surface, x, y, z, parent);
  }

  function rod(from, to, radius, surface, parent = root) {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const result = cylinder(radius, radius, direction.length(), surface, 0, 0, 0, parent, 12);
    result.position.copy(start.add(end).multiplyScalar(0.5));
    result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return result;
  }

  function interactive(group, name) {
    group.traverse((object) => {
      if (object.isMesh) {
        object.userData.interaction = name;
        pickables.push(object);
      }
    });
  }

  // A shallow plinth keeps the scene self-contained without enclosing walls.
  box(5.8, 0.13, 3.65, edgeMaterial, 0, -0.155, 0, root, 0.045);
  const floor = box(5.8, 0.12, 3.65, floorMaterial, 0, -0.06, 0, root, 0.035);
  floor.userData.floor = true;
  floor.castShadow = false;
  const rug = box(2.15, 0.012, 1.52, rugMaterial, -0.45, 0.007, 0.48, root, 0.004);
  rug.castShadow = false;

  const desk = new THREE.Group();
  desk.name = 'Desk';
  desk.position.x = 0.40;
  root.add(desk);
  box(2.12, 0.10, 0.83, woodEdge, -1.45, 0.91, -1.02, desk);
  box(1.95, 0.10, 0.68, wood, -1.45, 0.82, -1.02, desk);
  for (const x of [-2.34, -0.56]) {
    for (const z of [-1.31, -0.74]) {
      box(0.065, 0.79, 0.065, darkMetal, x, 0.40, z, desk, 0.012);
    }
  }
  box(0.065, 0.065, 0.66, darkMetal, -2.34, 0.16, -1.02, desk, 0.012);
  box(0.065, 0.065, 0.66, darkMetal, -0.56, 0.16, -1.02, desk, 0.012);

  // The shelf is an index of actual publications: one volume per entry, with
  // empty shelf space left empty instead of filling it with decorative books.
  const shelf = new THREE.Group();
  shelf.name = 'Publication bookshelf';
  // Run along the floor's short left edge, with the book spines facing inward.
  shelf.position.set(-2.50, 0, 0.40);
  shelf.rotation.y = Math.PI / 2;
  root.add(shelf);
  const shelfWidth = 1.50;
  const shelfHeight = 1.54;
  const rowCount = publications.length > 16 ? 3 : 2;
  const rowSpace = 1.30 / rowCount;
  box(shelfWidth, 1.40, 0.035, wood, 0, 0.79, -0.192, shelf, 0.008);
  for (const x of [-0.7125, 0.7125]) {
    box(0.075, shelfHeight, 0.44, woodEdge, x, shelfHeight / 2, 0, shelf, 0.014);
  }
  for (let row = 0; row <= rowCount; row++) {
    box(shelfWidth, 0.07, 0.44, woodEdge, 0, 0.16 + row * rowSpace, 0, shelf, 0.012);
  }
  box(shelfWidth, 0.075, 0.45, woodEdge, 0, shelfHeight - 0.0375, 0, shelf, 0.014);
  interactive(shelf, 'books');

  const coverColors = [
    ['#708b87', '#657e7e'], ['#b28a6d', '#9b7f68'],
    ['#647c96', '#5c7392'], ['#9b8c9b', '#867d93'],
    ['#a9a17c', '#90916e'], ['#7e929c', '#6c818e'],
  ];
  const covers = coverColors.map(([light, dark]) => material(light, dark));
  const booksPerRow = Math.max(1, Math.ceil(publications.length / rowCount));
  const bookGap = Math.min(0.036, 0.40 / booksPerRow);
  const bookWidth = Math.min(0.185, (1.27 - (booksPerRow - 1) * bookGap) / booksPerRow);
  for (let index = 0; index < publications.length; index++) {
    const publication = publications[index];
    const row = Math.floor(index / booksPerRow);
    const column = index % booksPerRow;
    const rowSize = Math.min(booksPerRow, publications.length - row * booksPerRow);
    const occupiedWidth = rowSize * bookWidth + (rowSize - 1) * bookGap;
    const height = Math.min(0.56, rowSpace * 0.85) * (1 - (index % 3) * 0.065);
    const volume = new THREE.Group();
    volume.name = `Publication ${index + 1}: ${publication.title || 'Untitled'}`;
    volume.userData.publicationIndex = index;
    volume.position.set(-occupiedWidth / 2 + bookWidth / 2 + column * (bookWidth + bookGap),
      0.195 + (rowCount - row - 1) * rowSpace, 0.028);
    shelf.add(volume);
    const cover = covers[index % covers.length];
    box(bookWidth, height, 0.29, cover, 0, height / 2, 0, volume, 0.009);
    box(Math.max(0.008, bookWidth - 0.028), height - 0.022, 0.252, paper,
      0, height / 2, -0.015, volume, 0.004);
    box(bookWidth, height, 0.018, cover, 0, height / 2, 0.148, volume, 0.004);
    for (const y of [height * 0.15, height * 0.83]) {
      box(bookWidth * 0.74, 0.012, 0.003, ivory, 0, y, 0.159, volume, 0.001);
    }
    // A small printed index makes every spine distinct without covering the
    // miniature scene with text; the full title appears in the HTML card.
    if (typeof document !== 'undefined') {
      const spineCanvas = document.createElement('canvas');
      spineCanvas.width = 96;
      spineCanvas.height = 192;
      const ctx = spineCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f7f0dc';
        ctx.textAlign = 'center';
        ctx.font = 'bold 50px Georgia, serif';
        ctx.fillText(String(index + 1).padStart(2, '0'), 48, 72);
        ctx.font = '22px Arial, sans-serif';
        const venue = String(publication.venue || '').replace(/<[^>]*>/g, '').trim();
        ctx.fillText(venue.split(/[\s,(]/)[0].slice(0, 7), 48, 112, 89);
        const texture = new THREE.CanvasTexture(spineCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const label = mesh(new THREE.PlaneGeometry(bookWidth * 0.8, height * 0.49),
          new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
          0, height * 0.51, 0.1605, volume);
        label.castShadow = false;
      }
    }
    interactive(volume, `publication:${index}`);
    publicationBooks.push({ root: volume, restZ: volume.position.z, selected: 0, target: 0 });
  }

  // News comes from the same content as the page. Both halves carry the real
  // dates and headlines; clicking only unfolds the paper and opens its card.
  const newspaper = new THREE.Group();
  newspaper.name = 'Research newspaper';
  newspaper.userData.newsCount = news.length;
  newspaper.userData.latestHeadline = news[0]?.text || '';
  newspaper.position.set(-1.08, 0.972, -1.02);
  newspaper.rotation.y = -0.10;
  root.add(newspaper);
  const paperFold = new THREE.Group();
  newspaper.add(paperFold);
  let newspaperTexture = null;
  if (typeof document !== 'undefined') {
    const newspaperCanvas = document.createElement('canvas');
    newspaperCanvas.width = 1024;
    newspaperCanvas.height = 640;
    const ctx = newspaperCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#f6f0e0';
      ctx.fillRect(0, 0, 1024, 640);
      ctx.fillStyle = '#48504d';
      ctx.textAlign = 'center';
      ctx.font = 'bold 64px Georgia, serif';
      ctx.fillText('RESEARCH NEWS', 512, 91);
      ctx.fillRect(46, 116, 932, 5);
      ctx.font = '20px Georgia, serif';
      ctx.fillText('From the research desk', 512, 151);
      ctx.fillRect(46, 170, 932, 2);
      ctx.fillStyle = '#d4ccbd';
      ctx.fillRect(510, 193, 2, 390);
      ctx.textAlign = 'left';
      const entries = news.slice(0, 4);
      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        const x = index % 2 === 0 ? 48 : 545;
        const y = 214 + Math.floor(index / 2) * 186;
        ctx.fillStyle = '#747b70';
        ctx.font = 'bold 23px Arial, sans-serif';
        ctx.fillText(String(entry.date || '').replace(/^\[|\]$/g, ''), x, y, 422);
        ctx.fillStyle = '#364441';
        ctx.font = 'bold 27px Georgia, serif';
        const words = String(entry.text || '').split(/\s+/);
        let line = '';
        let lineY = y + 39;
        for (const word of words) {
          const nextLine = line ? `${line} ${word}` : word;
          if (line && ctx.measureText(nextLine).width > 425) {
            ctx.fillText(line, x, lineY, 425);
            lineY += 33;
            line = word;
            if (lineY > y + 139) { line = ''; break; }
          } else {
            line = nextLine;
          }
        }
        if (line) ctx.fillText(line, x, lineY, 425);
      }
      newspaperTexture = new THREE.CanvasTexture(newspaperCanvas);
      newspaperTexture.colorSpace = THREE.SRGBColorSpace;
    }
  }
  for (let half = 0; half < 2; half++) {
    const parent = half ? paperFold : newspaper;
    const x = half ? 0.295 : -0.295;
    box(0.59, 0.009, 0.64, paper, x, 0.006, 0, parent, 0.003);
    if (newspaperTexture) {
      const texture = half ? newspaperTexture.clone() : newspaperTexture;
      texture.repeat.set(0.5, 1);
      texture.offset.x = half * 0.5;
      texture.needsUpdate = true;
      const page = mesh(new THREE.PlaneGeometry(0.589, 0.639),
        new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }),
        x, 0.012, 0, parent);
      page.rotation.x = -Math.PI / 2;
      page.castShadow = false;
    }
  }
  paperFold.rotation.z = 0.13;
  interactive(newspaper, 'news');

  const lamp = new THREE.Group();
  lamp.name = 'Theme lamp';
  lamp.position.set(0.76, 0, -1.30);
  root.add(lamp);
  cylinder(0.255, 0.29, 0.065, darkMetal, 0, 0.033, 0, lamp);
  cylinder(0.025, 0.027, 1.63, darkMetal, 0, 0.86, 0, lamp, 16);
  rod([0, 1.60, 0], [-0.20, 1.83, 0], 0.026, darkMetal, lamp);
  cylinder(0.17, 0.31, 0.30, ochre, -0.20, 1.72, 0, lamp);
  cylinder(0.276, 0.276, 0.018, lampInner, -0.20, 1.56, 0, lamp);
  const lampSwitch = box(0.095, 0.145, 0.075, slate, 0, 1.14, 0.036, lamp, 0.016);
  box(0.038, 0.059, 0.014, ivory, 0, 1.14, 0.079, lamp, 0.006);
  lampSwitch.name = 'Lamp switch';
  interactive(lamp, 'lamp');

  const lampLight = new THREE.PointLight('#ffdd9b', 2.3, 5.2, 2);
  lampLight.position.set(0.56, 1.49, -1.30);
  root.add(lampLight);
  const lampPool = mesh(new THREE.CircleGeometry(0.80, 48), new THREE.MeshBasicMaterial({
    color: '#f5cf83', transparent: true, opacity: 0.065, depthWrite: false,
  }), 0.56, 0.009, -1.30);
  lampPool.rotation.x = -Math.PI / 2;
  lampPool.castShadow = false;
  lampPool.receiveShadow = false;

  // A small doorway marks the room's right side without enclosing the scene.
  // Local +z faces inward; the right hinge swings the leaf out of the room.
  const door = new THREE.Group();
  door.name = 'Exit door';
  door.position.set(2.76, 0, -0.92);
  door.rotation.y = -Math.PI / 2;
  root.add(door);
  // Continue the walking surface just far enough to support the final step.
  const doorstep = box(0.92, 0.13, 0.79, floorMaterial, 0, -0.065, -0.345, door, 0.012);
  doorstep.name = 'Exit doorstep';
  for (const x of [-0.505, 0.505]) {
    const jamb = box(0.09, 2.00, 0.16, woodEdge, x, 1.00, 0, door, 0.014);
    jamb.name = x < 0 ? 'Exit door left jamb' : 'Exit door right jamb';
    box(0.13, 0.035, 0.26, wood, x, 0.0175, 0, door, 0.010);
  }
  const lintel = box(1.10, 0.10, 0.16, woodEdge, 0, 2.00, 0, door, 0.014);
  lintel.name = 'Exit door lintel';
  const threshold = box(0.92, 0.014, 0.20, wood, 0, 0.007, 0, door, 0.005);
  threshold.name = 'Exit door threshold';
  const doorHinge = new THREE.Group();
  doorHinge.name = 'Exit door hinge';
  doorHinge.position.x = 0.445;
  door.add(doorHinge);
  const doorLeaf = box(0.89, 1.905, 0.06, sage, -0.445, 0.9875, 0, doorHinge, 0.014);
  doorLeaf.name = 'Exit door leaf';
  // Shallow panels read as a familiar door even at the miniature scene scale.
  for (const z of [-0.034, 0.034]) {
    box(0.69, 0.68, 0.015, sage, -0.445, 1.47, z, doorHinge, 0.012);
    box(0.69, 0.63, 0.015, sage, -0.445, 0.48, z, doorHinge, 0.012);
    const handlePlate = box(0.075, 0.16, 0.012, darkMetal,
      -0.685, 1.14, z * 1.16, doorHinge, 0.010);
    handlePlate.name = 'Exit door handle plate';
    const handle = rod([-0.685, 1.14, z * 1.22], [-0.685, 1.14, z * 2.2],
      0.018, woodEdge, doorHinge);
    handle.name = 'Exit door handle';
    rod([-0.685, 1.14, z * 2.2], [-0.575, 1.14, z * 2.2],
      0.018, woodEdge, doorHinge);
  }
  for (const y of [0.34, 1.65]) {
    cylinder(0.023, 0.023, 0.11, darkMetal, 0, y, 0, doorHinge, 12);
  }
  interactive(door, 'door');

  const plant = new THREE.Group();
  plant.name = 'Small desk plant';
  plant.position.set(-0.26, 0.968, -1.19);
  root.add(plant);
  cylinder(0.108, 0.077, 0.16, ivory, 0, 0.08, 0, plant);
  cylinder(0.091, 0.091, 0.012, wood, 0, 0.16, 0, plant);
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    const x = Math.sin(angle) * 0.075;
    const z = Math.cos(angle) * 0.075;
    rod([0, 0.15, 0], [x, 0.28 + (i % 2) * 0.06, z], 0.008, leaf, plant);
    const blade = mesh(new THREE.SphereGeometry(1, 10, 8), leaf, x, 0.28 + (i % 2) * 0.06, z, plant);
    blade.scale.set(0.044, 0.105, 0.018);
    blade.rotation.set(0.4, angle, -0.4);
  }

  const hemisphere = new THREE.HemisphereLight('#f2f5ff', '#aa9780', 2.0);
  root.add(hemisphere);
  const sunlight = new THREE.DirectionalLight('#fff7e7', 3.0);
  sunlight.position.set(-3.5, 7, 4.5);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  sunlight.shadow.camera.left = -4;
  sunlight.shadow.camera.right = 4;
  sunlight.shadow.camera.top = 4;
  sunlight.shadow.camera.bottom = -4;
  sunlight.shadow.camera.near = 0.5;
  sunlight.shadow.camera.far = 18;
  sunlight.shadow.normalBias = 0.035;
  sunlight.shadow.bias = -0.0002;
  sunlight.shadow.radius = 3;
  root.add(sunlight);

  function applyLighting() {
    for (const entry of themeMaterials) {
      colorTarget.copy(entry.dark).lerp(entry.light, illumination);
      entry.material.color.copy(colorTarget);
    }
    hemisphere.intensity = 1.45 + illumination * 0.55;
    hemisphere.groundColor.copy(darkGround).lerp(lightGround, illumination);
    sunlight.intensity = 1.50 + illumination * 1.50;
    sunlight.color.copy(moonlight).lerp(daylight, illumination);
    lampLight.intensity = illumination * 2.3;
    lampInner.emissiveIntensity = illumination * 0.6;
    lampPool.material.opacity = illumination * 0.065;
  }

  const obstacles = [
    { minX: -2.11, maxX: 0.01, minZ: -1.435, maxZ: -0.605 },
    { minX: 0.47, maxX: 1.05, minZ: -1.59, maxZ: -1.01 },
    { minX: -2.725, maxX: -2.275, minZ: -0.35, maxZ: 1.15 },
    // The exit sequence deliberately traverses this otherwise closed doorway.
    { minX: 2.63, maxX: 2.89, minZ: -1.49, maxZ: -0.35 },
  ];
  const targets = {
    books: { x: -1.81, z: 0.62, lookAt: { x: -2.50, z: 0.62 } },
    news: { x: -1.08, z: -0.25, lookAt: { x: -1.08, z: -1.02 } },
    lamp: { x: 0.53, z: -0.68, lookAt: { x: 0.53, z: -1.30 } },
    door: {
      x: 2.14, z: -0.92, lookAt: { x: 2.76, z: -0.92 },
      exit: { x: 3.25, z: -0.92 },
    },
  };
  for (let index = 0; index < publicationBooks.length; index++) {
    const volume = publicationBooks[index].root;
    // Rotation maps each book's local x to world -z. Offset the stance along
    // the shelf so the reaching hand, rather than the torso, meets its spine.
    const stanceZ = shelf.position.z - volume.position.x + 0.22;
    targets[`publication:${index}`] = {
      x: -1.81, z: stanceZ,
      lookAt: { x: shelf.position.x, z: stanceZ },
    };
  }

  applyLighting();
  return {
    root, floor, pickables, obstacles, targets,
    bounds: { minX: -2.8, maxX: 2.8, minZ: -1.7, maxZ: 1.7 },
    setTheme(theme, immediate = false) {
      targetIllumination = theme === 'dark' ? 0 : 1;
      if (immediate) {
        illumination = targetIllumination;
        applyLighting();
      }
    },
    setInteraction(name, active = true) {
      if (name === 'news') targetNewspaperOpen = active ? 1 : 0;
      if (name === 'door') targetDoorOpen = active ? 1 : 0;
      if (name.startsWith('publication:')) {
        const index = Number(name.slice('publication:'.length));
        if (Number.isInteger(index) && publicationBooks[index]) {
          publicationBooks[index].target = active ? 1 : 0;
        }
      }
    },
    resetDoor() {
      doorOpen = 0;
      targetDoorOpen = 0;
      doorHinge.rotation.y = 0;
    },
    update(dt) {
      const blend = 1 - Math.exp(-Math.min(dt, 0.1) * 7);
      if (Math.abs(targetIllumination - illumination) > 0.0001) {
        illumination = THREE.MathUtils.lerp(illumination, targetIllumination, blend);
        applyLighting();
      }
      newspaperOpen = THREE.MathUtils.lerp(newspaperOpen, targetNewspaperOpen, blend);
      paperFold.rotation.z = 0.13 * (1 - newspaperOpen);
      doorOpen = THREE.MathUtils.lerp(doorOpen, targetDoorOpen, blend);
      doorHinge.rotation.y = -Math.PI / 2 * doorOpen;
      for (const book of publicationBooks) {
        book.selected = THREE.MathUtils.lerp(book.selected, book.target, blend);
        book.root.position.z = book.restZ + 0.13 * book.selected;
        book.root.rotation.x = -0.035 * book.selected;
      }
    },
  };
}
