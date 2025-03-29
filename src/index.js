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
const MUTE_STORAGE_KEY = "wireframeRunnerMuted"; // Key for mute state

// --- Get UI elements ---
const usernameOverlay = document.getElementById("usernameOverlay");
const usernameInput = document.getElementById("usernameInput");
const startButton = document.getElementById("startButton");
const usernameError = document.getElementById("usernameError");
const gameUi = document.getElementById("gameUi"); // Get the game UI container
const leaderboardElement = document.getElementById("leaderboard"); // Get leaderboard element
const currentUsernameElement = document.getElementById("currentUsername"); // Get username display element
// --- Add Audio Elements ---
const backgroundMusic = document.getElementById("backgroundMusic");
const muteButton = document.getElementById("muteButton");
// --- End Audio Elements ---

console.log("index.js: Start button element:", startButton);
console.log("index.js: Leaderboard element:", leaderboardElement); // Check if found
console.log("index.js: Current Username element:", currentUsernameElement); // Check if found
// --- Add Audio Element Logs ---
console.log("index.js: Background Music element:", backgroundMusic);
console.log("index.js: Mute Button element:", muteButton);
// --- End Audio Element Logs ---

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

// --- Function to handle Mute Toggle ---
const handleMuteToggle = () => {
  if (!backgroundMusic || !muteButton) return;

  const isMuted = backgroundMusic.muted;
  backgroundMusic.muted = !isMuted;
  muteButton.textContent = backgroundMusic.muted ? "Unmute" : "Mute";
  muteButton.setAttribute(
    "aria-label",
    backgroundMusic.muted ? "Unmute Background Music" : "Mute Background Music"
  );
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, backgroundMusic.muted.toString()); // Store as string
  } catch (error) {
    console.error("Error saving mute state to localStorage:", error);
  }
};
// --- End Mute Toggle Function ---

// --- Function to start the game ---
const handleStartGame = async () => {
  const username = elements.usernameInput.value.trim();
  if (!username || username.length > 20) {
    elements.usernameError.textContent = !username
      ? "Please enter a username."
      : "Username max 20 characters.";
    return;
  }

  // --- MODIFICATION START ---
  // Enhanced Audio Playback Logic & Logging
  console.log("handleStartGame: Attempting to handle background music...");
  if (backgroundMusic) {
    console.log(
      `Audio State Before Play Attempt: muted=${backgroundMusic.muted}, paused=${backgroundMusic.paused}, readyState=${backgroundMusic.readyState}, src=${backgroundMusic.currentSrc}`
    );

    if (!backgroundMusic.muted) {
      try {
        // Check if already playing
        if (!backgroundMusic.paused) {
          console.log("Background music is already playing.");
        }
        // Check if ready to play (or potentially ready soon)
        else if (backgroundMusic.readyState >= 3) {
          // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
          console.log("Attempting to play background music...");
          await backgroundMusic.play();
          console.log("Background music playback initiated successfully.");
        } else {
          console.warn(
            `Background music not ready (readyState: ${backgroundMusic.readyState}). Adding 'canplaythrough' listener as fallback.`
          );
          // Add a one-time listener to play when ready
          backgroundMusic.addEventListener(
            "canplaythrough",
            async () => {
              // Double-check conditions before playing in the listener
              if (!backgroundMusic.muted && backgroundMusic.paused) {
                console.log(
                  "Playing background music via 'canplaythrough' listener..."
                );
                try {
                  await backgroundMusic.play();
                  console.log(
                    "Background music playback initiated successfully via listener."
                  );
                } catch (listenerError) {
                  console.error(
                    "Delayed play via listener failed:",
                    listenerError
                  );
                }
              } else {
                console.log(
                  "Conditions not met for playing in 'canplaythrough' listener (muted/already playing)."
                );
              }
            },
            { once: true } // Ensure listener runs only once
          );
          // Also listen for general errors loading the audio file
          backgroundMusic.addEventListener(
            "error",
            (e) => {
              console.error(
                "Audio element error event:",
                e,
                backgroundMusic.error
              );
            },
            { once: true }
          );
        }
      } catch (error) {
        console.error(
          "Audio play() promise failed. This often indicates browser restrictions or file issues.",
          error // Log the specific error object
        );
        // Update UI to reflect failure
        if (!backgroundMusic.muted) {
          muteButton.textContent = "Unmute";
          muteButton.setAttribute(
            "aria-label",
            "Unmute Background Music (Playback Failed)"
          );
          // Don't automatically mute, let user decide, but reflect state
          // localStorage.setItem(MUTE_STORAGE_KEY, "true");
        }
      }
    } else {
      console.log("Background music is muted, not attempting to play.");
    }
  } else {
    console.error("handleStartGame: Background music element not found!");
  }
  // --- MODIFICATION END ---

  elements.usernameError.textContent = ""; // Clear error
  currentUsername = username;
  localStorage.setItem(USERNAME_STORAGE_KEY, currentUsername); // Save username

  // Set user online status to true
  try {
    await updateUserOnlineStatus(currentUsername, true);
    await updateLeaderboard();
  } catch (error) {
    console.error("Failed to set user online status before game start:", error);
  }

  // Fetch user's high score
  let userHighScore = 0;
  try {
    userHighScore = await fetchUserHighScore(currentUsername);
  } catch (error) {
    console.error("Failed to fetch user high score:", error);
  }

  elements.usernameOverlay.style.display = "none";
  elements.gameUiElement.style.display = "block";
  elements.currentUsernameElement.textContent = `User: ${currentUsername}`;

  // Dispose previous game if exists
  if (currentGame) {
    currentGame.dispose();
  }

  // Create and start a new game instance
  currentGame = new Game(currentUsername, userHighScore, updateLeaderboard);
};

// --- Event Listeners ---
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

// --- Add Mute Button Listener ---
if (muteButton) {
  muteButton.addEventListener("click", handleMuteToggle);
} else {
  console.error("index.js: Could not find mute button element.");
}
// --- End Mute Button Listener ---

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

// --- Initialize Mute State from Local Storage ---
if (backgroundMusic && muteButton) {
  try {
    const savedMuteState = localStorage.getItem(MUTE_STORAGE_KEY) === "true"; // Compare with 'true' string
    backgroundMusic.muted = savedMuteState;
    muteButton.textContent = savedMuteState ? "Unmute" : "Mute";
    muteButton.setAttribute(
      "aria-label",
      savedMuteState ? "Unmute Background Music" : "Mute Background Music"
    );
    console.log(`Initial mute state set to: ${savedMuteState}`);
  } catch (error) {
    console.error("Error reading mute state from localStorage:", error);
    // Default to not muted if error occurs
    backgroundMusic.muted = false;
    muteButton.textContent = "Mute";
    muteButton.setAttribute("aria-label", "Mute Background Music");
  }
}
// --- End Initialize Mute State ---

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

  // Pause music on unload (optional, as browser tab closing usually stops it)
  if (backgroundMusic) {
    backgroundMusic.pause();
  }
});
// --- End Cleanup ---
