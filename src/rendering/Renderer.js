import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import {
  BACKGROUND_COLORS,
  COLOR_TRANSITION_SPEED,
  BLOOM_PARAMS,
  CAMERA_Y,
  CAMERA_Z,
  GRID_COLOR,
} from "../config/constants.js";

// Constants for the lane expansion effect
const BLOOM_BOOST_DURATION = 0.4; // Duration of the boost in seconds
const BLOOM_STRENGTH_BOOST = 2.5; // How much to increase bloom strength

export class SceneRenderer {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = BACKGROUND_COLORS[0].clone();

    this.setupCamera();
    this.setupRenderer();
    this.setupGrid();
    this.setupPostProcessing();

    // Background color animation state
    this.bgColorIndex = 0;
    this.bgColorLerp = 0;

    // Lane expansion effect state
    this.isBoostingBloom = false;
    this.bloomBoostTimer = 0;

    window.addEventListener("resize", this.handleResize.bind(this));
  }

  setupCamera() {
    const fov = 75;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.1;
    const far = 120;

    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(0, CAMERA_Y, CAMERA_Z);
    this.camera.lookAt(0, 0, -15); // Look further down the track
    this.scene.add(this.camera);
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.toneMapping = THREE.NoToneMapping;
    document.body.appendChild(this.renderer.domElement);
  }

  setupGrid() {
    const gridSize = 150;
    const gridDivisions = 60;
    const gridHelper = new THREE.GridHelper(
      gridSize,
      gridDivisions,
      GRID_COLOR,
      GRID_COLOR
    );
    gridHelper.position.y = -0.01; // Slightly below player/obstacles
    this.scene.add(gridHelper);
  }

  setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      BLOOM_PARAMS.strength,
      BLOOM_PARAMS.radius,
      BLOOM_PARAMS.threshold
    );
    this.composer.addPass(this.bloomPass);
  }

  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  update(deltaTime) {
    // Update background color transition
    this.bgColorLerp += deltaTime * COLOR_TRANSITION_SPEED;

    if (this.bgColorLerp >= 1) {
      this.bgColorIndex = (this.bgColorIndex + 1) % BACKGROUND_COLORS.length;
      this.bgColorLerp = 0;
    }

    const currentColor = BACKGROUND_COLORS[this.bgColorIndex];
    const nextColor =
      BACKGROUND_COLORS[(this.bgColorIndex + 1) % BACKGROUND_COLORS.length];

    this.scene.background.copy(currentColor).lerp(nextColor, this.bgColorLerp);

    // Update bloom boost effect
    if (this.isBoostingBloom) {
      this.bloomPass.strength = BLOOM_STRENGTH_BOOST;
      this.bloomBoostTimer -= deltaTime;
      if (this.bloomBoostTimer <= 0) {
        this.isBoostingBloom = false;
        this.bloomPass.strength = BLOOM_PARAMS.strength; // Restore original strength
        console.log("Bloom boost ended.");
      }
    } else {
      // Ensure bloom is at default if not boosting (safety check)
      if (this.bloomPass.strength !== BLOOM_PARAMS.strength) {
        this.bloomPass.strength = BLOOM_PARAMS.strength;
      }
    }
  }

  // Method to trigger the effect
  triggerLaneExpansionEffect() {
    if (!this.isBoostingBloom) {
      console.log("Triggering bloom boost effect!");
      this.isBoostingBloom = true;
      this.bloomBoostTimer = BLOOM_BOOST_DURATION;
    }
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.renderer.dispose();
    document.body.removeChild(this.renderer.domElement);
    window.removeEventListener("resize", this.handleResize);
  }
}
