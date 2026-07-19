"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { LockKeyhole } from "lucide-react";
import { WalletButton } from "@/components/WalletButton";

export function WalletGate({ children }: { children: React.ReactNode }) {
  const { isConnected, isConnecting } = useAccount();
  const router = useRouter();
  useEffect(() => { if (!isConnected && !isConnecting) router.replace("/"); }, [isConnected, isConnecting, router]);
  if (isConnected) return <>{children}</>;
  return <main className="min-h-screen grid place-items-center px-6"><section className="max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-8 text-center"><LockKeyhole className="mx-auto mb-5 text-white" /><h1 className="text-2xl font-semibold">Connect to build</h1><p className="mt-3 text-neutral-400">A connected wallet is required before you can create and mint a page.</p><div className="mt-6 flex justify-center"><WalletButton /></div></section></main>;
}
