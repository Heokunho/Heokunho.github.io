import * as THREE from '../vendor/three.module.min.js';
import { createAvatar, AVATAR_RADIUS } from './avatar.js';
import { createRoom } from './room.js';
import { createNavigator } from './navigation.js';

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const labels = {
  lamp: 'Lamp · change theme',
  books: 'Bookshelf · publications',
  news: 'Newspaper · latest news',
  door: 'Door',
};
const isPublication = (name) => /^publication:\d+$/.test(name);
const isReading = (name) => name === 'books' || name === 'news' || isPublication(name);
const objectNoun = (name) => name === 'books' ? 'bookshelf' : name === 'news' ? 'newspaper' : isPublication(name) ? 'book' : name;

/** A small authored scene. No model inference or remote assets are used. */
export function createStudio(canvas, callbacks = {}, content = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const room = createRoom(content);
  const avatar = createAvatar();
  scene.add(room.root, avatar.root);
  avatar.root.position.set(-0.55, 0, 0.85);
  avatar.root.rotation.y = 0.3;
  const camera = new THREE.OrthographicCamera(-4, 4, 2, -2, 0.1, 50);
  camera.position.set(6.3, 7, 10);
  camera.lookAt(0, 0.25, 0);
  const navigator = createNavigator(room.bounds, room.obstacles, AVATAR_RADIUS);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.065, 0.09, 40), new THREE.MeshBasicMaterial({
    color: '#789b91', transparent: true, opacity: 0, depthWrite: false,
  }));
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.023;
  scene.add(marker);

  let active = false;
  let paused = false;
  let disposed = false;
  let frame = 0;
  let lastFrame = 0;
  let time = 0;
  let phase = 0;
  let gait = 0;
  let mode = 'idle';
  let elapsed = 0;
  let path = [];
  let object = null;
  let contact = false;
  let reach = 0;
  let readingOpen = null;
  let markerLife = 0;
  let nextWander = 12;
  let pointerDown = null;
  let contextLost = false;

  function status(message) { callbacks.onStatus?.(message); }

  function hoverLabel(name) {
    if (!isPublication(name)) return labels[name];
    const publication = content.publications?.[Number(name.split(':')[1])];
    if (!publication) return 'Book · publication';
    const title = publication.title.length > 70 ? `${publication.title.slice(0, 67)}…` : publication.title;
    return publication.venue ? `${title} · ${publication.venue}` : title;
  }

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const visibleHeight = Math.max(4.25, 7.8 / aspect);
    camera.left = -visibleHeight * aspect / 2;
    camera.right = visibleHeight * aspect / 2;
    camera.top = visibleHeight / 2;
    camera.bottom = -visibleHeight / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }

  function render() {
    if (!disposed && !contextLost) renderer.render(scene, camera);
  }

  function turnTo(yaw, dt) {
    const delta = Math.atan2(Math.sin(yaw - avatar.root.rotation.y), Math.cos(yaw - avatar.root.rotation.y));
    avatar.root.rotation.y += clamp(delta, -dt * 5, dt * 5);
    return Math.abs(delta) < 0.04;
  }

  function closeBooks() {
    if (readingOpen) room.setInteraction(readingOpen, false);
    readingOpen = null;
    callbacks.onBooksClose?.();
    nextWander = time + 18;
  }

  function navigate(point, interaction = null, autonomous = false) {
    const destination = navigator.closestWalkable(point);
    const route = navigator.findPath(avatar.root.position, destination);
    if (!route) {
      status('There is no clear path there. Try another spot.');
      return;
    }
    object = interaction;
    path = route;
    reach = 0;
    elapsed = 0;
    contact = false;
    mode = path.length ? 'walk' : (object ? 'turn' : 'idle');
    if (!autonomous) {
      marker.position.set(destination.x, 0.023, destination.z);
      markerLife = 1.5;
      status(interaction ? `Walking to the ${objectNoun(interaction)}.` : 'Walking to the selected spot.');
    }
  }

  function command(point, interaction = null, autonomous = false) {
    // Once the character is crossing the threshold, finish the short exit.
    // Normal navigation must never start from outside the room's bounds.
    if (mode === 'door-exit' || mode === 'exited') return;
    if (object === 'door') room.setInteraction('door', false);
    if (!autonomous) {
      paused = false;
      closeBooks();
      nextWander = time + 22;
    }
    navigate(point, interaction, autonomous);
  }

  function interact(name) {
    if (!room.targets[name] || disposed) return;
    command(room.targets[name], name);
  }

  function resetExit() {
    if (object !== 'door' && mode !== 'exited') return;
    // Reopening after leaving (or manually folding during an exit) starts
    // inside again, without a pending exit that could fold the scene a second time.
    path = [];
    object = null;
    mode = 'idle';
    elapsed = reach = gait = phase = markerLife = 0;
    contact = false;
    marker.material.opacity = 0;
    room.resetDoor();
    avatar.root.visible = true;
    avatar.root.position.set(-0.55, 0, 0.85);
    avatar.root.rotation.y = 0.3;
    avatar.update({ time });
    paused = reducedMotion.matches;
    nextWander = time + 12;
    status('Ready to explore.');
  }

  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...room.pickables, room.floor], false)[0];
    return hit ? { hit, name: hit.object.userData.interaction, x: event.clientX - rect.left, y: event.clientY - rect.top } : null;
  }

  function onPointerDown(event) {
    if (event.button !== 0 || !event.isPrimary) return;
    pointerDown = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event) {
    if (!pointerDown) return;
    const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    pointerDown = null;
    if (moved > 7) return; // A swipe belongs to page scrolling.
    callbacks.onUserAction?.();
    const result = pick(event);
    if (result?.name) interact(result.name);
    else if (result?.hit.object === room.floor && result.hit.face?.normal.y > 0.5) command(result.hit.point);
  }

  function onPointerMove(event) {
    if (event.pointerType === 'touch') return;
    const result = pick(event);
    if (result?.name) {
      canvas.dataset.hover = result.name;
      callbacks.onHover?.({ label: hoverLabel(result.name), x: result.x, y: result.y });
    } else clearHover();
  }

  function clearHover() {
    delete canvas.dataset.hover;
    callbacks.onHover?.(null);
  }

  function onKeyDown(event) {
    const offsets = { ArrowUp: [0, -0.5], ArrowDown: [0, 0.5], ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0] };
    if (!offsets[event.key]) return;
    event.preventDefault();
    callbacks.onUserAction?.();
    const [x, z] = offsets[event.key];
    command({ x: avatar.root.position.x + x, z: avatar.root.position.z + z });
  }

  function idle(dt) {
    if (time < nextWander || reducedMotion.matches || readingOpen) return;
    const places = [{ x: -1.8, z: 0.72 }, { x: -0.65, z: 0.6 }, { x: 1.7, z: 1.1 }];
    const choices = places.filter((point) => distance(point, avatar.root.position) > 0.65);
    const point = choices[Math.floor(Math.random() * choices.length)];
    nextWander = time + 20 + Math.random() * 12;
    if (point) command(point, null, true);
  }

  function step(dt) {
    time += dt;
    elapsed += dt;
    let walking = 0;
    let animationState = 'idle';
    if (mode === 'walk') {
      const target = path[0];
      if (!target) {
        mode = object ? 'turn' : 'idle';
        elapsed = 0;
        nextWander = Math.max(nextWander, time + 15);
        if (!object) status('Ready to explore.');
      } else {
        const remaining = distance(avatar.root.position, target);
        const yaw = Math.atan2(target.x - avatar.root.position.x, target.z - avatar.root.position.z);
        const facing = turnTo(yaw, dt);
        const yawError = Math.abs(Math.atan2(Math.sin(yaw - avatar.root.rotation.y), Math.cos(yaw - avatar.root.rotation.y)));
        if (facing || yawError < 0.45) {
          const movement = Math.min(remaining, 0.78 * dt);
          if (remaining > 0.0001) {
            avatar.root.position.x += (target.x - avatar.root.position.x) / remaining * movement;
            avatar.root.position.z += (target.z - avatar.root.position.z) / remaining * movement;
          }
          phase += movement / 0.6 * Math.PI * 2;
          walking = movement > 0.0001 ? 1 : 0;
          if (remaining <= movement + 0.003) {
            avatar.root.position.x = target.x;
            avatar.root.position.z = target.z;
            path.shift();
          }
        }
      }
    } else if (mode === 'turn') {
      const target = room.targets[object];
      const yaw = Math.atan2(target.lookAt.x - avatar.root.position.x, target.lookAt.z - avatar.root.position.z);
      if (turnTo(yaw, dt)) {
        mode = 'reach';
        elapsed = 0;
      }
    } else if (mode === 'reach') {
      animationState = 'reach';
      reach = elapsed < 0.6 ? ease(elapsed / 0.6) : 1 - ease((elapsed - 0.85) / 0.55);
      if (elapsed >= 0.6 && !contact) {
        contact = true;
        if (object === 'door') {
          room.setInteraction('door', true);
          status('Opening the door.');
        } else if (isReading(object)) {
          readingOpen = object;
          room.setInteraction(object, true);
          status(object === 'news'
            ? 'Newspaper opened. Read the latest news, or close the card.'
            : 'Publication card opened. Choose a publication link to navigate, or close the card.');
        } else status('Lamp switched.');
        if (object !== 'door') callbacks.onInteraction?.(object);
      }
      if (elapsed >= 1.4) {
        reach = 0;
        mode = object === 'door' ? 'door-exit' : 'idle';
        elapsed = 0;
        nextWander = time + 20;
        if (mode === 'door-exit') status('Leaving the room.');
      }
    } else if (mode === 'door-exit') {
      // This authored segment passes through the opened door and deliberately
      // crosses the room boundary; ordinary floor clicks stay within it.
      const target = room.targets.door.exit;
      const remaining = distance(avatar.root.position, target);
      const movement = Math.min(remaining, 0.78 * dt);
      avatar.root.rotation.y = Math.atan2(target.x - avatar.root.position.x, target.z - avatar.root.position.z);
      if (remaining > 0.0001) {
        avatar.root.position.x += (target.x - avatar.root.position.x) / remaining * movement;
        avatar.root.position.z += (target.z - avatar.root.position.z) / remaining * movement;
      }
      phase += movement / 0.6 * Math.PI * 2;
      walking = movement > 0.0001 ? 1 : 0;
      if (remaining <= movement + 0.003) {
        avatar.root.position.set(target.x, 0, target.z);
        avatar.root.visible = false;
        mode = 'exited';
        clearHover();
        callbacks.onExit?.();
      }
    } else if (mode === 'idle') idle(dt);

    gait = lerp(gait, walking, 1 - Math.exp(-dt * 12));
    avatar.update({ state: animationState, phase, speed: gait, reach, time });
    room.update(dt, time);
    markerLife = Math.max(0, markerLife - dt);
    marker.material.opacity = Math.min(markerLife, 0.6);
  }

  function tick(now) {
    frame = 0;
    if (!active || disposed || contextLost) return;
    const dt = Math.min((now - lastFrame) / 1000 || 0, 0.05);
    // Cap rendering at 30fps; skip simulation altogether while paused.
    if (now - lastFrame >= 1000 / 30 - 1) {
      lastFrame = now;
      if (!paused) step(dt);
      else room.update(dt, time); // A direct theme change still updates the lamp.
      render();
    }
    if (active && !disposed && !contextLost) frame = requestAnimationFrame(tick);
  }

  function setActive(value) {
    active = value;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (active && !disposed && !contextLost) {
      lastFrame = performance.now();
      resize();
      frame = requestAnimationFrame(tick);
    } else clearHover();
  }

  function onContextLost(event) {
    event.preventDefault();
    contextLost = true;
    setActive(false);
    callbacks.onError?.(new Error('WebGL context lost'));
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', clearHover);
  const cancelPointer = () => { pointerDown = null; };
  canvas.addEventListener('pointercancel', cancelPointer);
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('webglcontextlost', onContextLost);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  room.setTheme(document.documentElement.dataset.theme || 'light', true);
  avatar.update();
  resize();

  return {
    interact, closeBooks, setActive, resetExit,
    setPaused(value) { paused = value; },
    setTheme(theme) { room.setTheme(theme, !active || reducedMotion.matches); if (!active) render(); },
    dispose() {
      disposed = true;
      setActive(false);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', clearHover);
      canvas.removeEventListener('pointercancel', cancelPointer);
      canvas.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      const geometries = new Set();
      const materials = new Set();
      const textures = new Set();
      scene.traverse((node) => {
        if (node.geometry) geometries.add(node.geometry);
        if (node.material) (Array.isArray(node.material) ? node.material : [node.material]).forEach((item) => materials.add(item));
        if (node.shadow) node.shadow.map?.dispose();
      });
      geometries.forEach((item) => item.dispose());
      materials.forEach((item) => {
        Object.values(item).forEach((value) => { if (value?.isTexture) textures.add(value); });
        item.dispose();
      });
      textures.forEach((item) => item.dispose());
      renderer.dispose();
    },
  };
}
