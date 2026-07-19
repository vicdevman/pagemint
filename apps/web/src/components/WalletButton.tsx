"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  if (isConnected) return <Button variant="outline" onClick={() => disconnect()} className="font-mono">{address?.slice(0, 6)}…{address?.slice(-4)}</Button>;
  return <Button onClick={() => connect({ connector: connectors[0] })} disabled={isPending}>{isPending ? <Loader2 className="animate-spin" /> : <Wallet />} Connect wallet</Button>;
}
