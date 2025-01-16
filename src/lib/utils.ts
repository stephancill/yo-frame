import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRelativeTime(d1: Date, d2: Date = new Date()): string {
  const units: Record<string, { value: number; short: string }> = {
    year: { value: 24 * 60 * 60 * 1000 * 365, short: "y" },
    month: { value: (24 * 60 * 60 * 1000 * 365) / 12, short: "mo" },
    day: { value: 24 * 60 * 60 * 1000, short: "d" },
    hour: { value: 60 * 60 * 1000, short: "h" },
    minute: { value: 60 * 1000, short: "m" },
    second: { value: 1000, short: "s" },
  };

  const elapsed = d1.getTime() - d2.getTime();

  // "Math.abs" accounts for both "past" & "future" scenarios
  for (const [unit, { value, short }] of Object.entries(units)) {
    if (Math.abs(elapsed) > value || unit === "second") {
      const count = Math.round(elapsed / value);
      // const prefix = count >= 0 ? "" : "-";
      return `${Math.abs(count)}${short}`;
    }
  }

  return "0s";
}

export function getBaseUrl() {
  const url = new URL(
    typeof window !== "undefined" ? window.location.href : process.env.APP_URL!
  );
  url.pathname = "";
  url.search = "";
  return url;
}

export function createWarpcastDcUrl(
  fid: number | string,
  text: string
): string {
  const url = new URL(`https://warpcast.com/~/inbox/create/${fid}`);
  url.searchParams.set("text", text);
  return url.toString();
}

export function createWarpcastComposeUrl(
  text: string,
  embeds: string[] = [],
  parentCastHash?: `0x${string}`
): string {
  const url = new URL("https://warpcast.com/~/compose");
  url.searchParams.append("text", text);

  embeds.forEach((embed) => {
    url.searchParams.append("embeds[]", embed);
  });

  if (parentCastHash) {
    url.searchParams.append("parentCastHash", parentCastHash);
  }

  return url.toString();
}
