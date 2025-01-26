import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://0395f0dc8beae7cf5bc13e3883fac5c8@o4508646951747584.ingest.us.sentry.io/4508646952796162",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  enabled: process.env.NODE_ENV === "production",
});

import { initExpressApp } from "../lib/bullboard";

export { notificationsBulkWorker } from "./notifications";
export { onchainMessageWorker } from "./onchain";

// Run bull board
initExpressApp();
