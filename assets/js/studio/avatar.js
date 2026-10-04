import * as THREE from '../vendor/three.module.min.js';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const smooth = (value) => value * value * (3 - 2 * value);

export const AVATAR_HEIGHT = 1.73;
export const AVATAR_RADIUS = 0.24;

/**
 * An authored, lightweight mannequin inspired by assets/img/avatar.jpg.
 * The caller moves root (floor origin, forward = +Z). update only poses the rig.
 * phase is a gait angle in radians; speed, reach, and sit are normalized blends.
 */
export function createAvatar() {
  const root = new THREE.Group();
  root.name = 'researcher';

  const materials = {
    skin: new THREE.MeshStandardMaterial({ color: 0xd8b6a0, roughness: 0.88 }),
    shirt: new THREE.MeshStandardMaterial({ color: 0x232931, roughness: 0.94 }),
    collar: new THREE.MeshStandardMaterial({ color: 0x343b43, roughness: 0.9 }),
    trousers: new THREE.MeshStandardMaterial({ color: 0x59606a, roughness: 0.95 }),
    shoes: new THREE.MeshStandardMaterial({ color: 0xe5e3d9, roughness: 0.86 }),
    soles: new THREE.MeshStandardMaterial({ color: 0xbac0bd, roughness: 0.95 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x20252b, roughness: 0.9 }),
    hairHighlight: new THREE.MeshStandardMaterial({ color: 0x2d3239, roughness: 0.94 }),
    glasses: new THREE.MeshStandardMaterial({ color: 0x141c24, roughness: 0.5 }),
    eyes: new THREE.MeshStandardMaterial({ color: 0x323235, roughness: 0.9 }),
  };
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  const ring = new THREE.TorusGeometry(0.047, 0.0048, 6, 28);

  function ellipsoid(parent, material, size, position = [0, 0, 0]) {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function taperedSegment(parent, material, length, upperRadius, lowerRadius, depth = 1) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(upperRadius, lowerRadius, length, 16),
      material,
    );
    mesh.position.y = -length / 2;
    mesh.scale.z = depth;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    ellipsoid(parent, material, [upperRadius, upperRadius, upperRadius * depth]);
    ellipsoid(parent, material, [lowerRadius, lowerRadius, lowerRadius * depth], [0, -length, 0]);
    return mesh;
  }

  const hips = new THREE.Group();
  hips.position.y = 0.88;
  root.add(hips);
  ellipsoid(hips, materials.trousers, [0.166, 0.077, 0.104]);

  const torso = new THREE.Group();
  hips.add(torso);
  const shirtProfile = [
    [0.157, 0.015], [0.167, 0.04], [0.177, 0.19],
    [0.201, 0.355], [0.19, 0.397], [0.12, 0.433], [0.066, 0.451],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));
  const shirt = new THREE.Mesh(new THREE.LatheGeometry(shirtProfile, 24), materials.shirt);
  shirt.scale.z = 0.65;
  shirt.castShadow = true;
  shirt.receiveShadow = true;
  torso.add(shirt);
  ellipsoid(torso, materials.skin, [0.055, 0.072, 0.052], [0, 0.472, 0]);

  // Small collar leaves and buttons preserve the reference photo's black polo.
  for (const side of [-1, 1]) {
    const collarShape = new THREE.Shape();
    collarShape.moveTo(side * 0.018, 0.425);
    collarShape.lineTo(side * 0.063, 0.446);
    collarShape.lineTo(side * 0.098, 0.393);
    collarShape.lineTo(side * 0.052, 0.367);
    collarShape.closePath();
    const collar = new THREE.Mesh(
      new THREE.ExtrudeGeometry(collarShape, { depth: 0.007, bevelEnabled: false }),
      materials.collar,
    );
    collar.position.z = 0.088;
    collar.castShadow = true;
    torso.add(collar);
  }
  ellipsoid(torso, materials.shoes, [0.005, 0.006, 0.004], [0, 0.366, 0.131]);
  ellipsoid(torso, materials.shoes, [0.005, 0.006, 0.004], [0, 0.326, 0.131]);

  const head = new THREE.Group();
  head.position.y = 0.665;
  torso.add(head);
  ellipsoid(head, materials.skin, [0.116, 0.15, 0.105]);
  ellipsoid(head, materials.skin, [0.016, 0.033, 0.021], [-0.115, -0.012, 0]);
  ellipsoid(head, materials.skin, [0.016, 0.033, 0.021], [0.115, -0.012, 0]);
  ellipsoid(head, materials.skin, [0.014, 0.023, 0.025], [0, -0.022, 0.101]);

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 14, 0, TAU, 0, Math.PI * 0.59),
    materials.hair,
  );
  hairCap.scale.set(0.128, 0.119, 0.116);
  hairCap.position.set(0, 0.063, -0.006);
  hairCap.castShadow = true;
  head.add(hairCap);
  const leftFringe = ellipsoid(head, materials.hair, [0.066, 0.071, 0.044], [-0.058, 0.09, 0.072]);
  leftFringe.rotation.z = -0.35;
  const rightFringe = ellipsoid(head, materials.hair, [0.061, 0.067, 0.044], [0.06, 0.091, 0.073]);
  rightFringe.rotation.z = 0.4;
  const hairSweep = ellipsoid(head, materials.hairHighlight, [0.045, 0.013, 0.065], [-0.044, 0.161, 0.003]);
  hairSweep.rotation.z = -0.22;

  for (const side of [-1, 1]) {
    ellipsoid(head, materials.eyes, [0.007, 0.009, 0.004], [side * 0.053, 0.013, 0.097]);
    const frame = new THREE.Mesh(ring, materials.glasses);
    frame.position.set(side * 0.052, 0.013, 0.11);
    frame.scale.y = 0.91;
    frame.rotation.y = side * 0.07;
    head.add(frame);
    const arm = ellipsoid(head, materials.glasses, [0.004, 0.004, 0.052], [side * 0.101, 0.022, 0.063]);
    arm.rotation.y = side * 0.19;
  }
  ellipsoid(head, materials.glasses, [0.013, 0.004, 0.004], [0, 0.021, 0.115]);

  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.215, 0.424, 0);
    torso.add(shoulder);
    taperedSegment(shoulder, materials.skin, 0.265, 0.047, 0.035, 0.95);
    taperedSegment(shoulder, materials.shirt, 0.115, 0.069, 0.063, 0.95);
    const elbow = new THREE.Group();
    elbow.position.y = -0.265;
    shoulder.add(elbow);
    taperedSegment(elbow, materials.skin, 0.235, 0.036, 0.025, 0.92);
    const hand = new THREE.Group();
    hand.position.y = -0.256;
    elbow.add(hand);
    ellipsoid(hand, materials.skin, [0.03, 0.044, 0.021]);
    ellipsoid(hand, materials.skin, [0.014, 0.024, 0.013], [-side * 0.023, 0.006, 0.009]);
    return { shoulder, elbow, hand, side };
  }
  const arms = [makeArm(-1), makeArm(1)];

  const thighLength = 0.405;
  const shinLength = 0.385;
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.x = side * 0.092;
    hips.add(hip);
    taperedSegment(hip, materials.trousers, thighLength, 0.077, 0.054, 0.94);
    const knee = new THREE.Group();
    knee.position.y = -thighLength;
    hip.add(knee);
    taperedSegment(knee, materials.trousers, shinLength, 0.055, 0.038, 0.95);
    const foot = new THREE.Group();
    foot.position.y = -shinLength;
    knee.add(foot);
    ellipsoid(foot, materials.soles, [0.065, 0.019, 0.118], [0, -0.083, 0.044]);
    ellipsoid(foot, materials.shoes, [0.063, 0.042, 0.114], [0, -0.061, 0.044]);
    ellipsoid(foot, materials.shoes, [0.043, 0.035, 0.052], [0, -0.026, 0.001]);
    return { hip, knee, foot, side };
  }
  const legs = [makeLeg(-1), makeLeg(1)];

  // Two-bone posing keeps the shoes level through the planted part of each step.
  function placeFoot(leg, targetY, targetZ) {
    const down = hips.position.y - targetY;
    const distance = clamp(Math.hypot(down, targetZ), 0.025, thighLength + shinLength - 0.0001);
    const aim = Math.atan2(targetZ, down);
    const hipBend = Math.acos(clamp(
      (thighLength ** 2 + distance ** 2 - shinLength ** 2) / (2 * thighLength * distance), -1, 1,
    ));
    const kneeBend = Math.acos(clamp(
      (distance ** 2 - thighLength ** 2 - shinLength ** 2) / (2 * thighLength * shinLength), -1, 1,
    ));
    leg.hip.rotation.x = -aim - hipBend;
    leg.knee.rotation.x = kneeBend;
    leg.foot.rotation.x = -leg.hip.rotation.x - leg.knee.rotation.x;
  }

  function update({ state = 'idle', phase = 0, speed = 0, reach = 0, sit = 0, time = 0 } = {}) {
    const seated = smooth(clamp(sit, 0, 1));
    const reaching = smooth(clamp(reach, 0, 1));
    const reading = state === 'read' ? reaching : 0;
    const touching = state === 'read' ? 0 : reaching;
    const gait = clamp(speed, 0, 1) * (1 - seated) * (1 - reaching);
    const breath = Math.sin(time * 1.7) * 0.0025 * (1 - gait);
    hips.position.y = mix(0.88 - gait * 0.007 + Math.cos(phase * 2) * 0.004 * gait, 0.597, seated);
    torso.position.y = breath;
    torso.rotation.set(seated * 0.12 + gait * 0.022, Math.sin(phase) * 0.035 * gait, Math.sin(phase) * 0.01 * gait);
    head.rotation.set(reading * 0.19 + seated * 0.035, Math.sin(time * 0.33) * 0.035 * (1 - gait - reaching), 0);

    for (const leg of legs) {
      const cycle = ((phase / TAU + (leg.side > 0 ? 0.5 : 0)) % 1 + 1) % 1;
      const stance = 0.6;
      let foreAft;
      let lift = 0;
      if (cycle < stance) {
        foreAft = 0.18 - (cycle / stance) * 0.36;
      } else {
        const swing = (cycle - stance) / (1 - stance);
        foreAft = -0.18 + smooth(swing) * 0.36;
        lift = Math.sin(swing * Math.PI) * 0.065;
      }
      placeFoot(leg, 0.103 + lift * gait, mix(0.012 + foreAft * gait, 0.415, seated));
    }

    for (const arm of arms) {
      const walkingSwing = Math.cos(phase + (arm.side > 0 ? Math.PI : 0)) * 0.31 * gait;
      let shoulderX = -0.055 + walkingSwing;
      let elbowX = -0.08 - Math.max(0, -walkingSwing) * 0.35;
      shoulderX = mix(shoulderX, -0.47, seated);
      elbowX = mix(elbowX, -0.39, seated);
      shoulderX = mix(shoulderX, -0.32, reading);
      elbowX = mix(elbowX, -1.04, reading);
      if (arm.side < 0) {
        shoulderX = mix(shoulderX, -1.05, touching);
        elbowX = mix(elbowX, -0.37, touching);
      }
      arm.shoulder.rotation.set(shoulderX, 0, arm.side * mix(0.075, 0.015, Math.max(seated, reaching)));
      arm.elbow.rotation.x = elbowX;
      arm.hand.rotation.x = -reading * 0.15;
      arm.hand.rotation.z = -arm.side * reading * 0.25;
    }
  }

  update();
  return { root, update };
}
