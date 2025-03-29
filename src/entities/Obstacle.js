import * as THREE from "three";
import {
  OBSTACLE_SPAWN_Z,
  OBSTACLE_DESPAWN_Z,
  WIREFRAME_COLOR,
} from "../config/constants.js";

// Define obstacle geometries (using the simpler list from ObstacleManager.js for consistency)
const obstacleGeometries = [
  new THREE.IcosahedronGeometry(0.8, 0),
  new THREE.TorusKnotGeometry(0.6, 0.2, 100, 16),
  new THREE.SphereGeometry(0.7, 16, 8),
  new THREE.ConeGeometry(0.7, 1.5, 8),
  new THREE.CylinderGeometry(0.5, 0.5, 1.5, 16),
];

// Helper function to get approximate radius (adjust as needed for geometries)
const getObstacleRadius = (geometry) => {
  if (!geometry.boundingSphere) {
    geometry.computeBoundingSphere();
  }
  return geometry.boundingSphere.radius;
};

export class ObstacleManager {
  constructor(scene, initialLanes) {
    this.scene = scene;
    this.obstacles = [];
    this.lanes = initialLanes;
    this.lastLaneIndex = -1;
  }

  spawnObstacle() {
    // Choose a random geometry
    const geometry =
      obstacleGeometries[Math.floor(Math.random() * obstacleGeometries.length)];
    const radius = getObstacleRadius(geometry);

    // Choose a random material/color (wireframe)
    const material = new THREE.MeshBasicMaterial({
      color: WIREFRAME_COLOR,
      wireframe: true,
    });

    // Choose a random lane, try not to repeat the last one immediately
    let laneIndex;
    do {
      laneIndex = Math.floor(Math.random() * this.lanes.length);
    } while (this.lanes.length > 1 && laneIndex === this.lastLaneIndex);
    this.lastLaneIndex = laneIndex;

    const positionX = this.lanes[laneIndex];

    // Create and position the mesh
    const obstacleMesh = new THREE.Mesh(geometry, material);
    obstacleMesh.position.set(positionX, radius, OBSTACLE_SPAWN_Z);

    // Add random rotation for visual variety
    obstacleMesh.rotation.x = Math.random() * Math.PI;
    obstacleMesh.rotation.y = Math.random() * Math.PI;

    // Add to scene and tracking array
    this.scene.add(obstacleMesh);
    this.obstacles.push({ mesh: obstacleMesh, radius: radius });
  }

  updateLanes(newLanes) {
    this.lanes = newLanes;
    this.lastLaneIndex = -1;
    console.log("ObstacleManager (in Obstacle.js) lanes updated.");
  }

  reset(initialLanes) {
    this.obstacles.forEach((obstacle) => {
      this.scene.remove(obstacle.mesh);
      if (obstacle.mesh.geometry) obstacle.mesh.geometry.dispose();
      if (obstacle.mesh.material) obstacle.mesh.material.dispose();
    });
    this.obstacles = [];
    this.lanes = initialLanes;
    this.lastLaneIndex = -1;
  }

  update(deltaTime, speed) {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obstacle = this.obstacles[i];
      obstacle.mesh.position.z += speed * deltaTime;

      if (obstacle.mesh.position.z > OBSTACLE_DESPAWN_Z) {
        this.scene.remove(obstacle.mesh);
        if (obstacle.mesh.geometry) obstacle.mesh.geometry.dispose();
        if (obstacle.mesh.material) obstacle.mesh.material.dispose();
        this.obstacles.splice(i, 1);
      }
    }
  }

  dispose() {
    this.obstacles.forEach((obstacle) => {
      this.scene.remove(obstacle.mesh);
      if (obstacle.mesh.geometry) obstacle.mesh.geometry.dispose();
      if (obstacle.mesh.material) obstacle.mesh.material.dispose();
    });
    this.obstacles = [];
  }
}
