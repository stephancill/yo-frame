import "dotenv/config";

import { createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";
import { YO_TOKEN_ADDRESS } from "../lib/constants";
import { onchainMessageQueue } from "../lib/queue";

export async function startEventListener() {
  console.log("Starting event listener...");

  const client = createPublicClient({
    chain: base,
    transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
  });

  client.watchEvent({
    onLogs: async (logs) => {
      for (const log of logs) {
        const { transactionHash, args } = log;

        if (!args.to || !args.from || !args.amount || !args.data) {
          console.log("Invalid event", transactionHash);
          continue;
        }

        console.log("Event", transactionHash, {
          transactionHash,
          fromAddress: args.from,
          toAddress: args.to,
          amount: args.amount.toString(),
          data: args.data,
        });

        await onchainMessageQueue.add(
          transactionHash,
          {
            transactionHash,
            fromAddress: args.from,
            toAddress: args.to,
            amount: args.amount.toString(),
            data: args.data,
          },
          {
            jobId: `${transactionHash}-${log.logIndex}`,
          }
        );

        console.log(`Queued onchain message job for tx: ${transactionHash}`);
      }
    },
    address: YO_TOKEN_ADDRESS,
    events: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "from",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "to",
            type: "address",
          },
          {
            indexed: true,
            internalType: "uint256",
            name: "amount",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
        ],
        name: "YoEvent",
        type: "event",
      },
    ],
  });
}

if (require.main === module) {
  startEventListener().catch(console.error);
}
