"use client";

import { type Address } from "viem";
import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { TrustVoteButton } from "@/components/TrustVoteButton";
import { GatedSection } from "@/components/GatedSection";
import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { minterAbi, minterAddress, hasMinterAddress } from "@/lib/contract";

const legacyMinterAbi = [
  {
    type: "function",
    name: "registry",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "targetContract", type: "address" },
      { name: "gateToken", type: "address" },
      { name: "minTokenToUnlock", type: "uint256" },
      { name: "totalTrustVotes", type: "uint256" },
      { name: "totalStakedValue", type: "uint256" },
      { name: "ipfsMetadataHash", type: "string" },
      { name: "mintedAt", type: "uint256" },
      { name: "isMinted", type: "bool" },
    ],
    stateMutability: "view",
  },
] as const;

interface PageMetadata {
  title?: string;
  description?: string;
  contractAddress?: string;
  gateToken?: string;
  minTokenToUnlock?: number;
  roadmapText?: string;
  themeColor?: string;
}

export default function ProjectPage({ params }: { params: { address: string } }) {
  const [classification, setClassification] = useState<{ type?: string } | null>(null);

  const { data: pageData, isLoading } = useReadContract({
    address: minterAddress,
    abi: minterAbi,
    functionName: "registry",
    args: [params.address as `0x${string}`],
  });

  const pageResult = pageData as [
    Address, // creator
    Address, // targetContract
    Address, // gateToken
    bigint,  // minTokenToUnlock
    bigint,  // totalTrustVotes
    bigint,  // totalStakedValue
    string,  // ipfsMetadataHash
    bigint,  // mintedAt
    boolean  // isMinted
  ] | undefined;

  useEffect(() => {
    if (params.address) {
      fetch(`/api/classify?address=${params.address}`)
        .then((res) => res.json())
        .then(setClassification)
        .catch(console.error);
    }
  }, [params.address]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading project data from Monad...</p>
        </div>
      </div>
    );
  }

  // isMinted is index [8] in the tuple
  const isMinted = pageResult?.[8] === true;

  if (!hasMinterAddress || !isMinted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-3xl font-bold mb-4">Page Not Found</h1>
        <p className="text-xl text-muted-foreground mb-8">
          No minted page exists for this address on Monad.
        </p>
        <Link href="/dashboard" className="bg-primary text-white px-8 py-3 rounded-full font-semibold hover:bg-primary/90 transition-colors">
          Mint This Address
        </Link>
      </div>
    );
  }

  let metadata: PageMetadata = {};
  try {
    metadata = JSON.parse(pageResult![6]) as PageMetadata;
  } catch {
    metadata = {
      title: "Unknown Project",
      description: "No description available.",
      roadmapText: "No roadmap provided.",
    };
  }

  const gateTokenAddr = pageResult![2] as `0x${string}`;
  const minTokens = Number(pageResult![3]);
  const totalVotes = Number(pageResult![4]);
  const themeColor = metadata.themeColor || "#0099ff";

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex justify-between items-center px-6 py-5 border-b border-border bg-card/40 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="font-bold text-xl tracking-tighter">
          pagemint<span className="text-primary">.</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/leaderboard" className="text-muted-foreground hover:text-white text-sm transition-colors">
            Leaderboard
          </Link>
          <WalletButton />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-8">
          <div>
            <h1
              className="text-5xl md:text-6xl font-bold tracking-tight mb-4"
              style={{ color: themeColor }}
            >
              {metadata.title || "Unnamed Project"}
            </h1>
            <p className="text-xl text-muted-foreground">{metadata.description}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-full border border-border text-sm">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              {classification?.type === "token"
                ? "ERC-20 Token"
                : classification?.type === "protocol"
                ? "Protocol / dApp"
                : "Analyzing..."}
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {params.address.slice(0, 8)}...{params.address.slice(-6)}
            </p>
          </div>
        </div>

        {/* Interaction Widget */}
        <div
          className="glass-panel p-10 rounded-[2rem] mb-16 flex flex-col md:flex-row justify-between items-center gap-8"
          style={{ boxShadow: `0 0 60px ${themeColor}18`, borderColor: `${themeColor}30` }}
        >
          <div>
            <h2 className="text-2xl font-semibold mb-2">Interact with Project</h2>
            <p className="text-muted-foreground">
              Connect your wallet and execute actions on Monad Testnet.
            </p>
          </div>
          <div className="shrink-0">
            {classification?.type === "token" ? (
              <button className="bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-100 transition-colors">
                Swap on Monad
              </button>
            ) : (
              <button
                className="px-8 py-4 rounded-full font-bold text-lg text-white transition-all"
                style={{
                  backgroundColor: themeColor,
                  boxShadow: `0 0 25px ${themeColor}55`,
                }}
              >
                Interact with Protocol
              </button>
            )}
          </div>
        </div>

        {/* Gated Roadmap */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8 tracking-tight">Project Roadmap & Intel</h2>
          <GatedSection gateToken={gateTokenAddr} minTokens={minTokens} targetContract={params.address as `0x${string}`}>
            <div className="prose prose-invert prose-lg max-w-none prose-p:text-muted-foreground prose-headings:tracking-tight">
              {metadata.roadmapText}
            </div>
          </GatedSection>
        </div>

        {/* Trust Vote */}
        <div className="flex flex-col items-center text-center py-20 px-8 rounded-[2rem] border border-border/40 bg-gradient-to-b from-card/20 to-transparent">
          <h2 className="text-3xl font-bold mb-4 tracking-tight">Support this Project</h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Stake <strong className="text-white">0.05 MON</strong> to cast a Trust Vote. 80% goes
            directly to the creator&apos;s wallet instantly. This project has{" "}
            <strong className="text-primary">{totalVotes}</strong> trust votes.
          </p>
          <TrustVoteButton
            targetAddress={params.address as `0x${string}`}
            minterAddress={minterAddress}
          />
        </div>
      </main>

      <footer className="border-t border-border/30 px-8 py-6 text-center text-muted-foreground text-sm">
        Powered by <span className="text-white font-medium">pagemint.</span> on Monad Testnet
      </footer>
    </div>
  );
}
