const canvas = document.querySelector("#scene");
const selectedLabel = document.querySelector("#selected");
const positionLabel = document.querySelector("#position");
const swapButton = document.querySelector("#swap");
const duplicateButton = document.querySelector("#duplicate");
const removeButton = document.querySelector("#remove");
const errorBox = document.querySelector("#error");

const CDN_CANDIDATES = [
  {
    name: "unpkg",
    three: "https://unpkg.com/three@0.159.0/build/three.min.js",
  },
  {
    name: "jsdelivr",
    three: "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js",
  },
];

const furnitureSpecs = {
  sofa: { size: [2.2, 1, 1], color: "#38bdf8" },
  table: { size: [1.6, 0.7, 1], color: "#f59e0b" },
  bed: { size: [2.4, 0.8, 1.6], color: "#f472b6" },
  shelf: { size: [1.2, 1.8, 0.6], color: "#a78bfa" },
};

const furniture = [];
let selected = null;
let swapMode = false;
let swapCandidate = null;
let mode = "fallback";
let pickHandler = null;
let updateRenderer = null;
let threeContext = null;

function showError(message) {
  errorBox.hidden = false;
  errorBox.textContent = message;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function loadThree() {
  if (window.THREE) {
    return { THREE: window.THREE };
  }
  for (const candidate of CDN_CANDIDATES) {
    try {
      await loadScript(candidate.three);
      if (window.THREE) {
        return { THREE: window.THREE };
      }
    } catch (error) {
      console.warn(`Failed to load Three.js from ${candidate.name}`, error);
    }
  }
  return null;
}

function isThreeMesh(item) {
  return Boolean(item && item.isMesh);
}

function setSelected(item) {
  if (selected === item) {
    return;
  }
  if (selected && isThreeMesh(selected)) {
    selected.material.emissive.set("#000000");
  }
  selected = item;
  if (selected && isThreeMesh(selected)) {
    selected.material.emissive.set("#1e40af");
  }
  updateStatus();
}

function updateStatus() {
  if (!selected) {
    selectedLabel.textContent = "なし";
    positionLabel.textContent = "-";
    return;
  }
  selectedLabel.textContent = selected.userData.type;
  const { x, z } = selected.position;
  positionLabel.textContent = `${x.toFixed(1)}, ${z.toFixed(1)}`;
}

function handleSwap(target) {
  if (!swapMode) {
    setSelected(target);
    return;
  }
  if (!swapCandidate) {
    swapCandidate = target;
    setSelected(target);
    swapButton.textContent = "入れ替えモード: 次を選択";
    return;
  }
  if (swapCandidate === target) {
    swapCandidate = null;
    swapButton.textContent = "入れ替えモード: OFF";
    swapMode = false;
    swapButton.classList.remove("active");
    return;
  }
  if (isThreeMesh(swapCandidate)) {
    const temp = swapCandidate.position.clone();
    swapCandidate.position.copy(target.position);
    target.position.copy(temp);
  } else {
    const temp = { ...swapCandidate.position };
    swapCandidate.position = { ...target.position };
    target.position = { ...temp };
  }
  swapCandidate = null;
  swapMode = false;
  swapButton.classList.remove("active");
  swapButton.textContent = "入れ替えモード: OFF";
  setSelected(target);
}

function moveSelected(dx, dz) {
  if (!selected) return;
  selected.position.x = clamp(selected.position.x + dx, -7, 7);
  selected.position.z = clamp(selected.position.z + dz, -7, 7);
  updateStatus();
}

function rotateSelected(delta) {
  if (!selected) return;
  selected.rotation.y += delta;
}

function duplicateSelected() {
  if (!selected) return;
  const clone = createFurniture(selected.userData.type, { ...selected.position });
  clone.position.x += 0.8;
  clone.position.z += 0.8;
  setSelected(clone);
}

function removeSelected() {
  if (!selected) return;
  if (isThreeMesh(selected)) {
    threeContext.scene.remove(selected);
  }
  const index = furniture.indexOf(selected);
  if (index >= 0) furniture.splice(index, 1);
  selected = null;
  updateStatus();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createFurniture(type, position = { x: 0, y: 0, z: 0 }) {
  const spec = furnitureSpecs[type];

  if (mode === "three") {
    const { THREE, scene } = threeContext;
    const geometry = new THREE.BoxGeometry(...spec.size);
    const material = new THREE.MeshStandardMaterial({ color: spec.color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.set(position.x, position.y ?? 0, position.z);
    mesh.position.y = spec.size[1] / 2;
    mesh.userData = { type, baseColor: spec.color, size: spec.size };
    scene.add(mesh);
    furniture.push(mesh);
    return mesh;
  }

  const item = {
    position: { x: position.x, y: spec.size[1] / 2, z: position.z },
    rotation: { y: 0 },
    userData: { type, baseColor: spec.color, size: spec.size },
  };
  furniture.push(item);
  return item;
}

function initDefault() {
  createFurniture("sofa", { x: -2, y: 0, z: -2 });
  createFurniture("table", { x: 0, y: 0, z: 1 });
  createFurniture("bed", { x: 3, y: 0, z: -1 });
}

function bindControls() {
  canvas.addEventListener("pointerdown", (event) => {
    if (pickHandler && event.button === 0) {
      pickHandler(event);
    }
  });

  document.querySelectorAll("button[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.add;
      const item = createFurniture(type, { x: 0, y: 0, z: 0 });
      setSelected(item);
    });
  });

  swapButton.addEventListener("click", () => {
    swapMode = !swapMode;
    swapCandidate = null;
    swapButton.classList.toggle("active", swapMode);
    swapButton.textContent = swapMode ? "入れ替えモード: ON" : "入れ替えモード: OFF";
  });

  duplicateButton.addEventListener("click", duplicateSelected);
  removeButton.addEventListener("click", removeSelected);

  window.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "ArrowUp":
      case "w":
      case "W":
        moveSelected(0, -0.4);
        break;
      case "ArrowDown":
      case "s":
      case "S":
        moveSelected(0, 0.4);
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        moveSelected(-0.4, 0);
        break;
      case "ArrowRight":
      case "d":
      case "D":
        moveSelected(0.4, 0);
        break;
      case "q":
      case "Q":
        rotateSelected(0.2);
        break;
      case "e":
      case "E":
        rotateSelected(-0.2);
        break;
      default:
        break;
    }
  });
}

