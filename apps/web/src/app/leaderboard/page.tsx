"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Trophy } from "lucide-react";
import { formatEther, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { WalletButton } from "@/components/WalletButton";
import { hasMinterAddress, minterAbi, minterAddress } from "@/lib/contract";
type Row = { address: Address; title: string; votes: bigint; staked: bigint };
export default function Leaderboard() {
  const client = usePublicClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    async function load() {
      if (!client || !hasMinterAddress) {
        setLoading(false);
        return;
      }
      try {
        const logs = await client.getLogs({
          address: minterAddress,
          event: minterAbi[6],
          fromBlock: BigInt(process.env.NEXT_PUBLIC_CONTRACT_DEPLOYMENT_BLOCK || "0"),
          toBlock: "latest",
        });
        const unique = [...new Set(logs.map((log) => log.args.targetContract).filter(Boolean))] as Address[];
        const items = await Promise.all(
          unique.map(async (address) => {
            const page = (await client.readContract({
              address: minterAddress,
              abi: minterAbi,
              functionName: "registry",
              args: [address],
            })) as [Address, Address, Address, bigint, bigint, bigint, string, bigint, boolean];
            let title = "Untitled page";
            try {
              title = JSON.parse(page[6]).title || title;
            } catch {}
            return { address, title, votes: page[4], staked: page[5] };
          })
        );
        if (live) setRows(items.sort((a, b) => Number(b.votes - a.votes)));
      } catch {
        if (live) setRows([]);
      } finally {
        if (live) setLoading(false);
      }
    }
    load();
    return () => {
      live = false;
    };
  }, [client]);

  return (
    <div className="min-h-screen bg-neutral-950">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link href="/" className="text-xl font-semibold">
          pagemint<span className="text-neutral-500">.</span>
        </Link>
        <WalletButton />
      </nav>
      <main className="mx-auto max-w-5xl px-5 py-16">
        <div className="mb-12 flex items-start gap-4">
          <div className="grid size-12 place-items-center rounded-xl border border-white/10">
            <Trophy size={21} />
          </div>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Trust leaderboard</h1>
            <p className="mt-2 text-neutral-400">Live registry data from Monad Testnet.</p>
          </div>
        </div>
        {loading ? (
          <p className="text-neutral-400">Reading the registry…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 p-8 text-neutral-400">
            No minted pages were found yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {rows.map((row, i) => (
              <Link
                key={row.address}
                href={`/page/${row.address}`}
                className="flex items-center gap-4 border-b border-white/10 p-5 last:border-0 hover:bg-white/5"
              >
                <span className="w-8 text-neutral-500">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{row.title}</p>
                  <p className="truncate font-mono text-xs text-neutral-500">{row.address}</p>
                </div>
                <div className="text-right">
                  <p className="flex items-center justify-end gap-1 font-semibold">
                    <Heart size={14} /> {row.votes.toString()}
                  </p>
                  <p className="text-xs text-neutral-500">{formatEther(row.staked)} MON staked</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
