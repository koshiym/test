import * as THREE from "https://unpkg.com/three@0.159.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.159.0/examples/jsm/controls/OrbitControls.js";

const canvas = document.querySelector("#scene");
const selectedLabel = document.querySelector("#selected");
const positionLabel = document.querySelector("#position");
const swapButton = document.querySelector("#swap");
const duplicateButton = document.querySelector("#duplicate");
const removeButton = document.querySelector("#remove");

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

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function createFurniture(type, position = new THREE.Vector3()) {
  const spec = furnitureSpecs[type];
  const geometry = new THREE.BoxGeometry(...spec.size);
  const material = new THREE.MeshStandardMaterial({ color: spec.color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.position.copy(position);
  mesh.position.y = spec.size[1] / 2;
  mesh.userData = { type, baseColor: spec.color };
  scene.add(mesh);
  furniture.push(mesh);
  return mesh;
}

function setSelected(item) {
  if (selected === item) {
    return;
  }
  if (selected) {
    selected.material.emissive.set("#000000");
  }
  selected = item;
  if (selected) {
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
  const temp = swapCandidate.position.clone();
  swapCandidate.position.copy(target.position);
  target.position.copy(temp);
  swapCandidate = null;
  swapMode = false;
  swapButton.classList.remove("active");
  swapButton.textContent = "入れ替えモード: OFF";
  setSelected(target);
}

function pickObject(event) {
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
}

function moveSelected(dx, dz) {
  if (!selected) return;
  selected.position.x = THREE.MathUtils.clamp(selected.position.x + dx, -7, 7);
  selected.position.z = THREE.MathUtils.clamp(selected.position.z + dz, -7, 7);
  updateStatus();
}

function rotateSelected(delta) {
  if (!selected) return;
  selected.rotation.y += delta;
}

function duplicateSelected() {
  if (!selected) return;
  const clone = createFurniture(selected.userData.type, selected.position.clone());
  clone.position.x += 0.8;
  clone.position.z += 0.8;
  setSelected(clone);
}

function removeSelected() {
  if (!selected) return;
  scene.remove(selected);
  const index = furniture.indexOf(selected);
  if (index >= 0) furniture.splice(index, 1);
  selected = null;
  updateStatus();
}

function initDefault() {
  createFurniture("sofa", new THREE.Vector3(-2, 0, -2));
  createFurniture("table", new THREE.Vector3(0, 0, 1));
  createFurniture("bed", new THREE.Vector3(3, 0, -1));
}

initDefault();
updateStatus();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.domElement.addEventListener("pointerdown", pickObject);

document.querySelectorAll("button[data-add]").forEach((button) => {
  button.addEventListener("click", () => {
    const type = button.dataset.add;
    const mesh = createFurniture(type, new THREE.Vector3(0, 0, 0));
    setSelected(mesh);
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

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
