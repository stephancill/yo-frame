import { FRAME_METADATA } from "../../../lib/constants";

export async function GET() {
  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    throw new Error("APP_URL is not set");
  }

  const config = {
    accountAssociation: accountAssociations[appUrl],
    frame: {
      version: "1",
      name: `Yo${process.env.NODE_ENV === "development" ? " (dev)" : ""}`,
      iconUrl: `${appUrl}/icon.png`,
      homeUrl: appUrl,
      imageUrl: FRAME_METADATA.imageUrl,
      buttonTitle: FRAME_METADATA.button.title,
      splashImageUrl: FRAME_METADATA.button.action.splashImageUrl,
      splashBackgroundColor: FRAME_METADATA.button.action.splashBackgroundColor,
      webhookUrl: `${appUrl}/api/webhooks/farcaster`,
    },
  };

  return Response.json(config);
}

/** Domain associations for different environments. Default is signed by @stephancill and is valid for localhost */
const accountAssociations = {
  "https://yo.steer.fun": {
    header:
      "eyJmaWQiOjE2ODksInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHgyNzM4QjIxY0I5NTIwMzM4RjlBMzc1YzNiOTcxQjE3NzhhZTEwMDRhIn0",
    payload: "eyJkb21haW4iOiJ5by5zdGVlci5mdW4ifQ",
    signature:
      "MHhjODdlOGNhZGIxMDZmYjFmNTU5NjMyNDFhMDFkMmM5N2YwM2FlOTlhYWRlMDBiNmY2YjYyZjZkNmYzNzEwMzM4MTZjMjZmMjc5N2EyYzVmMDIwMDJmNmVlMTQ0Y2VkNWYyNjg1ZTU1NmQxNjNmZjA5ZWFmMDE5MDljZDU4ZDBjNzFi",
  },
  "https://9b8f-102-135-241-214.ngrok-free.app": {
    header:
      "eyJmaWQiOjE2ODksInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHgyNzM4QjIxY0I5NTIwMzM4RjlBMzc1YzNiOTcxQjE3NzhhZTEwMDRhIn0",
    payload: "eyJkb21haW4iOiI5YjhmLTEwMi0xMzUtMjQxLTIxNC5uZ3Jvay1mcmVlLmFwcCJ9",
    signature:
      "MHg0N2FjMWM1ZTg2YTM0MTY2NjMwMjA2NWY0ZDMwNGRhNGUyNmZlMThjYmJkOTRjOGY1OWNlNDk0ZWYzNTljNTlhNGI4MWY4YWNjZmNlYjBhNWQxMmVmYjQyZTI1YTVhZTc3Y2NmNmMyYzgxZmVjMmE3Njg2NDQ3NGExM2NiOTNiMjFi",
  },
  "http://localhost:3000": {
    header:
      "eyJmaWQiOjE2ODksInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHgyNzM4QjIxY0I5NTIwMzM4RjlBMzc1YzNiOTcxQjE3NzhhZTEwMDRhIn0",
    payload: "eyJkb21haW4iOiJsb2NhbGhvc3QifQ",
    signature:
      "MHhmOWJkZGQ1MDA4Njc3NjZlYmI1ZmNjODk1NThjZWIxMTc5NjAwNjRlZmFkZWZjZmY4NGZhMzdiMjYxZjU1ZmYzMmZiMDg5NmY4NWU0MmM1YjM4MjQxN2NlMjFhOTBlYmM4YTIzOWFkNjE0YzA2ODM0ZDQ1ODk5NDI3YjE5ZjNkYTFi",
  },
};
