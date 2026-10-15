/**
 * Optional homepage enhancement. Three.js r169 / npm 0.169.0 is vendored locally.
 * The real image and the HTML fallback remain the source of essential content.
 */
const host = document.querySelector('#sketchbook-scene');
let cleanUpEnhancement = () => {};
let applyProgress = () => {};
let initializing = null;
let unavailableReported = false;
const clamp = (value) => Math.min(1, Math.max(0, Number(value) || 0));
let latestProgress = clamp(host?.dataset.scrollProgress);

function unavailable(reason) {
  host?.classList.remove('scene-ready');
  if (!unavailableReported) {
    unavailableReported = true;
    window.dispatchEvent(new CustomEvent('artofy:hero-unavailable', { detail: { reason } }));
  }
}

function initialize() {
  if (!host || initializing || host.classList.contains('scene-ready')) return;
  unavailableReported = false;
  initializing = enhanceSketchbook().catch(() => {
    cleanUpEnhancement();
    unavailable('initialization');
  }).finally(() => { initializing = null; });
}

if (host) {
  // The scroll module owns scroll timing; this module alone owns WebGL rendering.
  window.addEventListener('artofy:hero-progress', (event) => {
    latestProgress = clamp(event.detail?.progress);
    applyProgress();
  });
  // A cached page keeps its one scene. A lost/disposed scene can initialize once
  // on return, with its previous instance listeners removed by dispose().
  window.addEventListener('pageshow', initialize);
  initialize();
}

