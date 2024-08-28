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
let handsOn = 0;
const maxDistance = 0.03;
let shouldTakeScreenshot = true;
let thumbsUpHand;
let renderTarget;
let virtualCamera;
let screenshotPlane;

let screenshotPending = false;
const apiUrl = "http://localhost:8080/describe_image";

const testBtn = document.getElementById("test-btn");
testBtn.addEventListener("click", () => {
  takeScreenshot();
});

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

  // Reference grid
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  const grid = new THREE.GridHelper(4, 1, 0x111111, 0x111111);
  // scene.add(grid);

  // Screenshot plane
  const planeGeometry = new THREE.PlaneGeometry(0.8, 0.45);
  const planeMaterial = new THREE.MeshBasicMaterial({ map: null });
  screenshotPlane = new THREE.Mesh(planeGeometry, planeMaterial);
  screenshotPlane.visible = false;
  screenshotPlane.position.set(0, 1.5, -1);
  scene.add(screenshotPlane);

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
      optionalFeatures: ["hand-tracking"],
      // depthSensing: { usagePreference: ["gpu-optimized"], dataFormatPreference: [] },
    })
  );
  virtualCamera = new THREE.PerspectiveCamera(120, sizes.width / sizes.height, 0.01, 50);
  virtualCamera.position.set(0, 1.6, 0);
  renderTarget = new THREE.WebGLRenderTarget(sizes.width, sizes.height, { samples: 4, generateMipmaps: true });

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
  if (handsOn === 2) {
    handleHand(hand1);
    handleHand(hand2);

    if (shouldTakeScreenshot && (isThumbsUp(hand1) || isThumbsUp(hand2))) {
      takeScreenshot();
    }

    if (screenshotPending) {
      screenshotPending = false;
      takeScreenshot();
    }

    // if (!shouldTakeScreenshot) {
    //   if (!isThumbsUp(thumbsUpHand)) {
    //     shouldTakeScreenshot = true;
    //   }
    // }
  }

  // Render
  renderer.render(scene, camera);
}

function handleHand(hand) {
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
  handsOn++;
}

function isThumbsUp(hand) {
  const thumbPosition = hand.joints["thumb-phalanx-proximal"].position;
  const indexTipPosition = hand.joints["index-finger-tip"].position;

  const distance = thumbPosition.distanceTo(indexTipPosition);

  if (distance < maxDistance) {
    thumbsUpHand = hand;
    return true;
  }

  return false;
}

function takeScreenshot() {
  const xrCamera = renderer.xr.getCamera();

  xrCamera.getWorldPosition(virtualCamera.position);
  xrCamera.getWorldQuaternion(virtualCamera.quaternion);

  const marker= new THREE.Mesh(new THREE.SphereGeometry(0.01), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  scene.add(marker);
  marker.position.copy(virtualCamera.position);
  virtualCamera.fov = xrCamera.fov;
  virtualCamera.updateProjectionMatrix();
  virtualCamera.rotateX(Math.PI /4);
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, virtualCamera);
  renderer.setRenderTarget(null);
  shouldTakeScreenshot = false;

  console.log("Xr cam", xrCamera.position);
  console.log("Virtual cam", virtualCamera.position);

  screenshotPlane.material.map = renderTarget.texture;
  screenshotPlane.material.needsUpdate = true;
  screenshotPlane.visible = true;

  const canvas = document.createElement("canvas");
  canvas.width = renderTarget.width;
  canvas.height = renderTarget.height;
  const context = canvas.getContext("2d");

  const pixelBuffer = new Uint8Array(renderTarget.width * renderTarget.height * 4);
  renderer.readRenderTargetPixels(renderTarget, 0, 0, renderTarget.width, renderTarget.height, pixelBuffer);

  // Create an ImageData object and put the pixelBuffer into the canvas
  const imageData = new ImageData(new Uint8ClampedArray(pixelBuffer), renderTarget.width, renderTarget.height);
  context.putImageData(imageData, 0, 0);

  // 6. Convert the canvas to a base64 string
  const base64String = canvas.toDataURL();

  const image = base64String.replace("data:image/png;base64,", "");

  fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base64_image: image,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data.image_description);
    })
    .catch((error) => {
      console.error("Error sending data:", error);
    });
}

window.takeScreenshot = () => {
  screenshotPending = true;
};
