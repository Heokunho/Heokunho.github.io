import * as THREE from '../vendor/three.module.min.js';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** Blur the visible silhouette as a whole, without drawing geometry edges. */
export function createHighlightGlow(renderer, scene, camera, room) {
  const mask = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true, samples: Math.min(4, renderer.capabilities.maxSamples),
  });
  const horizontal = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const blurred = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const occluder = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false });
  const maskMaterials = new Map();
  const meshMaterials = new Map();
  for (const [name, entry] of room.highlights) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    maskMaterials.set(name, material);
    for (const mesh of entry.meshes) meshMaterials.set(mesh, material);
  }

  const blurMaterial = new THREE.ShaderMaterial({
    uniforms: { source: { value: mask.texture }, direction: { value: new THREE.Vector2() } },
    vertexShader,
    fragmentShader: `
      uniform sampler2D source;
      uniform vec2 direction;
      varying vec2 vUv;
      void main() {
        float value = texture2D(source, vUv).r * 0.227027;
        value += texture2D(source, vUv + direction * 1.384615).r * 0.316216;
        value += texture2D(source, vUv - direction * 1.384615).r * 0.316216;
        value += texture2D(source, vUv + direction * 3.230769).r * 0.070270;
        value += texture2D(source, vUv - direction * 3.230769).r * 0.070270;
        gl_FragColor = vec4(vec3(value), 1.0);
      }
    `,
    depthTest: false, depthWrite: false, toneMapped: false,
  });
  const compositeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      silhouette: { value: mask.texture }, halo: { value: blurred.texture },
      glowColor: { value: room.highlightColor },
    },
    vertexShader,
    fragmentShader: `
      uniform sampler2D silhouette;
      uniform sampler2D halo;
      uniform vec3 glowColor;
      varying vec2 vUv;
      void main() {
        // Subtract the solid object so its interior and furniture joints stay clean.
        float glow = max(texture2D(halo, vUv).r - texture2D(silhouette, vUv).r, 0.0);
        gl_FragColor = vec4(glowColor, min(glow * 1.5, 0.7));
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const screenScene = new THREE.Scene();
  const screenCamera = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMaterial);
  quad.frustumCulled = false;
  screenScene.add(quad);
  let width = 1;
  let height = 1;
  const clearColor = new THREE.Color();

  return {
    setSize(cssWidth, cssHeight) {
      // A CSS-pixel mask keeps the glow equally soft on phones and high-DPI screens.
      width = Math.max(1, Math.ceil(cssWidth));
      height = Math.max(1, Math.ceil(cssHeight));
      for (const target of [mask, horizontal, blurred]) target.setSize(width, height);
    },
    render() {
      if (![...room.highlights.values()].some(entry => entry.amount > 0.001)) return;
      for (const [name, entry] of room.highlights) maskMaterials.get(name).color.setScalar(entry.amount);

      const previousTarget = renderer.getRenderTarget();
      const previousAutoClear = renderer.autoClear;
      const previousShadowUpdate = renderer.shadowMap.autoUpdate;
      const previousShadowNeedsUpdate = renderer.shadowMap.needsUpdate;
      const previousBackground = scene.background;
      const previousClearAlpha = renderer.getClearAlpha();
      renderer.getClearColor(clearColor);
      const originals = [];
      try {
        renderer.autoClear = true;
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = false;
        renderer.setClearColor(0x000000, 0);
        scene.background = null;
        // The whole scene supplies depth, so the glow follows the visible object.
        // Only this offscreen pass uses flat materials; restore them before compositing.
        scene.traverse(node => {
          if (!node.isMesh) return;
          originals.push({ node, material: node.material, visible: node.visible });
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          if (materials.some(material => material.transparent)) node.visible = false;
          node.material = meshMaterials.get(node) || occluder;
        });
        renderer.setRenderTarget(mask);
        try {
          renderer.render(scene, camera);
        } finally {
          for (const { node, material, visible } of originals) {
            node.material = material;
            node.visible = visible;
          }
        }
        quad.material = blurMaterial;
        blurMaterial.uniforms.source.value = mask.texture;
        blurMaterial.uniforms.direction.value.set(2 / width, 0);
        renderer.setRenderTarget(horizontal);
        renderer.render(screenScene, screenCamera);
        blurMaterial.uniforms.source.value = horizontal.texture;
        blurMaterial.uniforms.direction.value.set(0, 2 / height);
        renderer.setRenderTarget(blurred);
        renderer.render(screenScene, screenCamera);

        renderer.setRenderTarget(previousTarget);
        renderer.autoClear = false;
        quad.material = compositeMaterial;
        renderer.render(screenScene, screenCamera);
      } finally {
        renderer.setRenderTarget(previousTarget);
        renderer.setClearColor(clearColor, previousClearAlpha);
        renderer.autoClear = previousAutoClear;
        renderer.shadowMap.autoUpdate = previousShadowUpdate;
        renderer.shadowMap.needsUpdate = previousShadowNeedsUpdate;
        scene.background = previousBackground;
      }
    },
    dispose() {
      for (const target of [mask, horizontal, blurred]) target.dispose();
      for (const material of maskMaterials.values()) material.dispose();
      occluder.dispose();
      blurMaterial.dispose();
      compositeMaterial.dispose();
      quad.geometry.dispose();
    },
  };
}
