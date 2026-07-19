"use client";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { CheckCircle, Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { minterAbi } from "@/lib/contract";
export function TrustVoteButton({
  targetAddress,
  minterAddress,
}: {
  targetAddress: `0x${string}`;
  minterAddress: `0x${string}`;
}) {
  const { isConnected } = useAccount();
  const { data: hash, isPending, writeContract, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const stakeAmount = useReadContract({
    address: minterAddress,
    abi: minterAbi,
    functionName: "voteStakeAmount",
  }).data as bigint | undefined;

  if (isSuccess) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-emerald-300">
        <CheckCircle size={18} /> Vote confirmed on Monad.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        onClick={() =>
          writeContract({
            address: minterAddress,
            abi: minterAbi,
            functionName: "submitTrustVote",
            args: [targetAddress],
            value: stakeAmount,
          })
        }
        disabled={!isConnected || !stakeAmount || isPending || isConfirming}
        className="h-12 rounded-lg px-6"
      >
        {isPending || isConfirming ? (
          <>
            <Loader2 className="animate-spin" /> {isPending ? "Confirm in wallet" : "Confirming"}
          </>
        ) : (
          <>
            <Heart /> Trust vote · {stakeAmount ? `${Number(stakeAmount) / 1e18} MON` : "…"}
          </>
        )}
      </Button>
      {!isConnected && <p className="text-sm text-neutral-500">Connect a wallet to vote.</p>}
      {error && (
        <p className="max-w-md text-center text-sm text-red-400">
          {(error as any).shortMessage || error.message || "Transaction could not be submitted."}
        </p>
      )}
    </div>
  );
}
