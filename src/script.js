import * as THREE from "three";
import { TubePainter } from "three/examples/jsm/misc/TubePainter.js";
import { XRButton } from "three/examples/jsm/webxr/XRButton.js";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "three/examples/jsm/webxr/XRHandModelFactory.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

let camera, scene, renderer;
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let hand1, hand2;
let painter1, painter2;
let handsOn = false;

const cursor = new THREE.Vector3();

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

init();

function init() {
  const canvas = document.querySelector("canvas.webgl");
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 50);
  camera.position.set(0, 1.6, 0);

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  const grid = new THREE.GridHelper(4, 1, 0x111111, 0x111111);
  scene.add(grid);

  scene.add(new THREE.HemisphereLight(0x888877, 0x777788, 3));

  const light = new THREE.DirectionalLight(0xffffff, 1.5);
  light.position.set(0, 4, 0);
  scene.add(light);

  const material = new THREE.MeshNormalMaterial({
    flatShading: true,
    side: THREE.DoubleSide,
  });

  painter1 = new TubePainter();
  painter1.mesh.material = material;
  painter1.setSize(0.3);

  painter2 = new TubePainter();
  painter2.mesh.material = material;
  painter2.setSize(0.3);

  scene.add(painter1.mesh);
  scene.add(painter2.mesh);

  renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setPixelRatio(window.devicePixelRatio, 2);
  renderer.setSize(sizes.width, sizes.height);
  renderer.setAnimationLoop(animate);
  renderer.xr.enabled = true;
  document.body.appendChild(
    XRButton.createButton(renderer, {
      optionalFeatures: ["hand-tracking", "depth-sensing"],
      depthSensing: { usagePreference: ["gpu-optimized"], dataFormatPreference: [] },
    })
  );

  const controllerModelFactory = new XRControllerModelFactory();
  // Controllers
  controller1 = renderer.xr.getController(0);
  controller1.addEventListener("connected", onControllerConnected);
  scene.add(controller1);

  controller2 = renderer.xr.getController(1);
  controller2.addEventListener("connected", onControllerConnected);
  scene.add(controller2);

  const handModelFactory = new XRHandModelFactory();

  // Hand1
  controllerGrip1 = renderer.xr.getControllerGrip(0);
  controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
  scene.add(controllerGrip1);

  hand1 = renderer.xr.getHand(0);
  // hand1.add(handModelFactory.createHandModel(hand1, "mesh"));
  hand1.addEventListener("pinchstart", onPinchStart);
  hand1.addEventListener("pinchend", onPinchEnd);
  hand1.userData.painter = painter1;
  scene.add(hand1);

  // Hand2
  controllerGrip2 = renderer.xr.getControllerGrip(1);
  controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
  scene.add(controllerGrip2);

  hand2 = renderer.xr.getHand(1);
  // hand2.add(handModelFactory.createHandModel(hand2, "mesh"));
  hand2.addEventListener("pinchstart", onPinchStart);
  hand2.addEventListener("pinchend", onPinchEnd);
  hand2.userData.painter = painter2;
  scene.add(hand2);
}

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

function animate() {
  handleHand(hand1);
  handleHand(hand2);

  // Render
  renderer.render(scene, camera);
}

function handleHand(hand) {
  if (handsOn === false) return;

  hand.updateMatrixWorld(true);

  const userData = hand.userData;
  const painter = userData.painter;

  const indexTip = hand.joints["index-finger-tip"];

  cursor.setFromMatrixPosition(indexTip.matrixWorld);

  if (userData.isDrawing === true) {
    painter.lineTo(cursor);
    painter.update();
  }
}

function onPinchStart(e) {
  this.updateMatrixWorld(true);

  const controller = e.target;
  const indexTip = controller.joints["index-finger-tip"];
  cursor.setFromMatrixPosition(indexTip.matrixWorld);
  this.userData.painter.moveTo(cursor);
  this.userData.isDrawing = true;
}
function onPinchEnd(e) {
  this.userData.isDrawing = false;
}

function onControllerConnected(e) {
  handsOn = true;
}
