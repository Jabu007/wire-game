import { isMobileDevice } from "../config/constants.js";

export class InputHandler {
  constructor(game) {
    this.game = game;

    // Bind methods to ensure 'this' context is correct
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    // Consider adding touch end/move if more complex controls are needed later

    // Add event listeners
    window.addEventListener("keydown", this.handleKeyDown);
    // Use passive: false for touchstart if preventDefault is called
    window.addEventListener("touchstart", this.handleTouchStart, {
      passive: false,
    });

    console.log(
      `Input handler initialized for ${
        isMobileDevice ? "mobile" : "desktop"
      } device.`
    );
  }

  handleKeyDown(event) {
    // If game is over, only listen for restart key
    if (this.game.gameOver) {
      if (event.key === "r" || event.key === "R") {
        console.log("Restarting game via key press...");
        // Pass the current username when resetting
        this.game.reset(this.game.username);
      }
      return; // Ignore other keys when game is over
    }

    // --- Game is active ---
    let moved = false;

    // Handle movement keys
    switch (event.key) {
      case "ArrowLeft":
      case "a":
      case "A":
        moved = this.game.player.moveLeft();
        break;
      case "ArrowRight":
      case "d":
      case "D":
        moved = this.game.player.moveRight();
        break;
      // Add other potential keybinds here if needed
    }

    // Hide instructions on first successful move
    if (
      moved &&
      this.game.instructionsElement &&
      this.game.instructionsElement.style.display !== "none"
    ) {
      console.log("First move detected, hiding instructions.");
      this.game.instructionsElement.style.display = "none";
    }
  }

  handleTouchStart(event) {
    // If game is over, any touch restarts the game
    if (this.game.gameOver) {
      console.log("Restarting game via touch...");
      // Prevent default touch behavior like scrolling/zooming ONLY when restarting
      event.preventDefault();
      // Pass the current username when resetting
      this.game.reset(this.game.username);
      return; // Stop processing touch further
    }

    // --- Game is active ---

    // Ensure there's at least one touch point
    if (event.touches.length === 0) {
      return;
    }

    // Prevent default behavior (like scrolling) during gameplay interaction
    event.preventDefault();

    const touch = event.touches[0];
    const touchX = touch.clientX;
    const screenWidth = window.innerWidth;
    let moved = false;

    // Determine movement based on touch position
    if (touchX < screenWidth / 2) {
      // Touched left half
      moved = this.game.player.moveLeft();
    } else {
      // Touched right half
      moved = this.game.player.moveRight();
    }

    // Hide instructions on first successful move (same logic as keydown)
    if (
      moved &&
      this.game.instructionsElement &&
      this.game.instructionsElement.style.display !== "none"
    ) {
      console.log("First move detected (touch), hiding instructions.");
      this.game.instructionsElement.style.display = "none";
    }
  }

  dispose() {
    console.log("Disposing input listeners.");
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("touchstart", this.handleTouchStart);
  }
}
