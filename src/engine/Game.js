import * as THREE from "three";
import { Player } from "../entities/Player.js";
import { ObstacleManager } from "../entities/Obstacle.js";
import { City } from "../entities/City.js";
import { SceneRenderer } from "../rendering/Renderer.js";
import { InputHandler } from "../input/InputHandler.js";
import {
  COLOR_TRANSITION_SPEED,
  OBSTACLE_BASE_SPEED,
  SPAWN_INTERVAL_INITIAL,
  getElements,
  SPEED_INCREASE_RATE,
  SPAWN_INTERVAL_MIN,
  SPAWN_RATE_INCREASE,
  LANES_INITIAL,
  LANES_LEVEL_1,
  LANES_LEVEL_2,
  LANES_LEVEL_3,
  LANE_EXPANSION_LEVEL_1_SCORE,
  LANE_EXPANSION_LEVEL_2_SCORE,
  LANE_EXPANSION_LEVEL_3_SCORE,
} from "../config/constants.js";

export class Game {
  constructor() {
    console.log("Wireframe World Runner: Initializing game...");

    this.score = 0;
    this.gameOver = false;
    this.currentSpeed = OBSTACLE_BASE_SPEED;
    this.currentSpawnInterval = SPAWN_INTERVAL_INITIAL;
    this.timeSinceLastSpawn = 0;
    this.animationFrameId = null;
    this.clock = new THREE.Clock();
    this.currentLanes = [...LANES_INITIAL];
    this.laneExpansionLevel = 0;

    try {
      // Initialize core components
      this.renderer = new SceneRenderer();
      this.player = new Player(this.renderer.scene, this.currentLanes);
      this.obstacleManager = new ObstacleManager(
        this.renderer.scene,
        this.currentLanes
      );
      this.city = new City(this.renderer.scene);

      // Setup input handler
      this.input = new InputHandler(this);

      // Get DOM elements
      const elements = getElements();
      this.scoreElement = elements.scoreElement;
      this.gameOverElement = elements.gameOverElement;
      this.finalScoreElement = elements.finalScoreElement;
      this.instructionsElement = elements.instructionsElement;

      // Start the game
      this.reset();

      console.log("Game initialization complete.");
    } catch (error) {
      console.error("CRITICAL ERROR during game initialization:", error);
      document.body.innerHTML = `<div style="color: red; font-family: monospace; padding: 20px;">
        <h1>Initialization Error</h1><pre>${error.stack || error}</pre>
        <p>Check the browser console (F12) for more details.</p></div>`;
    }
  }

  reset() {
    // Stop animation if running
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Reset game state
    this.score = 0;
    this.gameOver = false;
    this.currentSpeed = OBSTACLE_BASE_SPEED;
    this.currentSpawnInterval = SPAWN_INTERVAL_INITIAL;
    this.timeSinceLastSpawn = this.currentSpawnInterval;
    this.currentLanes = [...LANES_INITIAL];
    this.laneExpansionLevel = 0;

    // Reset components
    this.player.reset(this.currentLanes);
    this.obstacleManager.reset(this.currentLanes);
    this.city.reset();

    // Reset UI
    if (this.scoreElement) this.scoreElement.textContent = `Score: 0`;
    if (this.gameOverElement) this.gameOverElement.style.display = "none";
    if (this.instructionsElement)
      this.instructionsElement.style.display = "block";

    // Restart animation
    this.clock.start();
    this.animate();
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

    try {
      const deltaTime = this.clock.getDelta();

      // Always update background color
      this.renderer.updateBackgroundColor(deltaTime, COLOR_TRANSITION_SPEED);

      if (!this.gameOver) {
        this.update(deltaTime);
      }

      // Render the scene
      this.renderer.render();
    } catch (error) {
      console.error("Error in animation loop:", error);
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  update(deltaTime) {
    if (
      this.laneExpansionLevel < 3 &&
      this.score >= LANE_EXPANSION_LEVEL_3_SCORE
    ) {
      this.expandLanes(3);
    } else if (
      this.laneExpansionLevel < 2 &&
      this.score >= LANE_EXPANSION_LEVEL_2_SCORE
    ) {
      this.expandLanes(2);
    } else if (
      this.laneExpansionLevel < 1 &&
      this.score >= LANE_EXPANSION_LEVEL_1_SCORE
    ) {
      this.expandLanes(1);
    }

    // Update player
    this.player.update(deltaTime);

    // Update obstacles
    this.obstacleManager.update(deltaTime, this.currentSpeed);

    // Increase difficulty
    this.updateDifficulty(deltaTime);

    // Spawn new obstacles
    this.timeSinceLastSpawn += deltaTime;
    if (this.timeSinceLastSpawn >= this.currentSpawnInterval) {
      this.obstacleManager.spawnObstacle();
      this.timeSinceLastSpawn = 0;
    }

    // Check collisions
    if (this.player.checkCollision(this.obstacleManager.obstacles)) {
      this.endGame();
    }

    // Update score
    this.score += Math.round(deltaTime * this.currentSpeed);
    if (this.scoreElement) {
      this.scoreElement.textContent = `Score: ${this.score}`;
    }
  }

  updateDifficulty(deltaTime) {
    // Increase speed over time
    this.currentSpeed += SPEED_INCREASE_RATE * deltaTime;

    // Decrease spawn interval (make obstacles more frequent)
    this.currentSpawnInterval = Math.max(
      SPAWN_INTERVAL_MIN,
      this.currentSpawnInterval - SPAWN_RATE_INCREASE * deltaTime
    );
  }

  expandLanes(newLevel) {
    if (newLevel <= this.laneExpansionLevel) return;

    let newLaneConfig;
    let laneCount;

    switch (newLevel) {
      case 1:
        newLaneConfig = LANES_LEVEL_1;
        laneCount = 5;
        break;
      case 2:
        newLaneConfig = LANES_LEVEL_2;
        laneCount = 7;
        break;
      case 3:
        newLaneConfig = LANES_LEVEL_3;
        laneCount = 9;
        break;
      default:
        console.warn("Invalid lane expansion level requested:", newLevel);
        return;
    }

    console.log(`Score threshold reached! Expanding to ${laneCount} lanes.`);
    this.currentLanes = [...newLaneConfig];
    this.laneExpansionLevel = newLevel;

    // Notify player and obstacle manager about the change
    this.player.updateLanes(this.currentLanes);
    this.obstacleManager.updateLanes(this.currentLanes);

    // Optional: Add a visual indicator or effect here? (e.g., brief screen flash)
  }

  endGame() {
    this.gameOver = true;

    // Update UI
    if (this.gameOverElement) {
      this.gameOverElement.style.display = "block";
    }
    if (this.finalScoreElement) {
      this.finalScoreElement.textContent = `Final Score: ${this.score}`;
    }
  }

  dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Dispose all components
    this.player.dispose();
    this.obstacleManager.dispose();
    this.city.dispose();
    this.renderer.dispose();
    this.input.dispose();
  }
}
