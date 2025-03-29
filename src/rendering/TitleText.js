import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { OBSTACLE_SPAWN_Z } from "../config/constants.js";

export class TitleText {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.rotationSpeed = 0.2; // Added rotation speed

    // Title text colors (more vibrant than background)
    this.titleColors = [
      0xff00ff, // Vibrant Pink
      0x00ffff, // Vibrant Cyan
      0xff6600, // Vibrant Orange
      0x00ff00, // Vibrant Green
      0xffff00, // Vibrant Yellow
    ];

    this.createTitleText();
  }

  createTitleText() {
    const loader = new FontLoader();

    loader.load(
      "https://threejs.org/examples/fonts/helvetiker_bold.typeface.json",
      (font) => {
        const textGeometry = new TextGeometry("Jabu's Game", {
          font: font,
          size: 1.0, // Reduced size from 1.5 to 1.0
          height: 0.05, // Keep height minimal
          curveSegments: 2,
          bevelEnabled: false,
        });

        // Center the text geometry
        textGeometry.computeBoundingBox();
        const textWidth =
          textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
        const textHeight =
          textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y;
        textGeometry.translate(-textWidth / 2, -textHeight / 2, 0); // Center geometry origin

        // Create wireframe material
        const textMaterial = new THREE.MeshBasicMaterial({
          color: 0x00ffff, // Initial color
          wireframe: true,
        });

        this.mesh = new THREE.Mesh(textGeometry, textMaterial);

        // Position on the horizon, Y position might need slight adjustment if needed
        this.mesh.position.set(0, 5, OBSTACLE_SPAWN_Z * 0.8); // Keeping Y at 5 for now

        this.scene.add(this.mesh);
      }
    );
  }

  update(deltaTime) {
    if (this.mesh) {
      // Rotate the text around its Y-axis (which is now its center)
      this.mesh.rotation.y += this.rotationSpeed * deltaTime;

      // Calculate color index based on time
      const colorIndex = Math.floor(Date.now() / 800) % this.titleColors.length;

      // Update color
      if (this.mesh.material) {
        this.mesh.material.color.setHex(this.titleColors[colorIndex]);
      }
    }
  }

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
      this.mesh = null;
    }
  }
}
