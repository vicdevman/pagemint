import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, isAddress } from "viem";
import { type Chain } from "viem/chains";

// Define chain inline to avoid importing from a "use client" file
const monadTestnet = {
  id: 10_143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz/"] },
  },
} as const satisfies Chain;

// Initialize viem client for Monad
const client = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

// ERC20 Minimal ABI for detection
const erc20Abi = [
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const address = searchParams.get("address") as `0x${string}`;

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Valid 0x address is required" }, { status: 400 });
  }

  try {
    // 1. Check if a contract exists at this address
    const code = await client.getBytecode({ address });
    if (!code || code === "0x") {
      return NextResponse.json({ type: "eoa", message: "No contract code at this address" });
    }

    // 2. Deterministic Tier-1 Classifier: Call totalSupply() — ERC20 signature
    try {
      await client.readContract({
        address,
        abi: erc20Abi,
        functionName: "totalSupply",
      });
      // Succeeded → highly likely ERC-20 token
      return NextResponse.json({ type: "token", standard: "ERC20" });
    } catch {
      // Reverted or missing → classify as a Protocol/dApp
      return NextResponse.json({ type: "protocol" });
    }
  } catch (error) {
    console.error("Classification error:", error);
    return NextResponse.json({ type: "unknown", error: "Classification failed" }, { status: 500 });
  }
}
