import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const NODE_COLORS = {
  PERSON: "#d6b25e",
  EXPERIENCE: "#68a5d2",
  FACT: "#e08a65",
};

export function createCommitGraph(container, payload, theme, onSelect, onHover) {
  const width = Math.max(container.clientWidth, 320);
  const height = Math.max(container.clientHeight, 360);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.textBackgroundColor);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(13, 11, 20);
  camera.lookAt(0, 0, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = "none";

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 5);
  controls.enableDamping = false;
  controls.enablePan = true;
  controls.minDistance = 4;
  controls.maxDistance = 80;
  controls.update();

  scene.add(new THREE.AmbientLight(theme.textColor, 1.5));
  const keyLight = new THREE.DirectionalLight(theme.mainColor, 2);
  keyLight.position.set(8, 12, 10);
  scene.add(keyLight);

  const grid = new THREE.GridHelper(32, 16, theme.secondaryColor, theme.borderColor);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);

  payload.lines3d.forEach((line) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...line.from),
      new THREE.Vector3(...line.to),
    ]);
    scene.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: line.lineType === "BRANCH" ? theme.secondaryColor : theme.mainColor })));
  });

  const nodes = payload.nodes3d.map((node) => {
    const geometry = node.entityType === "FACT" ? new THREE.SphereGeometry(0.38, 20, 16) : new THREE.BoxGeometry(0.58, 0.58, 0.58);
    const material = new THREE.MeshStandardMaterial({ color: NODE_COLORS[node.entityType] || theme.mainColor, roughness: 0.45, metalness: 0.15 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(node.x, node.y, node.z);
    mesh.userData = node;
    scene.add(mesh);
    return mesh;
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let lastHoverAt = 0;
  const pointerPosition = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };
  const intersectNode = (event) => {
    pointerPosition(event);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(nodes)[0]?.object.userData;
  };
  const handleMove = (event) => {
    if (performance.now() - lastHoverAt < 100) return;
    lastHoverAt = performance.now();
    onHover(intersectNode(event) || null, event);
  };
  const handleClick = (event) => {
    const node = intersectNode(event);
    if (node) onSelect(node);
  };
  renderer.domElement.addEventListener("pointermove", handleMove);
  renderer.domElement.addEventListener("click", handleClick);

  const resize = () => {
    const nextWidth = Math.max(container.clientWidth, 320);
    const nextHeight = Math.max(container.clientHeight, 360);
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight);
    renderer.render(scene, camera);
  };
  window.addEventListener("resize", resize);
  controls.addEventListener("change", () => renderer.render(scene, camera));
  renderer.render(scene, camera);

  return () => {
    window.removeEventListener("resize", resize);
    renderer.domElement.removeEventListener("pointermove", handleMove);
    renderer.domElement.removeEventListener("click", handleClick);
    controls.dispose();
    nodes.forEach((node) => { node.geometry.dispose(); node.material.dispose(); });
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };
}