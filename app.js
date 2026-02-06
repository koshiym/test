const canvas = document.querySelector("#scene");
const selectedLabel = document.querySelector("#selected");
const positionLabel = document.querySelector("#position");
const swapButton = document.querySelector("#swap");
const duplicateButton = document.querySelector("#duplicate");
const removeButton = document.querySelector("#remove");
const errorBox = document.querySelector("#error");

const MODULE_CANDIDATES = [
  "https://unpkg.com/three@0.159.0",
  "https://cdn.jsdelivr.net/npm/three@0.159.0",
  "https://esm.sh/three@0.159.0",
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
let fallbackContext = null;

function showError(message) {
  errorBox.hidden = false;
  errorBox.textContent = message;
}

function loadFromBase(baseUrl) {
  if (baseUrl.includes("esm.sh")) {
    return Promise.all([
      import(`${baseUrl}`),
      import(`${baseUrl}/examples/jsm/controls/OrbitControls.js`),
    ]).then(([THREE, controls]) => ({ THREE, OrbitControls: controls.OrbitControls }));
  }

  return Promise.all([
    import(`${baseUrl}/build/three.module.js`),
    import(`${baseUrl}/examples/jsm/controls/OrbitControls.js`),
  ]).then(([THREE, controls]) => ({ THREE, OrbitControls: controls.OrbitControls }));
}

function loadThree() {
  return Promise.any(MODULE_CANDIDATES.map((baseUrl) => loadFromBase(baseUrl)));
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
    if (pickHandler) {
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

function initThree({ THREE, OrbitControls }) {
  mode = "three";

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0b1120");

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(8, 7, 10);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.target.set(0, 0.5, 0);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(5, 10, 4);
  scene.add(ambient, directional);

  const floorGeo = new THREE.PlaneGeometry(16, 16);
  const floorMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.8 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const grid = new THREE.GridHelper(16, 16, "#334155", "#1e293b");
  scene.add(grid);

  const walls = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: "#0f172a", side: THREE.DoubleSide });
  const wallGeo = new THREE.PlaneGeometry(16, 4);
  const backWall = new THREE.Mesh(wallGeo, wallMat);
  backWall.position.set(0, 2, -8);
  const sideWall = new THREE.Mesh(wallGeo, wallMat);
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(-8, 2, 0);
  const sideWall2 = new THREE.Mesh(wallGeo, wallMat);
  sideWall2.rotation.y = -Math.PI / 2;
  sideWall2.position.set(8, 2, 0);
  walls.add(backWall, sideWall, sideWall2);
  scene.add(walls);

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

  updateRenderer = () => {
    controls.update();
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
  fallbackContext = { ctx, state };

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
  loadThree()
    .then((result) => {
      initThree(result);
    })
    .catch(() => {
      initFallback();
    });
}

init();
