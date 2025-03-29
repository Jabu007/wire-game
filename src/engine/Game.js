import * as THREE from "three";
import { Player } from "../entities/Player.js";
import { ObstacleManager } from "../entities/Obstacle.js";
import { City } from "../entities/City.js";
import { SceneRenderer } from "../rendering/Renderer.js";
import { InputHandler } from "../input/InputHandler.js";
import { saveHighScore } from "../lib/supabaseClient.js"; // Import Supabase function
import {
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
  BLOOM_PARAMS,
} from "../config/constants.js";

export class Game {
  constructor(username, onScoreSavedCallback) {
    console.log("Wireframe World Runner: Initializing game...");
    this.username = username; // Store the username
    this.onScoreSaved = onScoreSavedCallback; // Store the callback

    this.score = 0;
    this.gameOver = false;
    this.currentSpeed = OBSTACLE_BASE_SPEED;
    this.currentSpawnInterval = SPAWN_INTERVAL_INITIAL;
    this.timeSinceLastSpawn = 0;
    this.animationFrameId = null;
    this.clock = new THREE.Clock();
    this.currentLanes = [...LANES_INITIAL];
    this.laneExpansionLevel = 0;
    this.isSavingScore = false; // Flag to prevent multiple saves

    // Get UI elements using the utility function
    const elements = getElements();
    this.scoreElement = elements.scoreElement;
    this.gameOverElement = elements.gameOverElement;
    this.finalScoreElement = elements.finalScoreElement;
    this.instructionsElement = elements.instructionsElement;

    // Basic validation for elements
    if (
      !this.scoreElement ||
      !this.gameOverElement ||
      !this.finalScoreElement ||
      !this.instructionsElement
    ) {
      console.error("One or more UI elements not found!");
      // Handle this error appropriately, maybe show an error message
      this.showError("UI Error: Could not find essential elements.");
      return; // Stop initialization if UI is broken
    }

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

      // Start the game
      this.reset(this.username);

      console.log("Game initialization complete.");
    } catch (error) {
      console.error("CRITICAL ERROR during game initialization:", error);
      const errorDiv = document.createElement("div");
      errorDiv.style.color = "red";
      errorDiv.style.fontFamily = "monospace";
      errorDiv.style.padding = "20px";
      errorDiv.innerHTML = `<h1>Initialization Error</h1><pre>${
        error.stack || error
      }</pre><p>Check the browser console (F12) for more details.</p>`;
      document.body.innerHTML = "";
      document.body.appendChild(errorDiv);
    }
  }

  reset(username = this.username) {
    // Stop animation if running
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    console.log(`Resetting game for user: ${username}`);
    this.username = username; // Ensure username is current
    this.isSavingScore = false; // Reset saving flag

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
    // Reset renderer effects if needed (e.g., ensure bloom isn't stuck boosted)
    if (this.renderer) {
      this.renderer.isBoostingBloom = false;
      this.renderer.bloomBoostTimer = 0;
      if (this.renderer.bloomPass) {
        this.renderer.bloomPass.strength = BLOOM_PARAMS.strength;
      }
    }

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

      // Update renderer effects (background color, bloom boost)
      // This should happen regardless of game over state
      this.renderer.update(deltaTime);

      // Update game logic only if the game is active
      if (!this.gameOver) {
        this.updateGameLogic(deltaTime); // Renamed internal update method
      }

      // Render the scene using the composer
      this.renderer.render();
    } catch (error) {
      console.error("Error in animation loop:", error);
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      this.displayError("An error occurred during gameplay. Check console.");
      // Optionally trigger game over state on critical error
      // if (!this.gameOver) this.endGame(true); // Pass flag indicating error?
    }
  }

  updateGameLogic(deltaTime) {
    // Check for lane expansion first
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
      this.timeSinceLastSpawn = 0; // Reset timer accurately
    }

    // Check collisions
    if (this.player.checkCollision(this.obstacleManager.obstacles)) {
      this.endGame();
      return; // Stop further updates this frame if game ended
    }

    // Update score (only if game is still running after collision check)
    this.score += Math.round(deltaTime * this.currentSpeed); // Removed * 10 multiplier
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
    if (newLevel <= this.laneExpansionLevel) return; // Already at or past this level

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

    // --- Trigger the visual effect ---
    this.renderer.triggerLaneExpansionEffect();
    // --- Effect triggered ---
  }

  endGame() {
    if (this.gameOver) return; // Prevent multiple calls

    this.gameOver = true;
    console.log(`Game Over! Final Score for ${this.username}: ${this.score}`);

    // Stop player movement sound? (If applicable)

    // Update UI
    if (this.gameOverElement) {
      this.gameOverElement.style.display = "block";
    }
    if (this.finalScoreElement) {
      this.finalScoreElement.textContent = `Final Score: ${this.score}`;
    }
    if (this.instructionsElement) {
      this.instructionsElement.style.display = "none"; // Hide instructions on game over
    }

    // Save score (ensure it only runs once)
    if (!this.isSavingScore) {
      this.isSavingScore = true;
      console.log(
        `Attempting to save score ${this.score} for user ${this.username}`
      );
      saveHighScore(this.username, this.score)
        .then(() => {
          console.log("Score saving process completed.");
          if (this.onScoreSaved) {
            this.onScoreSaved(); // Trigger leaderboard update via callback
          }
        })
        .catch((err) => {
          // Log detailed error from Supabase if available
          console.error(
            "Error during saveHighScore promise:",
            err.message || err
          );
        })
        .finally(() => {
          // Reset flag even if saving failed, allowing retry on next game over
          this.isSavingScore = false;
        });
    }
  }

  displayError(message) {
    console.error("Game Error:", message);
    // Display a user-friendly error message, perhaps using the gameOver overlay
    if (this.gameOverElement && !this.gameOver) {
      // Show error even if game wasn't over yet
      this.gameOver = true; // Mark game as over due to error
      this.gameOverElement.style.display = "block";
      // Clear previous content and add error message
      this.gameOverElement.innerHTML = `<h1>Error</h1><p>${message}</p><p>Please refresh the page.</p>`;
      if (this.instructionsElement)
        this.instructionsElement.style.display = "none";
      if (this.scoreElement) this.scoreElement.style.display = "none"; // Hide score potentially
    }
    // Consider stopping the animation loop completely here if the error is critical
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  dispose() {
    console.log("Disposing game resources...");
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.player) this.player.dispose();
    if (this.obstacleManager) this.obstacleManager.dispose();
    if (this.city) this.city.dispose();
    if (this.renderer) this.renderer.dispose();
    if (this.input) this.input.dispose();

    if (window.game === this) {
      window.game = null;
    }
    console.log("Game disposed.");
  }
}
