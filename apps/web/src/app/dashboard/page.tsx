"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputActionGroup,
  PromptInputAction,
} from "@/components/nexus-ui/prompt-input";
import {
  Message,
  MessageContent,
  MessageMarkdown,
  MessageAvatar,
} from "@/components/nexus-ui/message";
import {
  Thread,
  ThreadContent,
  ThreadScrollToBottom,
} from "@/components/nexus-ui/thread";
import { Send, Loader2, ChevronRight, ChevronLeft, ArrowUp } from "lucide-react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { isAddress } from "viem";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { WalletGate } from "@/components/WalletGate";
import { hasMinterAddress, minterAbi, minterAddress } from "@/lib/contract";

type PageData = {
  title?: string;
  description?: string;
  contractAddress?: string;
  gateToken?: string;
  minTokenToUnlock?: number;
  roadmapText?: string;
  themeColor?: string;
};

const SUGGESTIONS = [
  { label: "Token Page 🪙", text: "Create a cyberpunk landing page for WMON at 0x76bDD65326e0142C3FEFD37058EA27cc5a3F6b0a gating with 10 MON" },
  { label: "Protocol Vault 🏦", text: "Design a minimal dApp landing page for Monad Vault at 0x76bDD65326e0142C3FEFD37058EA27cc5a3F6b0a" },
  { label: "NFT Roadmap 🎨", text: "Build a high-contrast landing page for Monad NFT at 0x76bDD65326e0142C3FEFD37058EA27cc5a3F6b0a" }
];

