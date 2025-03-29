import { createClient } from "@supabase/supabase-js";

// TODO: Replace with your actual Supabase URL and Anon Key
// It's recommended to use environment variables for these in a real application
const supabaseUrl = "https://hjvrihhpcgdpzschgkdd.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqdnJpaGhwY2dkcHpzY2hna2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyNzQ2MzcsImV4cCI6MjA1ODg1MDYzN30.tPHDnR3UL0qQdrJc3wizT4nio-0m72sJoocnpExMRtY";

// Basic check if placeholder values are still present
if (
  supabaseUrl === "YOUR_SUPABASE_URL" ||
  supabaseKey === "YOUR_SUPABASE_ANON_KEY"
) {
  console.warn(
    "Supabase URL or Key not configured in src/lib/supabaseClient.js. High scores will not be saved."
  );
  // Provide a mock client or null to prevent errors if not configured
  // For this example, we'll allow it to proceed but saving will fail.
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