async function enhanceSketchbook() {
  const THREE = await import('../vendor/three.module.js');
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  const desktopQuery = window.matchMedia('(min-width: 768px)');
  let reduced = reducedQuery.matches;
  let narrow = !desktopQuery.matches;
  let stopped = false;
  let raf = 0;
  let visible = true;
  let suspended = false;
  let resizeObserver;
  let intersectionObserver;
  const listeners = new AbortController();
  const textures = new Set();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !narrow, powerPreference: 'low-power' });
  } catch {
    unavailable('webgl');
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
  cleanUpEnhancement = dispose;
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

  async function loadArtwork(filename) {
    const result = await new THREE.TextureLoader().loadAsync(new URL(`../images/${filename}`, import.meta.url).href);
    if (stopped) {
      result.dispose();
      throw new Error('Scene disposed while loading');
    }
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), narrow ? 2 : 4);
    textures.add(result);
    return result;
  }

  // Compact derivatives retain the complete composition and original colors.
  let texture;
  try {
    texture = await loadArtwork('fantasy-battle-1024.webp');
  } catch {
    dispose('texture');
    return;
  }
  const artBounds = (map, x = 1.65, z = -0.05) => {
    const ratio = map.image.width / map.image.height;
    const width = Math.min(2.58, 3.34 * ratio);
    const depth = width / ratio;
    return { x0: x - width / 2, x1: x + width / 2, z0: z - depth / 2, z1: z + depth / 2 };
  };
  const pictureMaterial = (map) => new THREE.MeshBasicMaterial({ map, toneMapped: false });
  const artMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true, opacity: reduced ? 1 : 0 });
  const initialBounds = artBounds(texture);
  const originalArt = curvedSheet(initialBounds.x0, initialBounds.x1, initialBounds.z0, initialBounds.z1, artMaterial, 0.013, narrow ? 10 : 22);

  function framePoints(bounds) {
    const { x0, x1, z0, z1 } = bounds;
    const corners = [[x0 - 0.07,z0 - 0.07],[x1 + 0.07,z0 - 0.07],[x1 + 0.07,z1 + 0.07],[x0 - 0.07,z1 + 0.07],[x0 - 0.07,z0 - 0.07]];
    const points = [];
    for (let edge = 0; edge < 4; edge += 1) {
      for (let step = 0; step < 24; step += 1) {
        const t = step / 24;
        points.push([corners[edge][0] + (corners[edge + 1][0] - corners[edge][0]) * t, corners[edge][1] + (corners[edge + 1][1] - corners[edge][1]) * t]);
      }
    }
    points.push(corners[4]);
    return points;
  }

  const border = framePoints(initialBounds);
  const frame = inkPath(border, graphite, 0.024);
  frame.geometry.setDrawRange(0, reduced ? border.length : 0);
  let turnGroup;
  let turnFrontFrame;
  let underArt;
  let underFrame;
  let liftedSheet;
  let secondaryLoading;
  const bendGeometries = [];
  let lastTurnAngle = NaN;
  let lastAdvanced;
  let start = performance.now();
  let entryFinished = reduced;
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  const baseRotation = -0.025;
  desk.rotation.z = baseRotation;

  function bendable(geometry) {
    geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
    bendGeometries.push({ geometry, base: Float32Array.from(geometry.getAttribute('position').array) });
    return geometry;
  }

  function turningPicture(bounds, material, back = false) {
    const segments = 28;
    const positions = [];
    const uv = [];
    const indices = [];
    for (let row = 0; row <= segments; row += 1) {
      for (let column = 0; column <= segments; column += 1) {
        positions.push(bounds.x0 + (bounds.x1 - bounds.x0) * column / segments, back ? -0.019 : 0.019, bounds.z0 + (bounds.z1 - bounds.z0) * row / segments);
        // After the page rotates left, reverse backside U to keep art readable.
        uv.push(back ? 1 - column / segments : column / segments, 1 - row / segments);
        if (row < segments && column < segments) {
          const a = row * (segments + 1) + column;
          const b = a + 1;
          const c = a + segments + 1;
          const d = c + 1;
          indices.push(...(back ? [a,b,c,b,d,c] : [a,c,b,b,c,d]));
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(bendable(geometry), material);
    turnGroup.add(mesh);
  }

  function turningFrame(bounds, back = false) {
    const points = framePoints(bounds).map(([x,z]) => new THREE.Vector3(x, back ? -0.024 : 0.024, z));
    const line = new THREE.Line(bendable(new THREE.BufferGeometry().setFromPoints(points)), graphite);
    turnGroup.add(line);
    return line;
  }

  async function ensureAdvancedScene() {
    if (turnGroup || stopped) return;
    if (secondaryLoading) return secondaryLoading;
    secondaryLoading = (async () => {
      try {
        const [character, warrior, knight] = await Promise.all([
          loadArtwork('character-illustration-800.webp'),
          loadArtwork('fantasy-warrior-800.webp'),
          loadArtwork('anime-knight-800.webp'),
        ]);
        if (stopped) return;
        const revealedBounds = artBounds(character);
        underArt = curvedSheet(revealedBounds.x0, revealedBounds.x1, revealedBounds.z0, revealedBounds.z1, pictureMaterial(character), 0.013);
        underFrame = inkPath(framePoints(revealedBounds), graphite, 0.024);
        turnGroup = new THREE.Group();
        // The actual hinge is the book spine, not the center of a flat image.
        turnGroup.position.set(0, 0.30, 0);
        book.add(turnGroup);
        const thickPage = new THREE.BoxGeometry(3.135, 0.028, 4.34, 32, 1, 22);
        thickPage.translate(1.6125, 0, 0);
        const sheet = new THREE.Mesh(bendable(thickPage), paper);
        sheet.castShadow = true;
        sheet.receiveShadow = true;
        turnGroup.add(sheet);
        turningPicture(initialBounds, artMaterial);
        turningPicture(artBounds(warrior), pictureMaterial(warrior), true);
        turnFrontFrame = turningFrame(initialBounds);
        turnFrontFrame.geometry.setDrawRange(0, entryFinished ? border.length : 0);
        turningFrame(artBounds(warrior), true);

        // A separate art sheet starts tucked behind the spread. It rises as the
        // final chapter opens; the image stays on a real two-sided paper slab.
        liftedSheet = new THREE.Group();
        desk.add(liftedSheet);
        block(2.13, 0.035, 2.85, paper, 0, 0, 0, liftedSheet);
        const knightRatio = knight.image.width / knight.image.height;
        const knightWidth = Math.min(1.83, 2.55 * knightRatio);
        const knightDepth = knightWidth / knightRatio;
        const loosePicture = new THREE.Mesh(new THREE.PlaneGeometry(knightWidth, knightDepth), pictureMaterial(knight));
        loosePicture.rotation.x = -Math.PI / 2;
        loosePicture.position.y = 0.020;
        liftedSheet.add(loosePicture);
        const looseOutline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.13, 0.035, 2.85)), faintGraphite);
        liftedSheet.add(looseOutline);
        lastAdvanced = undefined;
        requestRender();
      } catch {
        if (!stopped) dispose('texture');
      }
    })();
    return secondaryLoading;
  }

  const smooth = (value) => value * value * (3 - 2 * value);
  function applySceneProgress() {
    const advanced = desktopQuery.matches && !reduced && Boolean(turnGroup);
    const progress = advanced ? latestProgress : 0;
    if (lastAdvanced !== advanced) {
      originalArt.visible = !advanced;
      frame.visible = !advanced;
      if (turnGroup) turnGroup.visible = advanced;
      if (underArt) underArt.visible = advanced;
      if (underFrame) underFrame.visible = advanced;
      if (liftedSheet) liftedSheet.visible = advanced;
      lastAdvanced = advanced;
      lastTurnAngle = NaN;
    }
    const approach = smooth(clamp(progress / 0.25));
    const turn = smooth(clamp((progress - 0.25) / 0.40));
    const lift = smooth(clamp((progress - 0.65) / 0.35));
    const angle = turn * Math.PI;
    if (advanced && angle !== lastTurnAngle) {
      turnGroup.rotation.z = angle;
      const wave = Math.sin(angle);
      const fold = Math.cos(angle);
      for (const { geometry, base } of bendGeometries) {
        const position = geometry.getAttribute('position');
        for (let vertex = 0; vertex < position.count; vertex += 1) {
          const x = base[vertex * 3];
          const offset = base[vertex * 3 + 1];
          const z = base[vertex * 3 + 2];
          const t = clamp(x / 3.18);
          // Nonlinear deformation curls the free edge as the physical slab
          // rotates. Both faces and all thickness edges share this surface.
          const curl = wave * (0.47 * Math.sin(t * Math.PI) + 0.17 * t * t + 0.065 * Math.sin(z * 1.4) * t * t);
          const height = (pageHeight(x,z) + 0.026 - 0.30) * fold + curl + offset;
          position.setXYZ(vertex, x, height, z);
        }
        position.needsUpdate = true;
        if (geometry.index) geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
      }
      lastTurnAngle = angle;
    }
    if (liftedSheet) {
      liftedSheet.position.set(-1.78 - lift * 0.22, -0.015 + lift * 1.35, -1.86 - lift * 0.30);
      liftedSheet.rotation.set(lift * 0.16, -0.24 - lift * 0.05, -0.06 - lift * 0.10);
    }
    const fit = Math.max(1, 1.12 / camera.aspect);
    const turnRoom = advanced ? Math.sin(angle) * 0.85 : 0;
    camera.position.set(0.35 + approach * 0.8 - lift * 0.45, (8.5 - approach * 0.9 + turnRoom + lift * 1.1) * fit, (7.65 - approach * 1.0 + turnRoom + lift * 0.9) * fit);
    camera.lookAt(0.04, 0.1 + (advanced ? Math.sin(angle) * 0.32 : 0) + lift * 0.28, 0.1 - lift * 0.12);
  }

  function resize() {
    if (stopped) return;
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    narrow = !desktopQuery.matches;
    const density = Math.min(window.devicePixelRatio || 1, narrow ? 1.35 : 1.75, Math.sqrt(1400000 / (width * height)));
    renderer.setPixelRatio(density);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  }

  function requestRender() {
    if (!raf && !stopped && !suspended && visible && !document.hidden) raf = requestAnimationFrame(render);
  }

  function render(now) {
    raf = 0;
    if (stopped || suspended || !visible || document.hidden) return;
    const movement = desktopQuery.matches && !reduced && pointerQuery.matches;
    current.x += ((movement ? target.x : 0) - current.x) * 0.075;
    current.y += ((movement ? target.y : 0) - current.y) * 0.075;
    desk.rotation.x = current.y * 0.035;
    desk.rotation.y = current.x * 0.055;
    desk.rotation.z = baseRotation + current.x * 0.012;
    if (!entryFinished) {
      const progress = latestProgress > 0.01 && desktopQuery.matches ? 1 : Math.min(1, (now - start) / 1150);
      const drawn = Math.ceil(border.length * Math.min(1, progress * 1.6));
      frame.geometry.setDrawRange(0, drawn);
      turnFrontFrame?.geometry.setDrawRange(0, drawn);
      artMaterial.opacity = Math.min(1, Math.max(0, (progress - 0.15) / 0.7));
      if (progress === 1) entryFinished = true;
    }
    applySceneProgress();
    try {
      renderer.render(scene, camera);
    } catch {
      dispose('render');
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
    if (reduced || !desktopQuery.matches || !pointerQuery.matches) return;
    const bounds = host.getBoundingClientRect();
    target.x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    target.y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
    requestRender();
  }

  function motionChange() {
    reduced = reducedQuery.matches;
    canvas.style.transition = reduced ? 'none' : 'opacity .6s ease';
    if (reduced || !desktopQuery.matches) {
      entryFinished = true;
      artMaterial.opacity = 1;
      frame.geometry.setDrawRange(0, border.length);
      turnFrontFrame?.geometry.setDrawRange(0, border.length);
      current.x = 0;
      current.y = 0;
    } else ensureAdvancedScene();
    resetPointer();
    resize();
  }

  function visibilityChange() {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else requestRender();
  }

  function dispose(reason = 'initialization') {
    if (stopped) return;
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    listeners.abort();
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    applyProgress = () => {};
    const geometries = new Set();
    const materials = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.forEach((material) => { if (material) materials.add(material); });
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((map) => map.dispose());
    textures.clear();
    renderer.dispose();
    canvas.remove();
    unavailable(reason);
  }

  const passive = { passive: true, signal: listeners.signal };
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    dispose('context-lost');
  }, { signal: listeners.signal });
  host.addEventListener('pointermove', pointerMove, passive);
  host.addEventListener('pointerleave', resetPointer, passive);
  document.addEventListener('visibilitychange', visibilityChange, { signal: listeners.signal });
  reducedQuery.addEventListener('change', motionChange, { signal: listeners.signal });
  desktopQuery.addEventListener('change', motionChange, { signal: listeners.signal });
  pointerQuery.addEventListener('change', resetPointer, { signal: listeners.signal });
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  if ('IntersectionObserver' in window) {
    intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else requestRender();
    }, { rootMargin: '80px' });
    intersectionObserver.observe(host);
  }
  window.addEventListener('pagehide', (event) => {
    suspended = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (!event.persisted) dispose('page-exit');
  }, { signal: listeners.signal });
  window.addEventListener('pageshow', () => {
    suspended = false;
    latestProgress = clamp(host.dataset.scrollProgress ?? latestProgress);
    requestRender();
  }, { signal: listeners.signal });

  if (desktopQuery.matches && !reduced) await ensureAdvancedScene();
  if (stopped) return;
  latestProgress = clamp(host.dataset.scrollProgress ?? latestProgress);
  applyProgress = requestRender;
  resize();
  applySceneProgress();
  // Warm-render the fully loaded art before announcing the optional pin scene.
  artMaterial.opacity = 1;
  renderer.render(scene, camera);
  host.classList.add('scene-ready');
  canvas.style.opacity = '1';
  if (!reduced && latestProgress < 0.01) artMaterial.opacity = 0;
  start = performance.now();
  window.dispatchEvent(new CustomEvent('artofy:hero-ready'));
  requestRender();
}
