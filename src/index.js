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

// Add the missing getScores function
/**
 * Fetches scores from the leaderboard
 * @returns {Promise<Array>} Array of score objects
 */
const getScores = async () => {
  try {
    const scores = await fetchLeaderboard();
    return scores || [];
  } catch (error) {
    console.error("Error fetching scores:", error);
    return []; // Return empty array on error
  }
};

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
/**
 * Fetches scores and updates the leaderboard UI.
 * @param {number | null} [limit=3] - Max scores to display. Shows all if null or 0.
 * @param {number} [currentScore=0] - The player's current score for contextual display.
 * @param {boolean} [isGameOver=false] - Whether this is being called from game over screen.
 */
const updateLeaderboard = async (
  limit = 3,
  currentScore = 0,
  isGameOver = false
) => {
  const leaderboardElement = isGameOver
    ? document.querySelector("#gameOverLeaderboard .leaderboard-container ul")
    : document.querySelector("#leaderboard ul");

  if (!leaderboardElement) {
    console.error("Leaderboard element not found, cannot update.");
    return;
  }

  try {
    // Show loading state
    leaderboardElement.innerHTML = "<li>Loading scores...</li>";

    // Fetch scores from the database
    const scores = await getScores();

    if (!scores || scores.length === 0) {
      leaderboardElement.innerHTML = "<li>No scores yet!</li>";
      return;
    }

    // Sort scores by score (highest first)
    scores.sort((a, b) => b.score - a.score);

    // Create HTML for the leaderboard
    let html = "";

    if (isGameOver || limit === 0) {
      // For game over screen or when showing all scores
      displayAllScores(
        scores,
        html,
        leaderboardElement,
        currentUsername,
        currentScore
      );
    } else {
      // For in-game leaderboard, show context (player above and below)
      displayContextScores(
        scores,
        html,
        leaderboardElement,
        currentUsername,
        currentScore,
        limit
      );
    }
  } catch (error) {
    console.error("Error updating leaderboard:", error);
    leaderboardElement.innerHTML = "<li>Error loading scores</li>";
  }
};

// Helper function to display all scores (for game over screen)
const displayAllScores = (
  scores,
  html,
  leaderboardElement,
  username,
  currentScore
) => {
  scores.forEach((score, index) => {
    const isCurrentPlayer = score.username === username;
    const position = index + 1;

    html += `<li class="${isCurrentPlayer ? "current-player" : ""}">
      ${position}. ${score.username} - ${score.score}
    </li>`;
  });

  leaderboardElement.innerHTML = html;
};

