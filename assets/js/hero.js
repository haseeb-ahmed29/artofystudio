/**
 * Optional homepage enhancement. Three.js r169 / npm 0.169.0 is vendored locally.
 * The real image and the HTML fallback remain the source of essential content.
 */
const host = document.querySelector('#sketchbook-scene');
let cleanUpEnhancement = () => {};

if (host) enhanceSketchbook().catch(() => {
  cleanUpEnhancement();
  host.classList.remove('scene-ready');
});

async function enhanceSketchbook() {
  const THREE = await import('../vendor/three.module.js');
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  let reduced = reducedQuery.matches;
  let narrow = host.clientWidth < 480;
  let stopped = false;
  let raf = 0;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !narrow, powerPreference: 'low-power' });
  } catch {
    return;
  }

  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity .6s ease';
  if (reduced) canvas.style.transition = 'none';
  host.append(canvas);
  cleanUpEnhancement = () => {
    renderer.dispose();
    canvas.remove();
  };
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  const desk = new THREE.Group();
  scene.add(desk);
  const book = new THREE.Group();
  book.rotation.y = -0.18;
  book.position.set(0.05, 0.1, -0.1);
  desk.add(book);

  scene.add(new THREE.HemisphereLight(0xfffbf0, 0x8a8179, 2.6));
  const sunlight = new THREE.DirectionalLight(0xffe4c8, 3.3);
  sunlight.position.set(-4, 9, 5);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(narrow ? 512 : 1024, narrow ? 512 : 1024);
  sunlight.shadow.camera.left = -6;
  sunlight.shadow.camera.right = 6;
  sunlight.shadow.camera.top = 6;
  sunlight.shadow.camera.bottom = -6;
  sunlight.shadow.camera.near = 0.5;
  sunlight.shadow.camera.far = 22;
  sunlight.shadow.normalBias = 0.035;
  sunlight.shadow.bias = -0.0002;
  sunlight.shadow.radius = 4;
  scene.add(sunlight);
  const fill = new THREE.DirectionalLight(0xffffff, 0.9);
  fill.position.set(5, 4, -6);
  scene.add(fill);

  const paper = new THREE.MeshStandardMaterial({ color: 0xfff9e9, roughness: 0.98 });
  const paperEdge = new THREE.MeshStandardMaterial({ color: 0xe6dcc7, roughness: 1 });
  const cover = new THREE.MeshStandardMaterial({ color: 0x6c6054, roughness: 0.94 });
  const graphite = new THREE.LineBasicMaterial({ color: 0x655e55, transparent: true, opacity: 0.72 });
  const faintGraphite = new THREE.LineBasicMaterial({ color: 0x9a8e7b, transparent: true, opacity: 0.25 });

  function block(width, height, depth, material, x, y, z, parent = book) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // Separate covers, stacked page blocks, curved top sheets, and a low central
  // hinge give the spread physical depth instead of using a flat book image.
  for (const side of [-1, 1]) {
    block(3.25, 0.09, 4.48, cover, side * 1.65, 0.015, 0);
    block(3.13, 0.22, 4.33, paperEdge, side * 1.62, 0.16, 0);
    for (let layer = 0; layer < (narrow ? 3 : 6); layer += 1) {
      const y = 0.075 + layer * 0.032;
      const points = [
        new THREE.Vector3(side * 0.065, y, 2.17),
        new THREE.Vector3(side * 3.18, y + 0.015, 2.17),
        new THREE.Vector3(side * 3.18, y + 0.015, -2.17),
      ];
      book.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), faintGraphite));
    }
  }
  block(0.16, 0.13, 4.42, cover, 0, 0.025, 0);

  function pageHeight(x, z) {
    return 0.27 + 0.13 * (1 - Math.exp(-Math.abs(x) * 2.2)) + 0.015 * (z / 2.15) ** 2;
  }

  function curvedSheet(x0, x1, z0, z1, material, elevation = 0, segments = 22) {
    const positions = [];
    const uv = [];
    const indices = [];
    for (let row = 0; row <= segments; row += 1) {
      for (let column = 0; column <= segments; column += 1) {
        const x = x0 + (x1 - x0) * column / segments;
        const z = z0 + (z1 - z0) * row / segments;
        positions.push(x, pageHeight(x, z) + elevation, z);
        uv.push(column / segments, 1 - row / segments);
        if (row < segments && column < segments) {
          const a = row * (segments + 1) + column;
          const b = a + 1;
          const c = a + segments + 1;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    book.add(mesh);
    return mesh;
  }

  curvedSheet(-3.18, -0.045, -2.17, 2.17, paper, 0, narrow ? 12 : 26);
  curvedSheet(0.045, 3.18, -2.17, 2.17, paper, 0, narrow ? 12 : 26);

  function inkPath(points, material = graphite, elevation = 0.017) {
    const vectors = points.map(([x, z]) => new THREE.Vector3(x, pageHeight(x, z) + elevation, z));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(vectors), material);
    book.add(line);
    return line;
  }

  inkPath([[0, -2.17], [0, 2.17]], faintGraphite, 0.003);
  inkPath([[-0.06, -2.12], [-0.06, 2.12]], faintGraphite, 0.004);
  inkPath([[0.06, -2.12], [0.06, 2.12]], faintGraphite, 0.004);

  // An original decorative graphite character study, built from line geometry.
  // It is interface illustration, not an altered portfolio artwork or a WIP.
  const sketchPaths = [
    [[-2.31,-0.75],[-2.34,-1.02],[-2.18,-1.32],[-1.99,-1.23],[-1.92,-1.52],[-1.67,-1.42],[-1.45,-1.56],[-1.29,-1.27],[-1.09,-1.22],[-1.04,-0.86]],
    [[-2.34,-1.02],[-2.09,-0.91],[-1.98,-1.16],[-1.84,-0.77],[-1.68,-1.07],[-1.43,-0.74],[-1.38,-1.04],[-1.12,-0.83]],
    [[-2.22,-0.72],[-2.17,-0.24],[-1.99,0.01],[-1.71,0.18],[-1.41,-0.02],[-1.24,-0.32],[-1.21,-0.78]],
    [[-2.24,-0.67],[-2.39,-0.62],[-2.34,-0.36],[-2.16,-0.27]],
    [[-1.2,-0.65],[-1.04,-0.63],[-1.08,-0.35],[-1.25,-0.27]],
    [[-2.13,-0.59],[-1.98,-0.67],[-1.81,-0.61]],
    [[-1.62,-0.61],[-1.45,-0.68],[-1.29,-0.61]],
    [[-2.11,-0.49],[-1.99,-0.45],[-1.85,-0.48]],
    [[-1.60,-0.48],[-1.46,-0.44],[-1.33,-0.49]],
    [[-1.98,-0.56],[-1.98,-0.44]],
    [[-1.46,-0.56],[-1.46,-0.44]],
    [[-1.72,-0.48],[-1.77,-0.19],[-1.67,-0.16]],
    [[-1.88,-0.01],[-1.72,0.02],[-1.56,-0.02]],
    [[-1.99,0.05],[-2.02,0.39],[-1.73,0.55],[-1.42,0.35],[-1.43,0.02]],
    [[-2.03,0.27],[-2.38,0.43],[-2.67,0.82],[-2.8,1.51]],
    [[-1.42,0.27],[-1.04,0.46],[-0.76,0.93],[-0.65,1.52]],
    [[-2.38,0.43],[-2.2,0.97],[-1.73,0.63],[-1.27,0.99],[-1.04,0.46]],
    [[-2.21,0.94],[-2.09,1.58]],
    [[-1.28,0.96],[-1.36,1.59]],
    [[-2.67,0.87],[-2.31,1.01],[-2.3,1.43],[-2.74,1.3]],
    [[-0.81,0.94],[-1.14,1.08],[-1.09,1.46],[-0.69,1.3]],
    [[-1.73,0.67],[-1.72,1.56]],
    [[-2.07,1.13],[-1.83,1.26],[-1.61,1.24],[-1.39,1.11]],
  ];
  sketchPaths.forEach((points) => inkPath(points));
  if (!narrow) {
    const guide = [];
    for (let i = 0; i <= 60; i += 1) {
      const angle = i / 60 * Math.PI * 2;
      guide.push([-1.73 + Math.cos(angle) * 0.64, -0.65 + Math.sin(angle) * 0.78]);
    }
    inkPath(guide, faintGraphite, 0.009);
    inkPath([[-2.58,-0.62],[-0.91,-0.62]], faintGraphite, 0.009);
    inkPath([[-1.73,-1.63],[-1.73,0.28]], faintGraphite, 0.009);
    for (let i = 0; i < 9; i += 1) {
      inkPath([[-2.65 + i * 0.045, 0.95],[-2.54 + i * 0.045, 1.19]], faintGraphite);
    }
  }

  // A cloth bookmark and two loose sheets make this a small drawing desk.
  const pink = new THREE.MeshStandardMaterial({ color: 0xc74378, roughness: 0.9 });
  const bookmark = block(0.16, 0.018, 0.73, pink, 0.16, 0.061, 2.41);
  bookmark.rotation.y = -0.10;
  const loose = new THREE.Group();
  loose.position.set(-1.0, -0.005, -0.36);
  loose.rotation.y = -0.16;
  desk.add(loose);
  block(5.6, 0.025, 4.23, paper, 0, 0.015, 0, loose);
  if (!narrow) {
    const secondSheet = block(4.4, 0.02, 3.6, paperEdge, 0.24, -0.012, 0.08, loose);
    secondSheet.rotation.y = 0.09;
  }

  const pencil = new THREE.Group();
  pencil.position.set(3.53, 0.15, 0.65);
  pencil.rotation.y = -0.25;
  desk.add(pencil);
  function pencilPart(radiusTop, radiusBottom, length, material, z, radial = 6) {
    const part = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, radial), material);
    part.rotation.x = Math.PI / 2;
    part.position.z = z;
    part.castShadow = true;
    pencil.add(part);
    return part;
  }
  const pencilPaint = new THREE.MeshStandardMaterial({ color: 0x45413b, roughness: 0.8 });
  const wood = new THREE.MeshStandardMaterial({ color: 0xd5ae78, roughness: 1 });
  pencilPart(0.062, 0.062, 2.4, pencilPaint, 0);
  pencilPart(0.008, 0.062, 0.29, wood, 1.345);
  pencilPart(0, 0.014, 0.1, cover, 1.535);
  pencilPart(0.064, 0.064, 0.16, paperEdge, -1.27);
  pencilPart(0.064, 0.064, 0.22, pink, -1.45);
  const eraser = block(0.62, 0.18, 0.33, pink, -2.77, 0.10, 2.50, desk);
  eraser.rotation.y = -0.35;
  const eraserSleeve = block(0.26, 0.185, 0.337, paper, -2.77, 0.104, 2.50, desk);
  eraserSleeve.rotation.y = -0.35;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ color: 0x4e3d2e, opacity: 0.18 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.075;
  ground.receiveShadow = true;
  scene.add(ground);

  // Do not reveal the canvas until the original local artwork has loaded.
  let texture;
  cleanUpEnhancement = dispose;
  try {
    texture = await new THREE.TextureLoader().loadAsync(new URL('../images/fantasy-battle.jpg', import.meta.url).href);
  } catch {
    dispose();
    return;
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), narrow ? 2 : 4);
  const ratio = texture.image.width / texture.image.height;
  const maxWidth = 2.58;
  const maxDepth = 3.34;
  const artWidth = Math.min(maxWidth, maxDepth * ratio);
  const artDepth = artWidth / ratio;
  const artX = 1.65;
  const artZ = -0.05;
  // Keep the portfolio image's color intact while the surrounding paper is lit.
  const artMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true, opacity: reduced ? 1 : 0 });
  curvedSheet(artX - artWidth / 2, artX + artWidth / 2, artZ - artDepth / 2, artZ + artDepth / 2, artMaterial, 0.013, narrow ? 10 : 22);

  const border = [];
  const bx0 = artX - artWidth / 2 - 0.07;
  const bx1 = artX + artWidth / 2 + 0.07;
  const bz0 = artZ - artDepth / 2 - 0.07;
  const bz1 = artZ + artDepth / 2 + 0.07;
  const corners = [[bx0,bz0],[bx1,bz0],[bx1,bz1],[bx0,bz1],[bx0,bz0]];
  for (let side = 0; side < 4; side += 1) {
    for (let step = 0; step < 24; step += 1) {
      const t = step / 24;
      border.push([corners[side][0] + (corners[side + 1][0] - corners[side][0]) * t, corners[side][1] + (corners[side + 1][1] - corners[side][1]) * t]);
    }
  }
  border.push(corners[4]);
  const frame = inkPath(border, graphite, 0.024);
  frame.geometry.setDrawRange(0, reduced ? border.length : 0);

  let visible = true;
  let start = performance.now();
  let entryFinished = reduced;
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  const baseRotation = -0.025;
  desk.rotation.z = baseRotation;

  function resize() {
    if (stopped) return;
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    narrow = width < 480;
    const density = Math.min(window.devicePixelRatio || 1, narrow ? 1.35 : 1.75, Math.sqrt(1400000 / (width * height)));
    renderer.setPixelRatio(density);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const fit = Math.max(1, 1.12 / camera.aspect);
    camera.position.set(0.35, 8.5 * fit, 7.65 * fit);
    camera.lookAt(0.04, 0.1, 0.1);
    camera.updateProjectionMatrix();
    requestRender();
  }

  function requestRender() {
    if (!raf && !stopped && visible && !document.hidden) raf = requestAnimationFrame(render);
  }

  function render(now) {
    raf = 0;
    if (stopped || !visible || document.hidden) return;
    const movement = !reduced && pointerQuery.matches;
    current.x += ((movement ? target.x : 0) - current.x) * 0.075;
    current.y += ((movement ? target.y : 0) - current.y) * 0.075;
    desk.rotation.x = current.y * 0.035;
    desk.rotation.y = current.x * 0.055;
    desk.rotation.z = baseRotation + current.x * 0.012;
    if (!entryFinished) {
      const progress = Math.min(1, (now - start) / 1150);
      frame.geometry.setDrawRange(0, Math.ceil(border.length * Math.min(1, progress * 1.6)));
      artMaterial.opacity = Math.min(1, Math.max(0, (progress - 0.15) / 0.7));
      if (progress === 1) entryFinished = true;
    }
    try {
      renderer.render(scene, camera);
    } catch {
      dispose();
      return;
    }
    if (!entryFinished || Math.abs(current.x - (movement ? target.x : 0)) > 0.0003 || Math.abs(current.y - (movement ? target.y : 0)) > 0.0003) requestRender();
  }

  function resetPointer() {
    target.x = 0;
    target.y = 0;
    requestRender();
  }

  function pointerMove(event) {
    if (reduced || !pointerQuery.matches) return;
    const bounds = host.getBoundingClientRect();
    target.x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    target.y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
    requestRender();
  }

  function motionChange() {
    reduced = reducedQuery.matches;
    canvas.style.transition = reduced ? 'none' : 'opacity .6s ease';
    if (reduced) {
      entryFinished = true;
      artMaterial.opacity = 1;
      frame.geometry.setDrawRange(0, border.length);
      current.x = 0;
      current.y = 0;
    }
    resetPointer();
  }

  function visibilityChange() {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else requestRender();
  }

  function dispose() {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    scene.traverse((object) => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material?.dispose());
    });
    texture?.dispose();
    renderer.dispose();
    canvas.remove();
    host.classList.remove('scene-ready');
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    canvas.style.opacity = '0';
    host.classList.remove('scene-ready');
  });
  host.addEventListener('pointermove', pointerMove, { passive: true });
  host.addEventListener('pointerleave', resetPointer, { passive: true });
  document.addEventListener('visibilitychange', visibilityChange);
  reducedQuery.addEventListener('change', motionChange);
  pointerQuery.addEventListener('change', resetPointer);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else requestRender();
    }, { rootMargin: '80px' });
    observer.observe(host);
  }
  window.addEventListener('pagehide', () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  });
  window.addEventListener('pageshow', requestRender);

  resize();
  // Render the finished texture once before claiming readiness. The gentle
  // frame reveal starts after this warm-up render, with all HTML usable.
  artMaterial.opacity = 1;
  renderer.render(scene, camera);
  host.classList.add('scene-ready');
  canvas.style.opacity = '1';
  if (!reduced) artMaterial.opacity = 0;
  start = performance.now();
  requestRender();
}
