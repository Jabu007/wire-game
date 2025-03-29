import { Game } from "./engine/Game.js";
import { fetchTopHighScores } from "./lib/supabaseClient.js";

console.log("index.js: Script loaded.");

// --- Constants ---
const USERNAME_STORAGE_KEY = "wireframeRunnerUsername"; // Key for localStorage

// --- Get UI elements ---
const usernameOverlay = document.getElementById("usernameOverlay");
const usernameInput = document.getElementById("usernameInput");
const startButton = document.getElementById("startButton");
const usernameError = document.getElementById("usernameError");
const gameUi = document.getElementById("gameUi"); // Get the game UI container
const leaderboardElement = document.getElementById("leaderboard"); // Get leaderboard element
const currentUsernameElement = document.getElementById("currentUsername"); // Get username display element

console.log("index.js: Start button element:", startButton);
console.log("index.js: Leaderboard element:", leaderboardElement); // Check if found
console.log("index.js: Current Username element:", currentUsernameElement); // Check if found

let gameInstance = null; // Hold the game instance

// --- Leaderboard Update Function ---
const updateLeaderboard = async () => {
  if (!leaderboardElement) {
    console.error("Leaderboard element not found, cannot update.");
    return;
  }
  leaderboardElement.innerHTML = "Loading scores..."; // Show loading state

  try {
    const topScores = await fetchTopHighScores(5); // Fetch top 5 scores

    if (topScores && topScores.length > 0) {
      let leaderboardHTML = "<strong>Top Scores:</strong><br>"; // Start with a title
      topScores.forEach((entry, index) => {
        // Sanitize username display (optional but good practice)
        const safeUsername = entry.username
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        leaderboardHTML += `${index + 1}. ${safeUsername} - ${entry.score}<br>`;
      });
      leaderboardElement.innerHTML = leaderboardHTML;
    } else {
      leaderboardElement.innerHTML = "No high scores yet.";
    }
  } catch (error) {
    console.error("Failed to update leaderboard:", error);
    leaderboardElement.innerHTML = "Error loading scores.";
  }
};
// --- End Leaderboard Update Function ---

// --- Function to start the game ---
const handleStartGame = () => {
  console.log("handleStartGame");
  const username = usernameInput.value.trim();

  if (!username) {
    usernameError.textContent = "Username cannot be empty.";
    usernameInput.style.borderColor = "#ff4444"; // Indicate error
    return;
  }

  // Basic validation (you can add more complex rules)
  if (username.length > 20) {
    usernameError.textContent = "Username max 20 characters.";
    usernameInput.style.borderColor = "#ff4444";
    return;
  }

  // Clear error and reset style
  usernameError.textContent = "";
  usernameInput.style.borderColor = "#00ffff";

  // --- Save username to localStorage on successful start ---
  try {
    localStorage.setItem(USERNAME_STORAGE_KEY, username);
    console.log(`Username "${username}" saved to localStorage.`);
  } catch (error) {
    console.error("Error saving username to localStorage:", error);
    // Non-critical error, game can still proceed
  }
  // --- End save username ---

  console.log(`Starting game for user: ${username}`);

  // --- Update username display ---
  if (currentUsernameElement) {
    // Sanitize display
    const safeUsername = username.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // Remove the "User: " prefix
    currentUsernameElement.textContent = safeUsername;
  } else {
    console.warn("Current username display element not found.");
  }
  // --- End update username display ---

  // Hide overlay and show game UI
  usernameOverlay.style.display = "none";
  gameUi.style.display = "block"; // Show the game UI

  // --- Update leaderboard when game UI becomes visible ---
  updateLeaderboard();
  // ---

  // Check for WebGL support before starting
  if (!window.WebGLRenderingContext) {
    console.error("WebGL is not supported or not enabled.");
    // Display error within the game area if possible, or fallback
    document.body.innerHTML = `<div style="color: orange; font-family: sans-serif; padding: 20px;">
      Sorry, WebGL is required to run this game. Please check your browser settings or update your browser/graphics drivers.
    </div>`;
    return; // Stop execution
  }

  console.log("WebGL available. Initializing game...");
  // Create and start the game, passing the username AND the callback
  if (!gameInstance) {
    // Pass updateLeaderboard as the callback
    gameInstance = new Game(username, updateLeaderboard);
    window.game = gameInstance; // Optional: for debugging
  } else {
    // If restarting after game over, just reset
    gameInstance.reset(username); // Reset logic handles restart
    // Leaderboard will be updated via the callback when the *next* game ends
  }
};

// --- Add event listeners ---
if (startButton) {
  console.log("index.js: Attaching click listener to start button...");
  startButton.addEventListener("click", handleStartGame);
} else {
  console.error(
    "index.js: Could not find start button element to attach listener."
  );
}

// Allow pressing Enter in the input field to start the game
if (usernameInput) {
  usernameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleStartGame();
    }
  });
} else {
  console.error("index.js: Could not find username input element.");
}

// --- Check for saved username on load ---
if (usernameInput) {
  try {
    const savedUsername = localStorage.getItem(USERNAME_STORAGE_KEY);
    if (savedUsername) {
      console.log(`Found saved username: "${savedUsername}"`);
      usernameInput.value = savedUsername;
    } else {
      console.log("No saved username found in localStorage.");
    }
  } catch (error) {
    console.error("Error reading username from localStorage:", error);
  }
  // Initial focus on the input field regardless of whether username was loaded
  usernameInput.focus();
}
// --- End check for saved username ---
