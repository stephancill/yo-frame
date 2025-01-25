import { NextResponse } from "next/server";
import { YO_TOKEN_ADDRESS } from "../../../lib/constants";
import { withAuth } from "../../../lib/auth";

const API_KEY = process.env["0X_API_KEY"];
const BASE_URL = "https://api.0x.org/swap/permit2";

export const GET = withAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const amount = searchParams.get("amount");
  const takerAddress = searchParams.get("taker");

  if (!amount || !takerAddress) {
    return NextResponse.json(
      { error: "Amount and taker address required" },
      { status: 400 }
    );
  }

  const params = new URLSearchParams({
    sellToken: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    buyToken: YO_TOKEN_ADDRESS,
    sellAmount: amount,
    taker: takerAddress,
    chainId: "8453", // Base mainnet
  });

  const response = await fetch(`${BASE_URL}/price?${params}`, {
    headers: {
      "0x-api-key": API_KEY!,
      "0x-version": "v2",
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error(errorData);
    return NextResponse.json(
      { error: "Failed to get price", details: errorData },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
});

export const POST = withAuth(async (request: Request) => {
  const body = await request.json();
  const { amount, takerAddress } = body;

  if (!amount || !takerAddress) {
    return NextResponse.json(
      { error: "Amount and taker address required" },
      { status: 400 }
    );
  }

  const params = new URLSearchParams({
    sellToken: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    buyToken: YO_TOKEN_ADDRESS,
    sellAmount: amount,
    taker: takerAddress,
    chainId: "8453", // Base mainnet
  });

  try {
    const response = await fetch(`${BASE_URL}/quote?${params}`, {
      headers: {
        "0x-api-key": API_KEY!,
        "0x-version": "v2",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(errorData);
      return NextResponse.json(
        { error: "Failed to get quote", details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Return the full quote response which includes:
    // - transaction data
    // - permit2 signature data
    // - gas estimates
    // - price information
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching quote:", error);
    return NextResponse.json(
      { error: "Failed to process quote request" },
      { status: 500 }
    );
  }
});
