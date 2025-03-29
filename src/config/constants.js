// Game constants and configuration
import * as THREE from "/node_modules/three/build/three.module.js";

// Player & Lanes
export const PLAYER_SIZE = 1;
export const LANE_WIDTH = 2.5;
export const LANES_INITIAL = [-LANE_WIDTH, 0, LANE_WIDTH]; // 3 lanes

// Renamed from LANES_EXPANDED
export const LANES_LEVEL_1 = [
  // 5 lanes
  -2 * LANE_WIDTH,
  -LANE_WIDTH,
  0,
  LANE_WIDTH,
  2 * LANE_WIDTH,
];
// New 7-lane configuration
export const LANES_LEVEL_2 = [
  // 7 lanes
  -3 * LANE_WIDTH,
  -2 * LANE_WIDTH,
  -LANE_WIDTH,
  0,
  LANE_WIDTH,
  2 * LANE_WIDTH,
  3 * LANE_WIDTH,
];
// New 9-lane configuration
export const LANES_LEVEL_3 = [
  // 9 lanes
  -4 * LANE_WIDTH,
  -3 * LANE_WIDTH,
  -2 * LANE_WIDTH,
  -LANE_WIDTH,
  0,
  LANE_WIDTH,
  2 * LANE_WIDTH,
  3 * LANE_WIDTH,
  4 * LANE_WIDTH,
];

// Renamed from LANE_EXPANSION_SCORE
export const LANE_EXPANSION_LEVEL_1_SCORE = 700; // Score for 5 lanes
export const LANE_EXPANSION_LEVEL_2_SCORE = 1200; // Score for 7 lanes
export const LANE_EXPANSION_LEVEL_3_SCORE = 1700; // Score for 9 lanes

// Obstacles
export const OBSTACLE_SPAWN_Z = -60;
export const OBSTACLE_DESPAWN_Z = 15;
export const OBSTACLE_BASE_SPEED = 30;
export const SPEED_INCREASE_RATE = 1;
export const SPAWN_INTERVAL_INITIAL = 0.7;
export const SPAWN_INTERVAL_MIN = 0.2;
export const SPAWN_RATE_INCREASE = 0.015;

// City
export const CITY_DISTANCE = 180;
export const CITY_WIDTH = 300;
export const CITY_DEPTH = 150;
export const BUILDING_DENSITY = 90;
export const BUILDING_HEIGHT_MIN = 2;
export const BUILDING_HEIGHT_MAX = 20;
export const BUILDING_WIDTH_MIN = 3;
export const BUILDING_WIDTH_MAX = 10;

// Colors
export const CITY_COLORS = [0x001a33, 0x1a0033, 0x003322, 0x330022];
export const WIREFRAME_COLOR = 0xffffff;
export const PLAYER_COLOR = 0x00ff00;
export const OBSTACLE_COLORS = [0xcccccc, 0xbbbbbb, 0xaaaaaa];
export const GRID_COLOR = 0x444444;
export const TRAIL_COLOR = 0x00aa00;

// Trail
export const TRAIL_LENGTH = 30;

// Camera
export const CAMERA_Y = PLAYER_SIZE * 7;
export const CAMERA_Z = 10;

// Background Colors
export const BACKGROUND_COLORS = [
  new THREE.Color(0x000000), // Pure Black
  new THREE.Color(0x1a0033), // Dark Purple
  new THREE.Color(0x003333), // Dark Teal
  new THREE.Color(0x000033), // Dark Navy
  new THREE.Color(0x330033), // Dark Magenta
  new THREE.Color(0x331100), // Dark Rust
  new THREE.Color(0x003300), // Dark Green
  new THREE.Color(0x333300), // Dark Olive
  new THREE.Color(0x330022), // Dark Burgundy
  new THREE.Color(0x0a0a0a), // Near Black
];
export const COLOR_TRANSITION_SPEED = 0.5;

// Bloom
export const BLOOM_PARAMS = {
  strength: 0.6,
  radius: 0.3,
  threshold: 0.8,
};

// DOM Elements
export const getElements = () => ({
  scoreElement: document.getElementById("score"),
  gameOverElement: document.getElementById("gameOver"),
  finalScoreElement: document.getElementById("finalScore"),
  instructionsElement: document.getElementById("instructions"),
});

// Device Detection
export const isMobileDevice =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
