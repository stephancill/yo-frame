import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import farcasterFrame from "@farcaster/frame-wagmi-connector";

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
  },
  connectors: [farcasterFrame()],
});
