import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function getCloudinaryProxyUrl(
  originalUrl: string,
  width: number,
  height: number
): string {
  return cloudinary.url(originalUrl, {
    type: "fetch",
    width,
    height,
    crop: "fill",
    fetch_format: "auto",
    quality: "auto",
  });
}
