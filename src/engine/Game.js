import * as THREE from "three";
import { Player } from "../entities/Player.js";
import { ObstacleManager } from "../entities/Obstacle.js";
import { City } from "../entities/City.js";
import { SceneRenderer } from "../rendering/Renderer.js";
import { InputHandler } from "../input/InputHandler.js";
import {
  saveHighScore,
  updateUserOnlineStatus,
} from "../lib/supabaseClient.js"; // Import Supabase functions
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
  isMobileDevice, // Import isMobileDevice
} from "../config/constants.js";

export class Game {
  /**
   * @param {string} username - The player's username.
   * @param {number} userHighScore - The player's personal best score.
   * @param {(limit?: number | null) => Promise<void>} onLeaderboardUpdate - Callback to update the leaderboard UI.
   */
  constructor(username, userHighScore, onLeaderboardUpdate) {
    console.log("Wireframe World Runner: Initializing game...");
    this.username = username; // Store the username
    this.userHighScore = userHighScore; // Store the user's personal high score
    this.onLeaderboardUpdate = onLeaderboardUpdate; // Store the leaderboard update callback

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
    this.highScoreMessageShownThisRun = false; // Flag for high score message
    this.highScoreMessageTimeout = null; // Timeout ID for hiding the message
    this.lastMilestoneReached = 0; // Track the last milestone reached
    this.milestoneMessageTimeout = null; // Timeout ID for hiding the milestone message
    this.tapToRestartEnabled = true; // Add this flag to control tap restart

    // --- Add Audio Reference ---
    this.backgroundMusic = document.getElementById("backgroundMusic");
    // --- End Audio Reference ---

    // Get UI elements using the utility function
    const elements = getElements();
    this.scoreElement = elements.scoreElement;
    this.gameOverElement = elements.gameOverElement;
    this.finalScoreElement = elements.finalScoreElement;
    this.instructionsElement = elements.instructionsElement;
    this.highScoreMessageElement = elements.highScoreMessageElement; // Get the new element
    this.milestoneMessageElement = elements.milestoneMessageElement; // Get the new element

    // Basic validation for elements
    if (
      !this.scoreElement ||
      !this.gameOverElement ||
      !this.finalScoreElement ||
      !this.instructionsElement ||
      !this.highScoreMessageElement || // Validate the new element
      !this.milestoneMessageElement // Validate the new element
    ) {
      console.error("One or more UI elements not found!");
      this.showError("UI Error: Could not find essential elements.");
      return;
    }

    // In the constructor, add a reference to the new elements
    this.gameOverLeaderboardElement = document.getElementById(
      "gameOverLeaderboard"
    );
    this.restartButton = document.getElementById("restartButton");

    // Add event listener for the restart button
    if (this.restartButton) {
      this.restartButton.addEventListener("click", () => {
        this.reset();
      });
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

      // Start the game (pass username and high score to reset)
      this.reset(this.username, this.userHighScore);

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

  reset(username = this.username, userHighScore = this.userHighScore) {
    // Stop animation if running
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    console.log(
      `Resetting game for user: ${username} (High Score: ${userHighScore})`
    );
    this.username = username;
    this.userHighScore = userHighScore; // Update high score on reset if needed
    this.isSavingScore = false;
    this.highScoreMessageShownThisRun = false; // Reset the flag
    this.lastMilestoneReached = 0;
    if (this.highScoreMessageTimeout) {
      clearTimeout(this.highScoreMessageTimeout);
      this.highScoreMessageTimeout = null;
    }
    if (this.highScoreMessageElement) {
      this.highScoreMessageElement.style.display = "none";
    }
    if (this.milestoneMessageTimeout) {
      clearTimeout(this.milestoneMessageTimeout);
      this.milestoneMessageTimeout = null;
    }
    if (this.milestoneMessageElement) {
      this.milestoneMessageElement.style.display = "none";
    }

    // Set user online status when game resets/starts
    if (this.username) {
      updateUserOnlineStatus(this.username, true)
        .then(() => {
          // After setting online, refresh leaderboard to top 5
          if (this.onLeaderboardUpdate) {
            console.log("Game reset: Requesting top 5 scores update.");
            this.onLeaderboardUpdate(); // Request update with default limit (5)
          }
        })
        .catch((err) => {
          console.error("Failed to set user online status on reset:", err);
          // Still try to update leaderboard even if status update fails
          if (this.onLeaderboardUpdate) {
            console.warn(
              "Game reset: Requesting top 5 scores update despite status error."
            );
            this.onLeaderboardUpdate();
          }
        });
    } else if (this.onLeaderboardUpdate) {
      // If no username, still ensure leaderboard shows top 5
      console.log("Game reset (no user): Requesting top 5 scores update.");
      this.onLeaderboardUpdate();
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
    if (this.highScoreMessageElement)
      this.highScoreMessageElement.style.display = "none"; // Ensure message is hidden
    if (this.milestoneMessageElement)
      this.milestoneMessageElement.style.display = "none"; // Ensure message is hidden

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
        this.updateGameLogic(deltaTime);
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

    // --- Check for New High Score ---
    if (
      this.score > this.userHighScore &&
      this.userHighScore > 0 && // Only show if there was a previous high score > 0
      !this.highScoreMessageShownThisRun
    ) {
      this.highScoreMessageShownThisRun = true;
      console.log("New High Score achieved!");
      if (this.highScoreMessageElement) {
        this.highScoreMessageElement.style.display = "block";
        // Clear previous timeout just in case
        if (this.highScoreMessageTimeout) {
          clearTimeout(this.highScoreMessageTimeout);
        }
        // Set timeout to hide the message after 3 seconds
        this.highScoreMessageTimeout = setTimeout(() => {
          if (this.highScoreMessageElement) {
            // Check again in case game ended/reset quickly
            this.highScoreMessageElement.style.display = "none";
          }
          this.highScoreMessageTimeout = null; // Clear timeout ID
        }, 3000); // 3000 milliseconds = 3 seconds
      }
      // Update the high score tracked in this run so message doesn't reappear
      // (Alternatively, could update this.userHighScore immediately, but let's wait for save)
    }
    // --- End High Score Check ---

    // --- Check for Score Milestones ---
    const currentMilestone = Math.floor(this.score / 1000);
    if (currentMilestone > 0 && currentMilestone > this.lastMilestoneReached) {
      this.lastMilestoneReached = currentMilestone;
      this.showMilestoneMessage(currentMilestone * 1000);
    }
    // --- End Score Milestone Check ---
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
    this.tapToRestartEnabled = false; // Disable tap to restart
    console.log(`Game Over! Final Score for ${this.username}: ${this.score}`);

    // Update UI
    if (this.gameOverElement) {
      this.gameOverElement.style.display = "block";
    }

    if (this.finalScoreElement) {
      this.finalScoreElement.textContent = `Final Score: ${this.score}`;
    }

    // Update leaderboard with all scores and highlight current player
    if (this.onLeaderboardUpdate) {
      try {
        // Pass 0 to show all scores, and pass the current score
        this.onLeaderboardUpdate(0, this.score, true); // Added third parameter to indicate game over
      } catch (error) {
        console.error("Error updating leaderboard on game over:", error);
        // Show a fallback message if leaderboard update fails
        const leaderboardContainer = document.querySelector(
          "#gameOverLeaderboard .leaderboard-container ul"
        );
        if (leaderboardContainer) {
          leaderboardContainer.innerHTML =
            "<li>Unable to load scores. Try again later.</li>";
        }
      }
    }

    // Save high score if user is logged in
    if (this.username && this.username.trim() !== "") {
      this.saveScore();
    }

    // Set user as offline in the database
    if (this.username && this.username.trim() !== "") {
      updateUserOnlineStatus(this.username, false).catch((err) =>
        console.warn("Failed to set user offline:", err)
      );
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
    // Clear high score message timeout on dispose
    if (this.highScoreMessageTimeout) {
      clearTimeout(this.highScoreMessageTimeout);
      this.highScoreMessageTimeout = null;
    }

    // --- Pause Music on Dispose (if not already paused by endGame) ---
    if (this.backgroundMusic && !this.gameOver) {
      // Only pause if dispose happens before game over (e.g., starting new game)
      this.backgroundMusic.pause();
      console.log("Background music paused on game dispose.");
    }
    // --- End Pause Music ---

    // --- Set user offline on dispose ---
    // It's good practice to also try setting offline here,
    // especially if the game is disposed before 'endGame' is fully processed
    // or if the user closes the tab before 'endGame' completes its async operations.
    if (this.username && !this.gameOver) {
      // Only set offline here if game didn't naturally end
      // because endGame already handles setting offline.
      console.log(
        "Setting user offline during dispose (game didn't end normally)."
      );
      updateUserOnlineStatus(this.username, false).catch((err) =>
        console.warn("Failed to set user offline during dispose:", err)
      );
    }
    // --- End set offline ---

    if (this.player) this.player.dispose();
    if (this.obstacleManager) this.obstacleManager.dispose();
    if (this.city) this.city.dispose();
    if (this.renderer) this.renderer.dispose();
    if (this.input) this.input.dispose();

    if (window.game === this) {
      window.game = null;
    }
    console.log("Game disposed.");

    // Clear milestone message timeout on dispose
    if (this.milestoneMessageTimeout) {
      clearTimeout(this.milestoneMessageTimeout);
      this.milestoneMessageTimeout = null;
    }
  }

  updateScore(points = 1) {
    this.score += points;
    if (this.scoreElement) {
      this.scoreElement.textContent = `Score: ${this.score}`;
    }

    // Update leaderboard with current score for contextual display
    if (this.onLeaderboardUpdate) {
      this.onLeaderboardUpdate(5, this.score); // Pass current score as second parameter
    }

    // Check for high score
    if (
      this.userHighScore !== null &&
      this.score > this.userHighScore &&
      !this.highScoreMessageShownThisRun
    ) {
      this.showHighScoreMessage();
    }
  }

  showMilestoneMessage(milestone) {
    console.log(`Reached milestone: ${milestone}!`);
    if (this.milestoneMessageElement) {
      this.milestoneMessageElement.textContent = `${milestone}!!!`;
      this.milestoneMessageElement.style.display = "block";

      // Clear previous timeout if exists
      if (this.milestoneMessageTimeout) {
        clearTimeout(this.milestoneMessageTimeout);
      }

      // Set timeout to hide the message after 2 seconds
      this.milestoneMessageTimeout = setTimeout(() => {
        if (this.milestoneMessageElement) {
          this.milestoneMessageElement.style.display = "none";
        }
        this.milestoneMessageTimeout = null;
      }, 2000);
    }
  }

  handleInput(input) {
    if (this.gameOver) {
      // Only handle restart input if tap restart is enabled
      if (input.restart && this.tapToRestartEnabled) {
        this.reset();
        return;
      }
      // Otherwise ignore input during game over
      return;
    }

    // Rest of handleInput code...
  }
}