// Helper function to display context scores (player above and below)
const displayContextScores = (
  scores,
  html,
  leaderboardElement,
  username,
  currentScore,
  limit
) => {
  // Find current player's position
  let currentPlayerIndex = scores.findIndex((s) => s.username === username);

  // If player not found in scores but has a current score
  if (currentPlayerIndex === -1 && username && currentScore > 0) {
    // Find where the current score would rank
    currentPlayerIndex = scores.findIndex((s) => s.score < currentScore);
    if (currentPlayerIndex === -1) currentPlayerIndex = scores.length;

    // Create a temporary score object for the current player
    const tempPlayerScore = { username, score: currentScore };

    // Insert the temporary player score at the correct position
    scores.splice(currentPlayerIndex, 0, tempPlayerScore);
  }

  // If player is in the scores, show context
  if (currentPlayerIndex !== -1) {
    // Calculate start and end indices to show player in context
    let startIndex = Math.max(0, currentPlayerIndex - 1);
    let endIndex = Math.min(scores.length - 1, currentPlayerIndex + 1);

    // Ensure we show at least 'limit' scores if possible
    while (
      endIndex - startIndex + 1 < limit &&
      (startIndex > 0 || endIndex < scores.length - 1)
    ) {
      if (startIndex > 0) startIndex--;
      if (endIndex - startIndex + 1 < limit && endIndex < scores.length - 1)
        endIndex++;
    }

    // Display the scores in the calculated range
    for (let i = startIndex; i <= endIndex; i++) {
      const score = scores[i];
      const isCurrentPlayer = i === currentPlayerIndex;
      const position = i + 1;

      // Wrap the entire content in a span to ensure the whole line is highlighted
      html += `<li class="${isCurrentPlayer ? "current-player-highlight" : ""}">
        ${position}. ${score.username} - ${score.score}
      </li>`;
    }
  } else {
    // If player not found, just show top scores
    const displayScores = scores.slice(0, limit);

    displayScores.forEach((score, index) => {
      const isCurrentPlayer = score.username === username;
      const position = index + 1;
      html += `<li class="${
        isCurrentPlayer ? "current-player-highlight" : ""
      }">${position}. ${score.username} - ${score.score}</li>`;
    });
  }

  leaderboardElement.innerHTML = html;
};
// --- End Leaderboard Update Function ---

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

    // Check if NOT muted *before* attempting play
    if (!backgroundMusic.muted) {
      console.log("Audio is not muted. Proceeding with play attempt."); // Added log
      try {
        // Check if ready to play (or potentially ready soon)
        // HAVE_METADATA (1) might be enough sometimes, but HAVE_FUTURE_DATA (3) is safer
        if (backgroundMusic.readyState >= 1) {
          console.log(
            `Attempting to play background music (readyState: ${backgroundMusic.readyState})...`
          );
          // The play() method returns a Promise
          await backgroundMusic.play();
          console.log(
            "Background music playback initiated successfully (Promise resolved)."
          );
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
                "Audio element reported an error event:", // More specific log
                e,
                backgroundMusic.error // Log the error object associated with the element
              );
            },
            { once: true }
          );
        }
      } catch (error) {
        console.error(
          "Audio play() promise was rejected. This often indicates browser restrictions, file issues, or the element not being ready.",
          error // Log the specific error object
        );
        // Update UI to reflect failure - maybe the mute button state is wrong?
        if (!backgroundMusic.muted) {
          // Consider if UI update is needed here. The existing mute button logic seems okay.
          console.warn(
            "Playback failed, but audio wasn't muted. Check browser console for details."
          );
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

  // Set user online status to true and update leaderboard (shows top 5 initially)
  try {
    await updateUserOnlineStatus(currentUsername, true);
    await updateLeaderboard(); // Initial update uses default limit (5)
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
  elements.currentUsernameElement.textContent = `${currentUsername}`;

  // Dispose previous game if exists
  if (currentGame) {
    currentGame.dispose();
  }

  // Create and start a new game instance, passing the leaderboard update function
  currentGame = new Game(currentUsername, userHighScore, updateLeaderboard); // Pass the function
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
const initializeMuteState = () => {
  if (!backgroundMusic || !muteButton) return;

  // Check if muted state is stored
  const isMuted = localStorage.getItem(MUTE_STORAGE_KEY) === "true";

  // Set initial state
  backgroundMusic.muted = isMuted;

  // Update button display
  const volumeIcon = muteButton.querySelector(".volume-icon");
  const muteIcon = muteButton.querySelector(".mute-icon");

  if (isMuted) {
    volumeIcon.style.display = "none";
    muteIcon.style.display = "block";
  } else {
    volumeIcon.style.display = "block";
    muteIcon.style.display = "none";
  }

  // Add click handler
  muteButton.addEventListener("click", () => {
    backgroundMusic.muted = !backgroundMusic.muted;

    // Toggle icon display
    if (backgroundMusic.muted) {
      volumeIcon.style.display = "none";
      muteIcon.style.display = "block";
    } else {
      volumeIcon.style.display = "block";
      muteIcon.style.display = "none";
    }

    // Save state
    localStorage.setItem(MUTE_STORAGE_KEY, backgroundMusic.muted);
    console.log(`Music ${backgroundMusic.muted ? "muted" : "unmuted"}`);
  });
};

// --- Initial Leaderboard Load & Subscription ---
console.log("index.js: Performing initial leaderboard load...");
updateLeaderboard(); // Load the top 5 leaderboard initially

console.log("index.js: Subscribing to real-time leaderboard updates...");
// Subscribe to changes and store the channel
// The callback will update using the default limit (top 5)
leaderboardChannel = subscribeToLeaderboardChanges(() => updateLeaderboard());

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

// --- Call the initialization function ---
// Initialize mute state and button
initializeMuteState();