export default function Dashboard() {
  const router = useRouter();
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [object, setObject] = useState<PageData | null>(null);
  const [streamText, setStreamText] = useState("");
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const { data: hash, isPending: isWritePending, writeContract, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleSend = useCallback(async (value?: string) => {
    const text = value || input;
    if (!text.trim() || isLoading) return;

    const newMessages: { role: "user" | "assistant"; content: string }[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setStreamText("");

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/build-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("Network error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content ?? "";
            accumulated += delta;
            setStreamText(accumulated);
          } catch {
            // skip malformed chunks
          }
        }
      }

      // Try to extract valid JSON from accumulated text
      let pageData: PageData = {};
      let conversationalText = accumulated;

      const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          pageData = JSON.parse(jsonMatch[0]);
          conversationalText = accumulated.replace(jsonMatch[0], "").trim();
          // Remove leftover code block ticks
          conversationalText = conversationalText.replace(/```json\s*```/g, "").replace(/```\s*```/g, "").trim();
        } catch {
          // JSON parse failed
        }
      }

      // Backfill missing fields to ensure sidepane opens
      if (!pageData.title) pageData.title = "your project";
      if (!pageData.contractAddress) pageData.contractAddress = "0x76bDD65326e0142C3FEFD37058EA27cc5a3F6b0a"; // Default fallback
      if (!pageData.description) pageData.description = "Gated Monad landing page";
      if (!pageData.gateToken) pageData.gateToken = "0x0000000000000000000000000000000000000000";
      if (!pageData.roadmapText) pageData.roadmapText = accumulated || "No roadmap text generated.";
      
      setObject(pageData);

      if (!conversationalText) {
        conversationalText = `I've successfully designed the landing page config for **${pageData.title}**! You can view it in the preview pane.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: conversationalText,
        },
      ]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, something went wrong. Please try again." },
        ]);
      }
    } finally {
      setIsLoading(false);
      setStreamText("");
    }
  }, [messages, input, isLoading]);

  const handleMint = () => {
    if (!hasMinterAddress || !object?.contractAddress || !isAddress(object.contractAddress) || isWritePending || isConfirming) return;
    
    // Resolve gate token fallback (cannot be address(0))
    const resolvedGateToken = (object.gateToken && isAddress(object.gateToken) && object.gateToken !== "0x0000000000000000000000000000000000000000")
      ? object.gateToken
      : object.contractAddress;

    const metadataStr = JSON.stringify(object);
    writeContract({
      address: minterAddress,
      abi: minterAbi,
      functionName: "mintPage",
      args: [
        object.contractAddress as `0x${string}`,
        resolvedGateToken as `0x${string}`,
        BigInt(object.minTokenToUnlock || 0),
        metadataStr
      ],
      value: 10_000_000_000_000_000n, // 0.01 MON
    });
  };

  useEffect(() => {
    if (isSuccess && object?.contractAddress) {
      router.push(`/page/${object.contractAddress}`);
    }
  }, [isSuccess, object, router]);

  const hasPreview = !!(object?.title || object?.contractAddress);
  
  return (<WalletGate>
    <div className="flex h-[100dvh] bg-background overflow-hidden w-full">
      {/* Chat Section */}
      <div
        className={`flex flex-col gap-2 transition-all duration-500 ease-in-out h-full ${
          isPreviewCollapsed ? "w-full max-w-4xl mx-auto px-4" : "w-1/2 border-r border-border"
        }`}
      >
        {/* Chat Pane Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-neutral-950/40 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs font-semibold tracking-tight text-neutral-400 hover:text-white transition-colors">
              ← Home
            </Link>
            <span className="text-neutral-800">|</span>
            <h2 className="text-xs font-semibold text-neutral-200">AI Page Builder</h2>
          </div>
          {isPreviewCollapsed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewCollapsed(false)}
              className="gap-1.5 h-8 text-xs border-white/10 hover:bg-white/5"
            >
              <ChevronLeft size={14} /> Show Preview
            </Button>
          )}
        </div>

        <div className="flex-1 relative min-h-0 overflow-hidden">
          <Thread className="h-full">
            <ThreadContent>
              <Message from="assistant">
                <MessageContent>
                  <MessageMarkdown>
                    Welcome to **Pagemint**! I'm your AI designer.
                    Tell me your token or protocol address and the vibe you want — I'll build you a premium page instantly.
                  </MessageMarkdown>
                </MessageContent>
              </Message>

              {messages.map((m, i) => (
                <Message key={i} from={m.role}>
                  <MessageContent>
                    <MessageMarkdown>{m.content}</MessageMarkdown>
                  </MessageContent>
                </Message>
              ))}

              {isLoading && (
                <Message from="assistant">
                  <MessageContent>
                    <div className="flex flex-col gap-2">
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI is designing your page...
                      </span>
                      {streamText && <MessageMarkdown>{streamText}</MessageMarkdown>}
                    </div>
                  </MessageContent>
                </Message>
              )}
            </ThreadContent>
            <ThreadScrollToBottom />
          </Thread>
        </div>

        {/* Suggestions list */}
        <div className="px-4 pb-1 flex gap-2 overflow-x-auto shrink-0 scrollbar-none">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              onClick={() => handleSend(s.text)}
              className="px-3 py-1.5 rounded-full border border-white/5 bg-neutral-900/50 hover:bg-neutral-800 text-[11px] text-neutral-400 hover:text-white whitespace-nowrap transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="px-4 pb-4 pt-0 shrink-0">
          <PromptInput onSubmit={(val) => handleSend(val)}>
            <PromptInputTextarea
              placeholder="E.g. Build a premium dark mode page for WMON at 0x76b... gating content with 10 MON tokens..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <PromptInputActions>
              <PromptInputActionGroup />
              <PromptInputActionGroup>
                <PromptInputAction asChild>
                  <Button
                    size="icon"
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => handleSend()}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </PromptInputAction>
              </PromptInputActionGroup>
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>

      {/* Live Preview Section */}
      {!isPreviewCollapsed && (
        <div className="w-1/2 h-full bg-[#0a0a0a] flex flex-col">
          {/* Right Pane Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-neutral-900/30 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-400 hover:text-white"
                onClick={() => setIsPreviewCollapsed(true)}
                title="Collapse Preview"
              >
                <ChevronRight size={18} />
              </Button>
              <h2 className="text-sm font-semibold tracking-tight text-neutral-200">Live Page Preview</h2>
            </div>
            
            {/* Mint Button on the Header */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleMint}
                size="sm"
                className="bg-white text-black hover:bg-neutral-200 font-semibold px-4 h-8 text-xs rounded-full"
                disabled={!hasMinterAddress || !object?.contractAddress || isWritePending || isConfirming}
              >
                {isWritePending
                  ? "Approve..."
                  : isConfirming
                  ? "Publishing..."
                  : "Publish Page (0.01 MON)"}
              </Button>
            </div>
          </div>

          <div className="flex-1 p-12 overflow-y-auto">
            {writeError && (
              <div className="mb-6 p-4 rounded-lg bg-red-950/30 border border-red-500/30 text-red-200 text-xs flex flex-col gap-1">
                <span className="font-semibold">Deployment Failed:</span>
                <span>{(writeError as any).shortMessage || writeError.message || "Unknown transaction error."}</span>
              </div>
            )}

            <div
              className="glass-panel p-8 rounded-[1.5rem] relative min-h-full flex flex-col"
              style={{
                borderColor: object?.themeColor ? `${object.themeColor}30` : "rgba(255,255,255,.1)",
                boxShadow: object?.themeColor ? `0 0 50px ${object.themeColor}10` : undefined,
              }}
            >
              <h1
                className="text-4xl font-bold tracking-tight mb-3"
                style={{ color: object?.themeColor || "#fff" }}
              >
                {object?.title || "Untitled Project"}
              </h1>
              <p className="text-muted-foreground mb-10 text-lg">
                {object?.description || "Give me a description above..."}
              </p>

              <div className="bg-card/50 backdrop-blur-md border border-border p-6 rounded-[1rem] mb-8">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-semibold">
                  Contract Configuration
                </h3>
                <div className="flex justify-between items-center py-3 border-b border-border/50">
                  <span className="text-muted-foreground text-sm">Target Address</span>
                  <span className="font-mono text-sm truncate max-w-[220px] text-neutral-300">
                    {object?.contractAddress || "Not set"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border/50">
                  <span className="text-muted-foreground text-sm">Gate Token</span>
                  <span className="font-mono text-sm truncate max-w-[220px] text-neutral-300">
                    {object?.gateToken || "Not set"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-muted-foreground text-sm">Required Balance</span>
                  <span className="font-mono text-sm bg-white/10 px-2 py-1 rounded-md text-white">
                    {object?.minTokenToUnlock || 0}
                  </span>
                </div>
              </div>

              <div className="bg-card/50 backdrop-blur-md border border-border p-6 rounded-[1rem] flex-1">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-semibold">
                  Gated Roadmap
                </h3>
                <div className="prose prose-invert prose-p:text-muted-foreground prose-a:text-primary max-w-none prose-sm">
                  <MessageMarkdown>
                    {object?.roadmapText || "No roadmap content generated yet."}
                  </MessageMarkdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </WalletGate>
  );
}
