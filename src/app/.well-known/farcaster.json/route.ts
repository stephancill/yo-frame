export async function GET() {
  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    throw new Error("APP_URL is not set");
  }

  const config = {
    accountAssociation: accountAssociations[appUrl],
    frame: {
      version: "1",
      name: "Frame",
      iconUrl: `${appUrl}/icon.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/og.png`,
      buttonTitle: "launch",
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#f7f7f7",
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
  "https://8b38-102-135-241-214.ngrok-free.app": {
    header:
      "eyJmaWQiOjE2ODksInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHgyNzM4QjIxY0I5NTIwMzM4RjlBMzc1YzNiOTcxQjE3NzhhZTEwMDRhIn0",
    payload: "eyJkb21haW4iOiI4YjM4LTEwMi0xMzUtMjQxLTIxNC5uZ3Jvay1mcmVlLmFwcCJ9",
    signature:
      "MHg3YmRjM2RjN2QwMDJkZjBiMmM3ZTc1YTQ5YTY5MjkzMGI0Y2U2M2ZhN2M0MWM1MTdmYzNmNzY5M2NjYmE4ZGQwMzMxNmZjYjI0Nzc5NzA4MzUxZjIzOGJmMmU3NWNiMjQzMmUwZDVjNmQxOWYwZGYzMWJmZjYwODQ2MjdhZjE2NjFi",
  },
  "http://localhost:3000": {
    header:
      "eyJmaWQiOjE2ODksInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHgyNzM4QjIxY0I5NTIwMzM4RjlBMzc1YzNiOTcxQjE3NzhhZTEwMDRhIn0",
    payload: "eyJkb21haW4iOiJsb2NhbGhvc3QifQ",
    signature:
      "MHhmOWJkZGQ1MDA4Njc3NjZlYmI1ZmNjODk1NThjZWIxMTc5NjAwNjRlZmFkZWZjZmY4NGZhMzdiMjYxZjU1ZmYzMmZiMDg5NmY4NWU0MmM1YjM4MjQxN2NlMjFhOTBlYmM4YTIzOWFkNjE0YzA2ODM0ZDQ1ODk5NDI3YjE5ZjNkYTFi",
  },
};
