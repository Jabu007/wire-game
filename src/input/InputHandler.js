import { isMobileDevice } from "../config/constants.js";

export class InputHandler {
  constructor(game) {
    this.game = game;

    // Bind methods
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);

    // Add event listeners
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("touchstart", this.handleTouchStart, {
      passive: false,
    });

    console.log(
      `Input handler initialized for ${
        isMobileDevice ? "mobile" : "desktop"
      } device`
    );
  }

  handleKeyDown(event) {
    if (this.game.gameOver) {
      // Restart the game with R key
      if (event.key === "r" || event.key === "R") {
        this.game.reset();
      }
      return;
    }

    let moved = false;

    // Handle movement
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      moved = this.game.player.moveLeft();
    } else if (
      event.key === "ArrowRight" ||
      event.key === "d" ||
      event.key === "D"
    ) {
      moved = this.game.player.moveRight();
    }

    // Hide instructions when player first moves
    if (
      moved &&
      this.game.instructionsElement &&
      this.game.instructionsElement.style.display !== "none"
    ) {
      this.game.instructionsElement.style.display = "none";
    }
  }

  handleTouchStart(event) {
    if (this.game.gameOver) {
      // Allow restart on touch when game is over
      this.game.reset();
      return;
    }

    // Prevent default behavior to avoid scrolling/zooming
    event.preventDefault();

    // Get the touch position
    const touch = event.touches[0];
    const touchX = touch.clientX;
    const screenWidth = window.innerWidth;

    let moved = false;

    // Determine if touch is on left or right side of screen
    if (touchX < screenWidth / 2) {
      // Left side - move left if possible
      moved = this.game.player.moveLeft();
    } else {
      // Right side - move right if possible
      moved = this.game.player.moveRight();
    }

    // Hide instructions when player first moves
    if (
      moved &&
      this.game.instructionsElement &&
      this.game.instructionsElement.style.display !== "none"
    ) {
      this.game.instructionsElement.style.display = "none";
    }
  }

  dispose() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("touchstart", this.handleTouchStart);
  }
}
