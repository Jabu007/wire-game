import { Game } from "./engine/Game.js";
import { fetchLeaderboard, fetchUserHighScore } from "./lib/supabaseClient.js";
import { getElements } from "./config/constants.js";

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

let currentGame = null;
let currentUsername = localStorage.getItem(USERNAME_STORAGE_KEY) || "";

const elements = getElements();

// --- Leaderboard Update Function ---
const updateLeaderboard = async () => {
  if (!leaderboardElement) {
    console.error("Leaderboard element not found, cannot update.");
    return;
  }
  leaderboardElement.innerHTML = "Loading scores..."; // Show loading state

  try {
    const topScores = await fetchLeaderboard(5); // Fetch top 5 scores

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
const handleStartGame = async () => {
  const username = elements.usernameInput.value.trim();
  if (!username) {
    elements.usernameError.textContent = "Please enter a username.";
    return;
  }
  if (username.length > 20) {
    elements.usernameError.textContent = "Username max 20 characters.";
    return;
  }

  elements.usernameError.textContent = ""; // Clear error
  currentUsername = username;
  localStorage.setItem(USERNAME_STORAGE_KEY, currentUsername); // Save username

  // --- Fetch user's high score BEFORE starting ---
  let userHighScore = 0;
  try {
    userHighScore = await fetchUserHighScore(currentUsername);
  } catch (error) {
    console.error("Failed to fetch user high score:", error);
    // Proceed with high score 0 if fetch fails
  }
  // --- End fetch ---

  elements.usernameOverlay.style.display = "none"; // Hide overlay
  elements.gameUiElement.style.display = "block"; // Show game UI
  elements.currentUsernameElement.textContent = `User: ${currentUsername}`;

  // Dispose previous game if exists
  if (currentGame) {
    currentGame.dispose();
  }

  // Create and start a new game instance, passing the high score
  currentGame = new Game(
    currentUsername,
    userHighScore, // Pass the fetched high score
    updateLeaderboard // Pass the callback for when score is saved
  );

  // Initial leaderboard load
  updateLeaderboard();
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
