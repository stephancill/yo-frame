export const CHALLENGE_DURATION_SECONDS = 60;
export const AUTH_SESSION_COOKIE_NAME = "auth_session";

// Jobs that send notifications to users in bulk
export const NOTIFICATIONS_BULK_QUEUE_NAME = "notifications-bulk";

export const ONCHAIN_MESSAGE_QUEUE_NAME = "onchain-message";

export const YO_TOKEN_ADDRESS =
  "0xb55bfc6e66a1b81bf0a92fb177a13e2e54e118e1" as const;

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
