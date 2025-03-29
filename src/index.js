import { Game } from "./engine/Game.js";
import {
  fetchLeaderboard,
  fetchUserHighScore,
  subscribeToLeaderboardChanges,
  unsubscribeFromLeaderboard,
  updateUserOnlineStatus,
} from "./lib/supabaseClient.js";
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
let leaderboardChannel = null;

const elements = getElements();

// --- Leaderboard Update Function ---
const updateLeaderboard = async () => {
  if (!leaderboardElement) {
    console.error("Leaderboard element not found, cannot update.");
    return;
  }
  leaderboardElement.innerHTML = "<li>Loading scores...</li>"; // Use list item for consistency

  try {
    const topScores = await fetchLeaderboard(5); // Fetch top 5 scores including online status

    if (topScores && topScores.length > 0) {
      let leaderboardHTML = "<strong>Top Scores:</strong><ul>"; // Start with a title and unordered list
      topScores.forEach((entry, index) => {
        // Sanitize username display
        const safeUsername = entry.username
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        // Add online status indicator
        const onlineIndicator = entry.is_online
          ? '<span class="online-indicator" aria-label="Online"></span>'
          : '<span class="offline-indicator" aria-label="Offline"></span>'; // Use a different class or style for offline if needed

        leaderboardHTML += `<li>${onlineIndicator} ${
          index + 1
        }. ${safeUsername} - ${entry.score}</li>`;
      });
      leaderboardHTML += "</ul>"; // Close the list
      leaderboardElement.innerHTML = leaderboardHTML;
    } else {
      leaderboardElement.innerHTML = "<ul><li>No high scores yet.</li></ul>";
    }
  } catch (error) {
    console.error("Failed to update leaderboard:", error);
    leaderboardElement.innerHTML = "<ul><li>Error loading scores.</li></ul>";
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

  // Set user online status to true *before* fetching high score or starting game
  try {
    await updateUserOnlineStatus(currentUsername, true);
    await updateLeaderboard();
  } catch (error) {
    console.error("Failed to set user online status before game start:", error);
    // Decide if you want to block game start or just log the error
    // Potentially show an error to the user here
  }

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

  // Initial leaderboard load might be slightly delayed if status update takes time
  // The subscription should catch up quickly.
  // updateLeaderboard(); // Call if immediate update is desired, though subscription handles it
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

// --- Initial Leaderboard Load & Subscription ---
console.log("index.js: Performing initial leaderboard load...");
updateLeaderboard(); // Load the leaderboard initially

console.log("index.js: Subscribing to real-time leaderboard updates...");
// Subscribe to changes and store the channel
leaderboardChannel = subscribeToLeaderboardChanges(updateLeaderboard);

// --- Cleanup Subscription on Page Unload ---
window.addEventListener("beforeunload", () => {
  console.log("index.js: Unsubscribing from leaderboard before page unload...");
  unsubscribeFromLeaderboard(leaderboardChannel);

  // Attempt to set user offline status before unload
  if (currentUsername) {
    console.log("index.js: Attempting to set user offline before unload...");
    // Note: synchronous XHR/fetch is deprecated and unreliable here.
    // navigator.sendBeacon might be an option, but Supabase client uses async.
    // This async call is *not guaranteed* to complete.
    updateUserOnlineStatus(currentUsername, false).catch((err) => {
      console.warn(
        "Failed to set user offline before unload (may not complete):",
        err
      );
    });
  }

  // Also dispose the game if it's running
  if (currentGame) {
    console.log("index.js: Disposing game before page unload...");
    currentGame.dispose(); // This also attempts to set offline status
  }
});
// --- End Cleanup ---
