import "dotenv/config";
import { writeUserData, removeCast, writeCast } from "../lib/farcaster";
import { UserDataType } from "@farcaster/core";

interface ProfileUpdateOptions {
  display?: string;
  pfp?: string;
  username?: string;
  bio?: string;
}

async function updateProfile(options: ProfileUpdateOptions) {
  try {
    if (options.display) {
      console.log("Updating display name...");
      const displayNameResponse = await writeUserData({
        type: UserDataType.DISPLAY,
        value: options.display,
      });
      console.log("Display name updated:", displayNameResponse);
    }

    if (options.pfp) {
      console.log("Updating profile image...");
      const profileImageResponse = await writeUserData({
        type: UserDataType.PFP,
        value: options.pfp,
      });
      console.log("Profile image updated:", profileImageResponse);
    }

    if (options.username) {
      console.log("Updating username...");
      const usernameResponse = await writeUserData({
        type: UserDataType.USERNAME,
        value: options.username,
      });
      console.log("Username updated:", usernameResponse);
    }

    if (options.bio) {
      console.log("Updating bio...");
      const bioResponse = await writeUserData({
        type: UserDataType.BIO,
        value: options.bio,
      });
      console.log("Bio updated:", bioResponse);
    }

    console.log("Profile update completed successfully!");
  } catch (error) {
    console.error("Error updating profile:", error);
  }
}

function parseArguments(args: string[]): ProfileUpdateOptions {
  const options: ProfileUpdateOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const firstEquals = arg.indexOf("=");
    if (firstEquals === -1) continue;

    const key = arg.slice(0, firstEquals);
    const value = arg.slice(firstEquals + 1);

    switch (key) {
      case "display":
        options.display = value;
        break;
      case "pfp":
        options.pfp = value;
        break;
      case "username":
        options.username = value;
        break;
      case "bio":
        options.bio = value;
        break;
      default:
        console.warn(`Unknown option: ${key}`);
    }
  }

  return options;
}

async function removeCastById(castId: string) {
  try {
    console.log("Removing cast...", castId);
    const removeResponse = await removeCast(castId as `0x${string}`);
    console.log("Cast removed:", removeResponse);
  } catch (error) {
    console.error("Error removing cast:", error);
  }
}

async function writeCastWithEmbed(text: string, embedUrls: string[] = []) {
  try {
    console.log("Writing cast...");
    const response = await writeCast({
      segments: [text],
      embedUrls,
    });
    console.log("Cast published:", response);
  } catch (error) {
    console.error("Error publishing cast:", error);
  }
}

// Check if the script is being run directly
if (require.main === module) {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case "update-profile":
      const options = parseArguments(args);
      if (Object.keys(options).length === 0) {
        console.error(
          'Usage: tsx script.ts update-profile [display="Sample Name"] [pfp="https://..."] [username="samplename"] [bio="Your bio here"]'
        );
        process.exit(1);
      }
      updateProfile(options);
      break;

    case "remove-cast":
      if (args.length !== 1) {
        console.error("Usage: tsx script.ts remove-cast <castId>");
        process.exit(1);
      }
      removeCastById(args[0]);
      break;

    case "write-cast":
      if (args.length < 1) {
        console.error(
          'Usage: tsx script.ts write-cast "Your cast text" [embed1,embed2,...]'
        );
        process.exit(1);
      }
      const castText = args[0];
      const embedUrls = args[1] ? args[1].split(",") : [];
      writeCastWithEmbed(castText, embedUrls);
      break;

    default:
      console.error(
        "Unknown command. Use 'update-profile', 'remove-cast', or 'write-cast'."
      );
      process.exit(1);
  }
}

export { updateProfile, removeCastById, writeCastWithEmbed };
