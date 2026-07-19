"use client";

import * as React from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { createConnector } from "@wagmi/core";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { type Address, type Chain } from "viem";


export const monadTestnet = {
  id: 10_143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz/"] },
  },
  blockExplorers: {
    default: { name: "MonadExplorer", url: "https://testnet.monadexplorer.com/" },
  },
} as const satisfies Chain;

const injectedConnector = createConnector((config) => ({
  id: "injected",
  name: "Browser wallet",
  type: "injected",
  async connect<withCapabilities extends boolean = false>(params?: { chainId?: number; isReconnecting?: boolean; withCapabilities?: withCapabilities }) {
    const chainId = params?.chainId;
    const withCapabilities = params?.withCapabilities;
    const provider = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!provider) throw new Error("No browser wallet found. Install or unlock a compatible wallet.");
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
    const currentChainId = Number(await provider.request({ method: "eth_chainId" }));
    if (chainId && currentChainId !== chainId) {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
    }
    const accountsResult = (withCapabilities
      ? accounts.map((address) => ({ address, capabilities: {} }))
      : accounts);
    return {
      accounts: accountsResult as any,
      chainId: chainId ?? currentChainId,
    } as any;
  },
  async disconnect() {},
  async getAccounts() {
    const provider = (window as Window & { ethereum?: { request: (args: { method: string }) => Promise<unknown> } }).ethereum;
    return provider ? (await provider.request({ method: "eth_accounts" })) as `0x${string}`[] : [];
  },
  async getChainId() {
    const provider = (window as Window & { ethereum?: { request: (args: { method: string }) => Promise<unknown> } }).ethereum;
    return provider ? Number(await provider.request({ method: "eth_chainId" })) : config.chains[0].id;
  },
  async getProvider() { return (window as Window & { ethereum?: unknown }).ethereum; },
  async isAuthorized() {
    const provider = (window as Window & { ethereum?: { request: (args: { method: string }) => Promise<unknown> } }).ethereum;
    return provider ? ((await provider.request({ method: "eth_accounts" })) as unknown[]).length > 0 : false;
  },
  onAccountsChanged(accounts) { config.emitter.emit("change", { accounts: accounts as Address[] }); },
  onChainChanged(chainId) { config.emitter.emit("change", { chainId: Number(chainId) }); },
  onDisconnect() { config.emitter.emit("disconnect"); },
}));

const wagmiConfig = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz/"),
  },
  connectors: [injectedConnector],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
