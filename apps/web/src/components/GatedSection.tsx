"use client";
import { useAccount, useReadContract } from "wagmi";
import { Lock } from "lucide-react";
import { WalletButton } from "@/components/WalletButton";
import { minterAbi, minterAddress, hasMinterAddress } from "@/lib/contract";

export function GatedSection({ minTokens, targetContract, children }: { gateToken: `0x${string}`; minTokens: number; targetContract: `0x${string}`; children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const { data: hasAccess, isLoading } = useReadContract({ address: minterAddress, abi: minterAbi, functionName: "checkAccess", args: address ? [address, targetContract] : undefined, query: { enabled: Boolean(address && hasMinterAddress) } });
  if (minTokens === 0) return <>{children}</>;
  if (isLoading && isConnected) return <div className="grid min-h-48 place-items-center rounded-2xl border border-white/10"><span className="text-sm text-neutral-400">Checking token access…</span></div>;
  if (hasAccess) return <div className="rounded-2xl border border-white/10 bg-neutral-900 p-8"><p className="mb-6 text-sm font-medium text-neutral-300">Access granted · verified on-chain</p>{children}</div>;
  return <div className="grid min-h-72 place-items-center rounded-2xl border border-white/10 bg-neutral-900 p-8 text-center"><div><Lock className="mx-auto mb-5 text-neutral-300" /><h3 className="text-xl font-semibold">Holder access required</h3><p className="mx-auto mt-3 max-w-sm text-neutral-400">Hold at least {minTokens.toLocaleString()} gate tokens to unlock this section.</p><div className="mt-6 flex justify-center">{isConnected ? <span className="text-sm text-neutral-500">Your wallet does not meet this gate.</span> : <WalletButton />}</div></div></div>;
}
