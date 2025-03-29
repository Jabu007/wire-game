import { createClient } from "@supabase/supabase-js";

// TODO: Replace with your actual Supabase URL and Anon Key
// It's recommended to use environment variables for these in a real application
// These variables are typically sourced from environment variables in modern web development.
// This requires a build process (like Vite, Webpack, etc.) to correctly inject them.
// Ensure your .env file has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY defined.
// Example using Vite's environment variable handling:
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fallback for environments without a build process or if variables aren't set
// (You might want to remove this fallback or handle it differently in production)
// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://hjvrihhpcgdpzschgkdd.supabase.co";
// const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqdnJpaGhwY2dkcHpzY2hna2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyNzQ2MzcsImV4cCI6MjA1ODg1MDYzN30.tPHDnR3UL0qQdrJc3wizT4nio-0m72sJoocnpExMRtY";

// NOTE: Directly reading .env files from client-side JavaScript in the browser is not possible
// without a build tool due to security restrictions. The code above assumes a build tool
// like Vite is processing your code and making prefixed environment variables available
// via `import.meta.env`. If you are not using a build tool, you cannot directly access
// .env variables this way, and you might need to keep them hardcoded (less secure) or
// use a different configuration method.

// Basic check if variables are loaded (optional but good practice)
if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Supabase URL or Key is missing. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file and Vite is running."
  );
  // Handle the error appropriately - maybe prevent the app from fully initializing
} else if (
  supabaseUrl === "YOUR_SUPABASE_URL" || // Keep checks for placeholder values if needed
  supabaseKey === "YOUR_SUPABASE_ANON_KEY"
) {
  console.warn(
    "Using placeholder Supabase URL or Key. High scores might not work."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- Function to fetch top high scores ---
export const fetchTopHighScores = async (limit = 5) => {
  // Ensure configuration is set
  if (
    supabaseUrl === "YOUR_SUPABASE_URL" ||
    supabaseKey === "YOUR_SUPABASE_ANON_KEY"
  ) {
    console.log("Skipping high score fetch: Supabase not configured.");
    return []; // Return empty array if not configured
  }

  try {
    console.log(`Fetching top ${limit} high scores...`);
    const { data, error } = await supabase
      .from("high_scores")
      .select("username, score") // Select only needed columns
      .order("score", { ascending: false }) // Order by score descending
      .limit(limit); // Limit the number of results

    if (error) {
      console.error("Error fetching high scores:", error);
      return []; // Return empty array on error
    }

    console.log("High scores fetched successfully:", data);
    return data || []; // Return data or empty array if data is null
  } catch (error) {
    console.error(
      "An unexpected error occurred during fetchTopHighScores:",
      error
    );
    return []; // Return empty array on unexpected error
  }
};
// --- End fetch function ---

// Function to save or update the high score
export const saveHighScore = async (username, score) => {
  // Ensure configuration is set
  if (
    supabaseUrl === "YOUR_SUPABASE_URL" ||
    supabaseKey === "YOUR_SUPABASE_ANON_KEY"
  ) {
    console.log("Skipping high score save: Supabase not configured.");
    return;
  }

  // Validate input
  if (
    !username ||
    typeof username !== "string" ||
    username.trim().length === 0
  ) {
    console.error("Invalid username provided for high score saving.");
    return;
  }
  if (typeof score !== "number" || score < 0) {
    console.error("Invalid score provided for high score saving.");
    return;
  }

  const trimmedUsername = username.trim();

  try {
    console.log(
      `Attempting to save score ${score} for user ${trimmedUsername}`
    );

    // 1. Check if the user exists and get their current high score
    const { data: existingData, error: selectError } = await supabase
      .from("high_scores")
      .select("score")
      .eq("username", trimmedUsername)
      .single(); // Use single() as username should be unique

    if (selectError && selectError.code !== "PGRST116") {
      // PGRST116: 'The result contains 0 rows' - This is expected if user is new
      console.error("Error fetching existing high score:", selectError);
      return; // Stop if there's a real error fetching
    }

    // 2. Decide whether to insert or update
    if (existingData) {
      // User exists, check if the new score is higher
      if (score > existingData.score) {
        console.log(
          `New high score! Updating ${trimmedUsername}'s score to ${score}`
        );
        const { error: updateError } = await supabase
          .from("high_scores")
          .update({ score: score })
          .eq("username", trimmedUsername);

        if (updateError) {
          console.error("Error updating high score:", updateError);
        } else {
          console.log("High score updated successfully.");
        }
      } else {
        console.log(
          `Score ${score} is not higher than existing score ${existingData.score}. No update needed.`
        );
      }
    } else {
      // User does not exist, insert new record
      console.log(`New user ${trimmedUsername}. Inserting score ${score}`);
      const { error: insertError } = await supabase
        .from("high_scores")
        .insert({ username: trimmedUsername, score: score });

      if (insertError) {
        console.error("Error inserting new high score:", insertError);
      } else {
        console.log("New high score inserted successfully.");
      }
    }
  } catch (error) {
    console.error("An unexpected error occurred during saveHighScore:", error);
  }
};

// Function to fetch top N high scores for the leaderboard
export const fetchLeaderboard = async (limit = 10) => {
  // Ensure configuration is set
  if (
    supabaseUrl === "YOUR_SUPABASE_URL" ||
    supabaseKey === "YOUR_SUPABASE_ANON_KEY"
  ) {
    console.log("Skipping leaderboard fetch: Supabase not configured.");
    return []; // Return empty array if not configured
  }

  try {
    console.log(`Fetching top ${limit} leaderboard scores...`);
    const { data, error } = await supabase
      .from("high_scores")
      .select("username, score") // Select needed columns
      .order("score", { ascending: false }) // Order by score descending
      .limit(limit); // Limit the number of results

    if (error) {
      console.error("Error fetching leaderboard scores:", error);
      return []; // Return empty array on error
    }

    console.log("Leaderboard scores fetched successfully:", data);
    return data || []; // Return data or empty array if data is null
  } catch (error) {
    console.error(
      "An unexpected error occurred during fetchLeaderboard:",
      error
    );
    return []; // Return empty array on unexpected error
  }
};

// --- Function to fetch a specific user's high score ---
export const fetchUserHighScore = async (username) => {
  if (!username) {
    console.warn("fetchUserHighScore called with no username.");
    return 0; // Return 0 if no username provided
  }
  // Ensure configuration is set (optional, but good practice)
  if (
    supabaseUrl === "YOUR_SUPABASE_URL" ||
    supabaseKey === "YOUR_SUPABASE_ANON_KEY"
  ) {
    console.log("Skipping user high score fetch: Supabase not configured.");
    return 0;
  }

  const trimmedUsername = username.trim(); // Trim username just in case

  try {
    const { data, error } = await supabase
      .from("high_scores") // Corrected table name from "scores" to "high_scores"
      .select("score")
      .eq("username", trimmedUsername) // Use trimmed username for lookup
      .order("score", { ascending: false }) // Get the highest score first
      .limit(1); // We only need the top one

    if (error && error.code !== "PGRST116") {
      // PGRST116 means 0 rows found, which is not an error in this context
      console.error("Error fetching user high score:", error.message);
      return 0; // Return 0 on actual error
    }

    if (data && data.length > 0) {
      console.log(
        `Fetched high score for ${trimmedUsername}: ${data[0].score}`
      );
      return data[0].score; // Return the highest score found
    } else {
      console.log(`No previous high score found for ${trimmedUsername}.`);
      return 0; // Return 0 if no score exists for the user
    }
  } catch (err) {
    console.error("Unexpected error in fetchUserHighScore:", err);
    return 0; // Return 0 on unexpected errors
  }
};
// --- End fetch user high score function ---
