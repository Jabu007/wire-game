import * as THREE from "three";
import {
  CITY_DISTANCE,
  CITY_WIDTH,
  CITY_DEPTH,
  BUILDING_DENSITY,
  BUILDING_HEIGHT_MIN,
  BUILDING_HEIGHT_MAX,
  BUILDING_WIDTH_MIN,
  BUILDING_WIDTH_MAX,
  CITY_COLORS,
} from "../config/constants.js";

export class City {
  constructor(scene) {
    this.scene = scene;
    this.buildings = [];
    this.cityGroup = new THREE.Group();
    this.scene.add(this.cityGroup);

    this.generate();
  }

  generate() {
    // Create buildings with random properties
    for (let i = 0; i < BUILDING_DENSITY; i++) {
      // Random position across the city width and depth
      const x = Math.random() * CITY_WIDTH - CITY_WIDTH / 2;
      const z = -CITY_DISTANCE - Math.random() * CITY_DEPTH;

      // Random building dimensions
      const width =
        BUILDING_WIDTH_MIN +
        Math.random() * (BUILDING_WIDTH_MAX - BUILDING_WIDTH_MIN);
      const depth =
        BUILDING_WIDTH_MIN +
        Math.random() * (BUILDING_WIDTH_MAX - BUILDING_WIDTH_MIN);
      const height =
        BUILDING_HEIGHT_MIN +
        Math.random() * (BUILDING_HEIGHT_MAX - BUILDING_HEIGHT_MIN);

      // Create building geometry
      const geometry = new THREE.BoxGeometry(width, height, depth);

      // Random building color from our neon palette
      const color = CITY_COLORS[Math.floor(Math.random() * CITY_COLORS.length)];

      // Create solid material with low opacity
      const material = new THREE.MeshBasicMaterial({
        color: color,
        wireframe: false,
        transparent: true,
        opacity: 0.3,
      });

      // Create the building mesh
      const building = new THREE.Mesh(geometry, material);

      // Position building (bottom at ground level)
      building.position.set(x, height / 2, z);

      // Add to city group
      this.cityGroup.add(building);

      // Track the building for cleanup
      this.buildings.push(building);
    }
  }

  dispose() {
    this.buildings.forEach((building) => {
      if (building.parent) building.parent.remove(building);
      if (building.geometry) building.geometry.dispose();
      if (building.material) building.material.dispose();
    });

    this.buildings = [];
    if (this.cityGroup.parent) this.cityGroup.parent.remove(this.cityGroup);
  }

  reset() {
    this.dispose();
    this.cityGroup = new THREE.Group();
    this.scene.add(this.cityGroup);
    this.generate();
  }
}
