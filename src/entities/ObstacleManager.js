import * as THREE from "three";
import {
  OBSTACLE_SPAWN_Z,
  OBSTACLE_DESPAWN_Z,
  // OBSTACLE_COLORS, // Removed as it's not used
  WIREFRAME_COLOR,
  // LANES, // <-- This line needs to be completely removed
} from "../config/constants.js";

// Define obstacle geometries (as before)
const obstacleGeometries = [
  // ... (keep existing geometries) ...
  new THREE.IcosahedronGeometry(0.8, 0), // Example: Icosahedron
  new THREE.TorusKnotGeometry(0.6, 0.2, 100, 16), // Example: Torus Knot
  new THREE.SphereGeometry(0.7, 16, 8), // Example: Sphere
  new THREE.ConeGeometry(0.7, 1.5, 8), // Example: Cone
  new THREE.CylinderGeometry(0.5, 0.5, 1.5, 16), // Example: Cylinder
];

export class ObstacleManager {
  constructor(scene, initialLanes) {
    // <-- Accept initial lanes
    this.scene = scene;
    this.obstacles = [];
    this.lanes = initialLanes; // <-- Store lanes
    this.lastLaneIndex = -1; // Track last spawn lane
  }

  spawnObstacle() {
    // Choose a random geometry
    const geometry =
      obstacleGeometries[Math.floor(Math.random() * obstacleGeometries.length)];

    // Choose a random material/color (wireframe)
    const material = new THREE.MeshBasicMaterial({
      color: WIREFRAME_COLOR, // Use the base wireframe color
      wireframe: true,
    });

    // Choose a random lane, try not to repeat the last one immediately
    let laneIndex;
    do {
      laneIndex = Math.floor(Math.random() * this.lanes.length); // Use dynamic length
    } while (this.lanes.length > 1 && laneIndex === this.lastLaneIndex);
    this.lastLaneIndex = laneIndex;

    const positionX = this.lanes[laneIndex]; // Get position from current lanes

    // Create and position the mesh
    const obstacleMesh = new THREE.Mesh(geometry, material);
    obstacleMesh.position.set(positionX, 1, OBSTACLE_SPAWN_Z); // Y=1 for ground level

    // Add to scene and tracking array
    this.scene.add(obstacleMesh);
    this.obstacles.push({ mesh: obstacleMesh, laneIndex: laneIndex }); // Store laneIndex if needed later
  }

  updateLanes(newLanes) {
    this.lanes = newLanes;
    // Reset lastLaneIndex as the lane count changed
    this.lastLaneIndex = -1;
    console.log("ObstacleManager lanes updated.");
  }

  reset(initialLanes) {
    // <-- Accept initial lanes
    // Remove existing obstacles
    this.obstacles.forEach((obstacle) => {
      this.scene.remove(obstacle.mesh);
      if (obstacle.mesh.geometry) obstacle.mesh.geometry.dispose();
      if (obstacle.mesh.material) obstacle.mesh.material.dispose();
    });
    this.obstacles = [];
    this.lanes = initialLanes; // <-- Reset lanes
    this.lastLaneIndex = -1; // Reset last spawn lane
  }

  update(deltaTime, speed) {
    // Move obstacles and remove those that are too far
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obstacle = this.obstacles[i];
      obstacle.mesh.position.z += speed * deltaTime;

      // Add some rotation for visual effect
      obstacle.mesh.rotation.x += deltaTime * 0.5;
      obstacle.mesh.rotation.y += deltaTime * 0.5;

      // Remove if past despawn point
      if (obstacle.mesh.position.z > OBSTACLE_DESPAWN_Z) {
        this.scene.remove(obstacle.mesh);
        if (obstacle.mesh.geometry) obstacle.mesh.geometry.dispose();
        if (obstacle.mesh.material) obstacle.mesh.material.dispose();
        this.obstacles.splice(i, 1);
      }
    }
  }

  dispose() {
    // Remove existing obstacles
    this.obstacles.forEach((obstacle) => {
      this.scene.remove(obstacle.mesh);
      if (obstacle.mesh.geometry) obstacle.mesh.geometry.dispose();
      if (obstacle.mesh.material) obstacle.mesh.material.dispose();
    });
    this.obstacles = [];
  }
}