function initThree({ THREE }) {
  mode = "three";

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0b1120");

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(8, 7, 10);

  const controls = {
    target: new THREE.Vector3(0, 1.2, 0),
    distance: 14,
    azimuth: Math.PI / 4,
    polar: Math.PI / 3,
    minPolar: 0.3,
    maxPolar: Math.PI / 2.1,
    minDistance: 6,
    maxDistance: 24,
    isDragging: false,
    lastX: 0,
    lastY: 0,
  };

  function updateCamera() {
    const sinPolar = Math.sin(controls.polar);
    const x = controls.distance * sinPolar * Math.cos(controls.azimuth);
    const z = controls.distance * sinPolar * Math.sin(controls.azimuth);
    const y = controls.distance * Math.cos(controls.polar);
    camera.position.set(
      controls.target.x + x,
      controls.target.y + y,
      controls.target.z + z
    );
    camera.lookAt(controls.target);
  }

  function clampControlValues() {
    controls.polar = clamp(controls.polar, controls.minPolar, controls.maxPolar);
    controls.distance = clamp(controls.distance, controls.minDistance, controls.maxDistance);
  }

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  const directional = new THREE.DirectionalLight(0xffffff, 0.6);
  directional.position.set(6, 10, 6);
  directional.castShadow = true;
  directional.shadow.mapSize.set(1024, 1024);
  directional.shadow.camera.near = 0.5;
  directional.shadow.camera.far = 30;
  directional.shadow.camera.left = -10;
  directional.shadow.camera.right = 10;
  directional.shadow.camera.top = 10;
  directional.shadow.camera.bottom = -10;

  const warmLight = new THREE.PointLight(0xfff4e5, 0.7, 25, 1.6);
  warmLight.position.set(-3, 4, 2);
  warmLight.castShadow = true;

  scene.add(ambient, directional, warmLight);

  const room = new THREE.Group();
  const roomSize = { width: 16, depth: 16, height: 5 };
  const wallThickness = 0.3;

  const floorMat = new THREE.MeshStandardMaterial({
    color: "#9aa5b1",
    roughness: 0.55,
    metalness: 0.05,
  });
  const floorGeo = new THREE.BoxGeometry(roomSize.width, 0.3, roomSize.depth);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  floor.position.y = -0.15;
  room.add(floor);

  const ceilingMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.95 });
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(roomSize.width, 0.2, roomSize.depth),
    ceilingMat
  );
  ceiling.position.y = roomSize.height;
  room.add(ceiling);

  const wallMat = new THREE.MeshStandardMaterial({
    color: "#e2e8f0",
    roughness: 0.85,
  });

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(roomSize.width, roomSize.height, wallThickness),
    wallMat
  );
  backWall.position.set(0, roomSize.height / 2, -roomSize.depth / 2);
  backWall.receiveShadow = true;

  const frontWall = new THREE.Mesh(
    new THREE.BoxGeometry(roomSize.width, roomSize.height, wallThickness),
    wallMat
  );
  frontWall.position.set(0, roomSize.height / 2, roomSize.depth / 2);
  frontWall.receiveShadow = true;

  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, roomSize.height, roomSize.depth),
    wallMat
  );
  leftWall.position.set(-roomSize.width / 2, roomSize.height / 2, 0);
  leftWall.receiveShadow = true;

  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, roomSize.height, roomSize.depth),
    wallMat
  );
  rightWall.position.set(roomSize.width / 2, roomSize.height / 2, 0);
  rightWall.receiveShadow = true;

  room.add(backWall, frontWall, leftWall, rightWall);

  const baseboardMat = new THREE.MeshStandardMaterial({ color: "#cbd5f5", roughness: 0.7 });
  const baseboardHeight = 0.22;
  const baseboardDepth = 0.08;
  const baseboard1 = new THREE.Mesh(
    new THREE.BoxGeometry(roomSize.width, baseboardHeight, baseboardDepth),
    baseboardMat
  );
  baseboard1.position.set(0, baseboardHeight / 2, -roomSize.depth / 2 + baseboardDepth);
  const baseboard2 = baseboard1.clone();
  baseboard2.position.set(0, baseboardHeight / 2, roomSize.depth / 2 - baseboardDepth);
  const baseboard3 = new THREE.Mesh(
    new THREE.BoxGeometry(baseboardDepth, baseboardHeight, roomSize.depth),
    baseboardMat
  );
  baseboard3.position.set(-roomSize.width / 2 + baseboardDepth, baseboardHeight / 2, 0);
  const baseboard4 = baseboard3.clone();
  baseboard4.position.set(roomSize.width / 2 - baseboardDepth, baseboardHeight / 2, 0);
  room.add(baseboard1, baseboard2, baseboard3, baseboard4);

  const windowFrameMat = new THREE.MeshStandardMaterial({
    color: "#64748b",
    roughness: 0.6,
    metalness: 0.1,
  });
  const windowGlassMat = new THREE.MeshStandardMaterial({
    color: "#93c5fd",
    transparent: true,
    opacity: 0.35,
    roughness: 0.2,
  });
  const windowGroup = new THREE.Group();
  const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 0.2), windowFrameMat);
  const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2, 0.05), windowGlassMat);
  windowGlass.position.z = 0.08;
  windowGroup.add(windowFrame, windowGlass);
  windowGroup.position.set(-3, 2.7, -roomSize.depth / 2 + 0.2);
  room.add(windowGroup);

  const doorMat = new THREE.MeshStandardMaterial({ color: "#a16207", roughness: 0.65 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3, 0.15), doorMat);
  door.position.set(5.6, 1.5, roomSize.depth / 2 - 0.2);
  room.add(door);

  const rugMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.9 });
  const rug = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.05, 3), rugMat);
  rug.position.set(0, 0.03, 0.6);
  rug.receiveShadow = true;
  room.add(rug);

  const lampBaseMat = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.4 });
  const lampShadeMat = new THREE.MeshStandardMaterial({ color: "#fef3c7", roughness: 0.7 });
  const lamp = new THREE.Group();
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3), lampBaseMat);
  lampPole.position.y = 1.5;
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.9, 24), lampShadeMat);
  lampShade.position.y = 3.2;
  lamp.add(lampPole, lampShade);
  lamp.position.set(-5, 0, 4.5);
  lamp.castShadow = true;
  room.add(lamp);

  room.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  scene.add(room);

  const grid = new THREE.GridHelper(16, 16, "#cbd5f5", "#e2e8f0");
  grid.position.y = 0.01;
  grid.material.opacity = 0.25;
  grid.material.transparent = true;
  scene.add(grid);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  pickHandler = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(furniture);
    if (hits.length) {
      handleSwap(hits[0].object);
    } else {
      setSelected(null);
    }
  };

  renderer.domElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (event.button !== 2) return;
    controls.isDragging = true;
    controls.lastX = event.clientX;
    controls.lastY = event.clientY;
  });

  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!controls.isDragging) return;
    const deltaX = event.clientX - controls.lastX;
    const deltaY = event.clientY - controls.lastY;
    controls.lastX = event.clientX;
    controls.lastY = event.clientY;
    controls.azimuth -= deltaX * 0.005;
    controls.polar += deltaY * 0.005;
    clampControlValues();
  });

  window.addEventListener("pointerup", () => {
    controls.isDragging = false;
  });

  renderer.domElement.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      controls.distance += event.deltaY * 0.01;
      clampControlValues();
    },
    { passive: false }
  );

  updateRenderer = () => {
    updateCamera();
    renderer.render(scene, camera);
  };

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  threeContext = { THREE, scene };
  initDefault();
  updateStatus();

  function animate() {
    updateRenderer();
    requestAnimationFrame(animate);
  }

  animate();
}

