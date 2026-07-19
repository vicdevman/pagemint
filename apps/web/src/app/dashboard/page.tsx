"use client";

import { useState, useCallback, useRef } from "react";
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
import { Send, Loader2 } from "lucide-react";
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

export default function Dashboard() {
  const router = useRouter();
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [object, setObject] = useState<PageData | null>(null);
  const [streamText, setStreamText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const { data: hash, isPending: isWritePending, writeContract } = useWriteContract();
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE lines: "data: {...}"
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
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
      try {
        const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          pageData = JSON.parse(jsonMatch[0]);
          setObject(pageData);
        }
      } catch {
        // JSON parse failed — show raw in chat
      }

      const title = pageData.title || "your project";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `I've designed the page for **${title}**! Check the live preview on the right. Want to tweak anything?`,
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
    if (!hasMinterAddress || !object?.contractAddress || !object?.gateToken || !isAddress(object.contractAddress) || !isAddress(object.gateToken)) return;
    const metadataStr = JSON.stringify(object);
    writeContract({
      address: minterAddress,
      abi: minterAbi,
      functionName: "mintPage",
      args: [
        object.contractAddress as `0x${string}`,
        object.gateToken as `0x${string}`,
        BigInt(object.minTokenToUnlock || 0),
        metadataStr
      ],
      value: 10_000_000_000_000_000n,
    });
  };

  useEffect(() => {
    if (isSuccess && object?.contractAddress) {
      router.push(`/page/${object.contractAddress}`);
    }
  }, [isSuccess, object?.contractAddress, router]);

  const hasPreview = !!(object?.title || object?.contractAddress);

  return <WalletGate>(
    <div className="flex h-screen bg-background overflow-hidden w-full">
      {/* Chat Section */}
      <div
        className={`flex flex-col transition-all duration-500 ease-in-out h-full ${
          hasPreview ? "w-1/2 border-r border-border" : "w-full max-w-4xl mx-auto"
        }`}
      >
        <div className="flex-1 p-6 relative min-h-0 overflow-hidden">
          <Thread className="h-full">
            <ThreadContent>
              <Message from="assistant">
                <MessageAvatar fallback="AI" />
                <MessageContent>
                  <MessageMarkdown>
                    Welcome to **Pagemint**! I'm your AI designer.
                    Tell me your token or protocol address and the vibe you want — I'll build you a premium page instantly.
                  </MessageMarkdown>
                </MessageContent>
              </Message>

              {messages.map((m, i) => (
                <Message key={i} from={m.role}>
                  <MessageAvatar fallback={m.role === "user" ? "U" : "AI"} />
                  <MessageContent>
                    <MessageMarkdown>{m.content}</MessageMarkdown>
                  </MessageContent>
                </Message>
              ))}

              {isLoading && (
                <Message from="assistant">
                  <MessageAvatar fallback="AI" />
                  <MessageContent>
                    {streamText ? (
                      <MessageMarkdown>{streamText}</MessageMarkdown>
                    ) : (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" /> Generating your page...
                      </span>
                    )}
                  </MessageContent>
                </Message>
              )}
            </ThreadContent>
            <ThreadScrollToBottom />
          </Thread>
        </div>

        <div className="p-6 pt-0 shrink-0">
          <PromptInput onSubmit={(val) => handleSend(val)}>
            <PromptInputTextarea
              placeholder="E.g. Build a premium dark mode page for 0x123... gating content with 100 MON tokens..."
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
      {hasPreview && (
        <div className="w-1/2 h-full bg-[#0a0a0a] p-12 overflow-y-auto">
          <div
            className="glass-panel p-8 rounded-[1.5rem] relative min-h-full flex flex-col"
            style={{
              borderColor: "rgba(255,255,255,.1)",
            }}
          >
            <h1
              className="text-4xl font-bold tracking-tight mb-3"
            >
              {object?.title || "Untitled Project"}
            </h1>
            <p className="text-muted-foreground mb-10 text-lg">
              {object?.description || "Generating description..."}
            </p>

            <div className="bg-card/50 backdrop-blur-md border border-border p-6 rounded-[1rem] mb-8">
              <h3 className="text-sm uppercase tracking-widest text-muted-foreground mb-4">
                Contract Details
              </h3>
              <div className="flex justify-between items-center py-3 border-b border-border/50">
                <span className="text-muted-foreground text-sm">Target</span>
                <span className="font-mono text-sm truncate max-w-[260px]">
                  {object?.contractAddress || "..."}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-border/50">
                <span className="text-muted-foreground text-sm">Gate Token</span>
                <span className="font-mono text-sm truncate max-w-[260px]">
                  {object?.gateToken || "..."}
                </span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-muted-foreground text-sm">Required Balance</span>
                <span className="font-mono text-sm bg-white/10 px-2 py-1 rounded-md">
                  {object?.minTokenToUnlock || 0}
                </span>
              </div>
            </div>

            <div className="bg-card/50 backdrop-blur-md border border-border p-6 rounded-[1rem] flex-1">
              <h3 className="text-sm uppercase tracking-widest text-muted-foreground mb-4">
                Gated Roadmap
              </h3>
              <div className="prose prose-invert prose-p:text-muted-foreground prose-a:text-primary max-w-none prose-sm">
                <MessageMarkdown>
                  {object?.roadmapText || "Generating roadmap..."}
                </MessageMarkdown>
              </div>
            </div>

            <Button
              onClick={handleMint}
              className="w-full mt-8 rounded-lg h-12 text-lg font-medium"
              disabled={!hasMinterAddress || !object?.contractAddress || !object?.gateToken || !isAddress(object.contractAddress) || !isAddress(object.gateToken) || isWritePending || isConfirming}
            >
              {isWritePending
                ? "Approve in Wallet..."
                : isConfirming
                ? "Minting to Monad..."
                : "Mint Page (0.01 MON)"}
            </Button>
          </div>
        </div>
      )}
    </div>
  </WalletGate>;
}
