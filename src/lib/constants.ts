export const CHALLENGE_DURATION_SECONDS = 60;
export const AUTH_SESSION_COOKIE_NAME = "auth_session";

// Jobs that send notifications to users in bulk
export const NOTIFICATIONS_BULK_QUEUE_NAME = "notifications-bulk";

export const ONCHAIN_MESSAGE_QUEUE_NAME = "onchain-message";

// export const YO_TOKEN_ADDRESS =
//   "0xbaffb83fe773aef4b6dbbaa9fe3b3c521fecbab9" as const;

export const YO_TOKEN_ADDRESS =
  "0x1bEfE2d8417e22Da2E0432560ef9B2aB68Ab75Ad" as const;

export const FRAME_METADATA = {
  version: "next",
  imageUrl: `${process.env.APP_URL}/og.png`,
  button: {
    title: "Yo",
    action: {
      type: "launch_frame",
      name: "Launch Yo",
      url: `${process.env.APP_URL}`,
      splashImageUrl: `${process.env.APP_URL}/splash.png`,
      splashBackgroundColor: "#361B54",
    },
  },
};