function initFallback() {
  mode = "fallback";
  showError("3Dライブラリを読み込めなかったため、簡易表示モードで動作しています。");

  const ctx = canvas.getContext("2d");
  const state = {
    scale: 32,
    centerX: window.innerWidth / 2,
    centerY: window.innerHeight / 2 + 120,
  };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * ratio;
    canvas.height = window.innerHeight * ratio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    state.centerX = window.innerWidth / 2;
    state.centerY = window.innerHeight / 2 + 120;
  }

  function project(point) {
    const isoX = (point.x - point.z) * state.scale + state.centerX;
    const isoY = (point.x + point.z) * state.scale * 0.5 - point.y * state.scale + state.centerY;
    return { x: isoX, y: isoY };
  }

  function rotatePoint(x, z, rotation) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return { x: x * cos - z * sin, z: x * sin + z * cos };
  }

  function getBoxPoints(item) {
    const [width, height, depth] = item.userData.size;
    const halfW = width / 2;
    const halfD = depth / 2;
    const topY = height;
    const corners = [
      { x: -halfW, z: -halfD },
      { x: halfW, z: -halfD },
      { x: halfW, z: halfD },
      { x: -halfW, z: halfD },
    ].map((corner) => {
      const rotated = rotatePoint(corner.x, corner.z, item.rotation.y);
      return {
        x: rotated.x + item.position.x,
        z: rotated.z + item.position.z,
      };
    });

    const top = corners.map((corner) => project({ x: corner.x, y: topY, z: corner.z }));
    const bottom = corners.map((corner) => project({ x: corner.x, y: 0, z: corner.z }));

    return { top, bottom };
  }

  function drawPolygon(points, fillStyle, strokeStyle = "#0f172a") {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
  }

  function shadeColor(hex, amount) {
    const value = hex.replace("#", "");
    const r = parseInt(value.substring(0, 2), 16);
    const g = parseInt(value.substring(2, 4), 16);
    const b = parseInt(value.substring(4, 6), 16);
    const shade = (channel) => clamp(Math.round(channel * amount), 0, 255);
    return `rgb(${shade(r)}, ${shade(g)}, ${shade(b)})`;
  }

  function drawFloor() {
    ctx.strokeStyle = "#1e293b";
    for (let i = -8; i <= 8; i += 1) {
      const start = project({ x: -8, y: 0, z: i });
      const end = project({ x: 8, y: 0, z: i });
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      const startZ = project({ x: i, y: 0, z: -8 });
      const endZ = project({ x: i, y: 0, z: 8 });
      ctx.beginPath();
      ctx.moveTo(startZ.x, startZ.y);
      ctx.lineTo(endZ.x, endZ.y);
      ctx.stroke();
    }
  }

  function drawFurniture() {
    const sorted = [...furniture].sort(
      (a, b) => a.position.x + a.position.z - (b.position.x + b.position.z)
    );

    sorted.forEach((item) => {
      const { top, bottom } = getBoxPoints(item);
      const left = [bottom[0], bottom[3], top[3], top[0]];
      const right = [bottom[1], bottom[2], top[2], top[1]];
      const topFace = top;
      const baseColor = item.userData.baseColor;

      drawPolygon(left, shadeColor(baseColor, 0.7));
      drawPolygon(right, shadeColor(baseColor, 0.85));
      drawPolygon(topFace, shadeColor(baseColor, 1));

      if (item === selected) {
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        drawPolygon(topFace, "rgba(56, 189, 248, 0.2)", "#38bdf8");
        ctx.lineWidth = 1;
      }
    });
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0b1120";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawFloor();
    drawFurniture();
  }

  pickHandler = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const sorted = [...furniture].sort(
      (a, b) => b.position.x + b.position.z - (a.position.x + a.position.z)
    );

    for (const item of sorted) {
      const { top } = getBoxPoints(item);
      const bounds = top.reduce(
        (acc, point) => {
          acc.minX = Math.min(acc.minX, point.x);
          acc.maxX = Math.max(acc.maxX, point.x);
          acc.minY = Math.min(acc.minY, point.y);
          acc.maxY = Math.max(acc.maxY, point.y);
          return acc;
        },
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
      );

      if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
        handleSwap(item);
        return;
      }
    }

    setSelected(null);
  };

  updateRenderer = render;

  window.addEventListener("resize", resize);
  resize();
  initDefault();
  updateStatus();

  function animate() {
    render();
    requestAnimationFrame(animate);
  }

  animate();
}

function init() {
  bindControls();
  loadThree().then((result) => {
    if (result) {
      initThree(result);
    } else {
      initFallback();
    }
  });
}

init();
