import { Game } from "./engine/Game.js";

// Check for WebGL support before starting
if (!window.WebGLRenderingContext) {
  console.error("WebGL is not supported or not enabled.");
  document.body.innerHTML = `<div style="color: orange; font-family: sans-serif; padding: 20px;">
    Sorry, WebGL is required to run this game. Please check your browser settings or update your browser/graphics drivers.
  </div>`;
} else {
  console.log("WebGL available. Starting game...");
  const game = new Game();

  // Export game instance to window for debugging
  window.game = game;
}
