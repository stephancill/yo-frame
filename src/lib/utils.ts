import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { mainnet } from "viem/chains";
import { createPublicClient, http } from "viem";

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

export function getFidColor(fid: number): string {
  // Use golden ratio (φ ≈ 1.618033988749895) for optimal color distribution
  const goldenRatio = 0.618033988749895;
  const hue = ((fid * goldenRatio) % 1) * 360;

  return `hsl(${Math.floor(hue)}, 70%, 55%)`;
}

export function formatNumber(num: number): string {
  if (num < 1000) return num.toString();

  const formatted = (num / 1000).toFixed(1);
  // Remove trailing .0 if present
  return `${formatted.endsWith(".0") ? formatted.slice(0, -2) : formatted}K`;
}

/**
 * Looks up the current price of ETH in USD via Chainlink's ETH/USDC price feed.
 * @returns The current price of ETH in USD.
 */
export async function getEthUsdPrice(): Promise<number> {
  const client = createPublicClient({
    transport: http(),
    chain: mainnet,
  });

  const [, answer] = await client.readContract({
    abi: [
      {
        inputs: [],
        name: "latestRoundData",
        outputs: [
          { internalType: "uint80", name: "roundId", type: "uint80" },
          { internalType: "int256", name: "answer", type: "int256" },
          { internalType: "uint256", name: "startedAt", type: "uint256" },
          { internalType: "uint256", name: "updatedAt", type: "uint256" },
          { internalType: "uint80", name: "answeredInRound", type: "uint80" },
        ],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "latestRoundData",
    // https://docs.chain.link/data-feeds/price-feeds/addresses?network=ethereum&page=1&search=usdc#ethereum-mainnet
    address: "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4",
  });

  const ethPriceUsd = 1e18 / Number(answer);

  return ethPriceUsd;
}
