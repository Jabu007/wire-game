import * as THREE from "three";
import {
  PLAYER_SIZE,
  PLAYER_COLOR,
  TRAIL_COLOR,
  TRAIL_LENGTH,
  LANE_WIDTH,
} from "../config/constants.js";

export class Player {
  constructor(scene, initialLanes) {
    this.scene = scene;
    this.lanes = initialLanes;
    this.laneIndex = Math.floor(this.lanes.length / 2);
    this.targetX = this.lanes[this.laneIndex];
    this.trailPoints = [];
    this.moveLerpFactor = 0.15;
    this.rotationSpeed = 1.0;

    this.createPlayerMesh();
    this.createTrail();
  }

  createPlayerMesh() {
    const geometry = new THREE.SphereGeometry(PLAYER_SIZE / 2, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: PLAYER_COLOR,
      emissive: PLAYER_COLOR,
      emissiveIntensity: 1.5,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(this.targetX, PLAYER_SIZE / 2, 0);
    this.scene.add(this.mesh);
  }

  createTrail() {
    // Initialize empty trail
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      this.trailPoints.push(
        new THREE.Vector3(this.mesh.position.x, 0, -i * 0.5)
      );
    }

    const trailGeometry = new THREE.BufferGeometry().setFromPoints(
      this.trailPoints
    );
    const trailMaterial = new THREE.LineBasicMaterial({ color: TRAIL_COLOR });
    this.trailLine = new THREE.Line(trailGeometry, trailMaterial);
    this.scene.add(this.trailLine);
  }

  update(deltaTime) {
    // Smoothly move towards the target lane position
    this.mesh.position.x +=
      (this.targetX - this.mesh.position.x) * this.moveLerpFactor;

    // Add rotation
    this.mesh.rotation.y += this.rotationSpeed * deltaTime;
    this.mesh.rotation.x += this.rotationSpeed * 0.5 * deltaTime;

    // Update trail
    this.updateTrail();
  }

  moveLeft() {
    if (this.laneIndex > 0) {
      this.laneIndex--;
      this.targetX = this.lanes[this.laneIndex];
      return true;
    }
    return false;
  }

  moveRight() {
    if (this.laneIndex < this.lanes.length - 1) {
      this.laneIndex++;
      this.targetX = this.lanes[this.laneIndex];
      return true;
    }
    return false;
  }

  updateLanes(newLanes) {
    const oldMiddleIndex = Math.floor(this.lanes.length / 2);
    const newMiddleIndex = Math.floor(newLanes.length / 2);
    const indexDifference = newMiddleIndex - oldMiddleIndex;

    this.lanes = newLanes;
    this.laneIndex += indexDifference;
    this.laneIndex = Math.max(
      0,
      Math.min(this.lanes.length - 1, this.laneIndex)
    );
    this.targetX = this.lanes[this.laneIndex];
    console.log(
      `Player lanes updated. New index: ${this.laneIndex}, TargetX: ${this.targetX}`
    );
  }

  reset(initialLanes) {
    this.lanes = initialLanes;
    this.laneIndex = Math.floor(this.lanes.length / 2);
    this.targetX = this.lanes[this.laneIndex];
    this.mesh.position.x = this.targetX;
    this.mesh.position.y = PLAYER_SIZE / 2;
    this.mesh.position.z = 0;
    this.mesh.rotation.set(0, 0, 0);
    this.resetTrail();
  }

  updateTrail() {
    // Shift trail points
    for (let i = this.trailPoints.length - 1; i > 0; i--) {
      this.trailPoints[i].copy(this.trailPoints[i - 1]);
    }

    // Update first point to player position
    this.trailPoints[0].set(this.mesh.position.x, 0, this.mesh.position.z);

    // Update trail geometry
    this.trailLine.geometry.setFromPoints(this.trailPoints);
    this.trailLine.geometry.attributes.position.needsUpdate = true;
  }

  resetTrail() {
    // Reset trail points
    for (let i = 0; i < this.trailPoints.length; i++) {
      this.trailPoints[i].set(this.targetX, 0, -i * 0.5);
    }
    this.trailLine.geometry.setFromPoints(this.trailPoints);
    this.trailLine.geometry.attributes.position.needsUpdate = true;
  }

  checkCollision(obstacles) {
    // Collision radius (half the player size)
    const collisionRadius = PLAYER_SIZE / 2;

    for (const obstacle of obstacles) {
      const obstaclePosition = obstacle.mesh.position;
      const obstacleRadius = obstacle.radius;

      // Calculate distance between player and obstacle centers
      const distance = this.mesh.position.distanceTo(obstaclePosition);

      // Check if distance is less than combined radii (collision)
      if (distance < collisionRadius + obstacleRadius) {
        return true;
      }
    }

    return false;
  }

  dispose() {
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) this.mesh.material.dispose();
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);

    if (this.trailLine.geometry) this.trailLine.geometry.dispose();
    if (this.trailLine.material) this.trailLine.material.dispose();
    if (this.trailLine.parent) this.trailLine.parent.remove(this.trailLine);
  }
}
