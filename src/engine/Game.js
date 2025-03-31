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

    // Hide both the game over modal and the blur overlay
    this.gameOverElement.style.display = "none";
    document.getElementById("gameOverBlurOverlay").style.display = "none";

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

  /**
   * Ends the game and handles game over logic
   */
  endGame() {
    if (this.gameOver) return; // Prevent multiple calls

    this.gameOver = true;
    this.tapToRestartEnabled = false; // Disable tap to restart
    console.log(`Game Over! Final Score for ${this.username}: ${this.score}`);

    // Show both the game over modal and the blur overlay
    this.gameOverElement.style.display = "block";
    document.getElementById("gameOverBlurOverlay").style.display = "block";

    if (this.finalScoreElement) {
      this.finalScoreElement.textContent = `Final Score: ${this.score}`;
    }

    // Save high score if user is logged in
    if (this.username && this.username.trim() !== "") {
      this.saveScore()
        .then(() => {
          // After saving score, update leaderboard with all scores
          if (this.onLeaderboardUpdate) {
            try {
              // Update both leaderboards
              this.onLeaderboardUpdate(0, null, true); // Game over leaderboard

              // Also update the top-left in-game leaderboard to show latest data
              setTimeout(() => {
                const inGameLeaderboard =
                  document.querySelector("#leaderboard ul");
                if (inGameLeaderboard) {
                  this.onLeaderboardUpdate(3, null, false, true); // Force refresh
                }
              }, 500);
            } catch (error) {
              console.error("Error updating leaderboard on game over:", error);
            }
          }
        })
        .catch((error) => {
          console.error("Error saving score on game over:", error);
        });
    }

    // DO NOT set user offline status here
    // The user is still on the website, just finished a game
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
    console.log("Game.dispose() called");

    // Clean up Three.js resources
    this.renderer.dispose();

    // Clear any running intervals/timeouts
    cancelAnimationFrame(this.animationFrameId);

    // Remove event listeners
    this.input.removeEventListeners();

    // DO NOT set user offline status here either
    // This happens when starting a new game, the user is still online

    this.disposed = true;
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

  /**
   * Displays the "New High Score" message
   */
  showHighScoreMessage = () => {
    if (this.highScoreMessageShownThisRun) {
      return; // Don't show the message multiple times in one run
    }

    console.log(`Showing high score message for score: ${this.score}`);

    if (this.highScoreMessageElement) {
      // Show the message
      this.highScoreMessageElement.textContent = "New High Score!";
      this.highScoreMessageElement.style.display = "block";

      // Clear any existing timeout
      if (this.highScoreMessageTimeout) {
        clearTimeout(this.highScoreMessageTimeout);
      }

      // Hide the message after 3 seconds
      this.highScoreMessageTimeout = setTimeout(() => {
        if (this.highScoreMessageElement) {
          this.highScoreMessageElement.style.display = "none";
        }
        this.highScoreMessageTimeout = null;
      }, 3000);

      // Mark that we've shown the message for this run
      this.highScoreMessageShownThisRun = true;
    }
  };

  /**
   * Saves the player's score to the database
   * @returns {Promise<void>}
   */
  saveScore = async () => {
    if (this.isSavingScore || this.score <= 0) {
      return; // Prevent duplicate saves or saving zero scores
    }

    console.log(
      `Attempting to save score: ${this.score} for user: ${this.username}`
    );
    this.isSavingScore = true;

    try {
      // Import the saveScore function from supabaseClient
      const { saveScore, fetchUserHighScore } = await import(
        "../lib/supabaseClient.js"
      );

      if (typeof saveScore !== "function") {
        throw new Error("saveScore function not found in supabaseClient");
      }

      // Save the score to the database
      await saveScore(this.username, this.score);
      console.log("Score saved successfully in Game.js");

      // Fetch the updated high score from the database
      const updatedHighScore = await fetchUserHighScore(this.username);

      // Update our local copy of the high score
      if (updatedHighScore && updatedHighScore > this.userHighScore) {
        this.userHighScore = updatedHighScore;
        console.log(
          `New high score confirmed from database: ${this.userHighScore}`
        );
        this.showHighScoreMessage();
      }

      return this.userHighScore;
    } catch (error) {
      console.error("Failed to save score:", error);
      // Add any UI feedback here if needed
      throw error; // Re-throw so we can handle it in endGame
    } finally {
      this.isSavingScore = false;
    }
  };

  /**
   * Updates the leaderboard in the game over modal
   * @param {Array} scores - Array of score objects
   */
  updateGameOverLeaderboard = (scores) => {
    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      return;
    }

    const leaderboardList = document.querySelector(
      "#gameOverLeaderboard .leaderboard-container ul"
    );
    if (!leaderboardList) return;

    // Clear current entries
    leaderboardList.innerHTML = "";

    // Log scores data to verify is_online field is present
    console.log("Game over leaderboard data:", scores);

    // Add entries for top performers
    scores.forEach((entry, index) => {
      const listItem = document.createElement("li");

      // Create player info container (left-aligned)
      const playerInfo = document.createElement("div");
      playerInfo.className = "player-info";

      // Create online status indicator with proper class
      const onlineIndicator = document.createElement("span");
      // Make sure we're applying the online/offline class properly
      onlineIndicator.className = `online-indicator ${
        entry.is_online ? "online" : "offline"
      }`;

      // Create rank and username span
      const rankAndName = document.createElement("span");
      rankAndName.textContent = `${index + 1}. ${entry.username}`;

      // Create score span (right-aligned)
      const scoreSpan = document.createElement("span");
      scoreSpan.className = "score";
      scoreSpan.textContent = entry.score;

      // Highlight if this is the current user
      if (entry.username === this.username) {
        listItem.classList.add("current-user");
        // Force current user to show as online
        onlineIndicator.className = "online-indicator online";
      }

      // Add elements to player info
      playerInfo.appendChild(onlineIndicator);
      playerInfo.appendChild(rankAndName);

      // Add player info and score to list item
      listItem.appendChild(playerInfo);
      listItem.appendChild(scoreSpan);

      leaderboardList.appendChild(listItem);
    });
  };
}
