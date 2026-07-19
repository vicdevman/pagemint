# pagemint — Design & Build Spec
### BuildAnything "Spark" Hackathon — Monad Testnet
Deadline: Jul 19 2026, 11:59 PM UTC · Budget: ~9-10 hours build + record

---

## 1. The Pitch (memorize this for the video)

**Problem:** Every time a new token or protocol launches on Monad, there's no fast way to see what it actually does, or whether the community trusts it, before you interact with it. You're stuck reading raw contract calls on the explorer with zero context.

**Solution:** pagemint turns any Monad contract address into an instant, interactive landing page — auto-detecting whether it's a token or a protocol, showing live on-chain stats, a real swap/interact widget, and a token-gated section where the creator's roadmap/pitch deck unlocks only for people who actually hold the token. Community trust is measured by real staked MON votes, not fake likes.

**Why this wins the "no AI slop" bar:** the contract classification is deterministic bytecode/interface introspection — not an LLM guessing. Every button on the page executes a real transaction. Nothing is hardcoded.

Say this problem statement near the start of the demo video, word for word if possible — it directly answers the "personal problem" judging criterion.

---

## 2. Scope lock (what we ARE building — all of it, since we have 9-10 hrs)

| Feature | In scope | Notes |
|---|---|---|
| Deploy `MonadPageMinter` contract to Monad Testnet | ✅ | see §5 |
| Conversational creation flow (chat + live preview + publish) | ✅ | see §3b — replaces a plain form, this is now the primary UX and biggest time item |
| Dynamic page `/page/[contractAddress]` | ✅ | |
| Deterministic contract classifier, tiers 1-2 (token vs protocol) | ✅ | see §4, NO LLM |
| LLM fallback classifier, tier 3 (verified custom contracts only) | ✅ cheap add | see §4 — one Groq call, gated on source-verification, build after core loop works |
| Swap/action widget (token) or function-call widget (protocol) | ✅ | |
| Gated roadmap/pitch deck section (real `checkAccess()` read) | ✅ | priority #1 — build this path first end-to-end |
| Trust Vote (stake MON, 80/20 split, real tx) | ✅ | |
| Leaderboard sorted by `totalTrustVotes` | ✅ | |
| Custom domain support | ⚠️ UI only | disabled "coming soon" badge in publish header — zero backend work, real product signal |
| On-chain credit system (`buyCredits`, `spendCredits`) | ❌ cut | not needed for the demo story, adds risk for zero pitch value — remove from contract entirely to reduce attack surface & gas |
| IPFS metadata storage | ⚠️ stretch | if time is tight, store `ipfsMetadataHash` as JSON pinned via a free pinning service (web3.storage/Pinata) — but a simple approach: store the metadata JSON directly and just put its URL/hash in the field. Don't burn time on this if behind schedule; a plain JSON blob served from your own API is fine for a hackathon. |

---

## 3. Monorepo structure

```
pagemint/
├── apps/
│   ├── web/                 # Next.js 14 app router
│   │   ├── app/
│   │   │   ├── page.tsx             # landing/marketing
│   │   │   ├── dashboard/page.tsx   # mint form
│   │   │   ├── page/[address]/page.tsx   # dynamic project page
│   │   │   ├── leaderboard/page.tsx
│   │   │   └── api/
│   │   │       └── classify/route.ts     # deterministic classifier endpoint
│   │   ├── components/
│   │   │   ├── ui/          # shadcn components
│   │   │   ├── MintForm.tsx
│   │   │   ├── SwapWidget.tsx
│   │   │   ├── ProtocolWidget.tsx
│   │   │   ├── GatedSection.tsx
│   │   │   ├── TrustVoteButton.tsx
│   │   │   └── Leaderboard.tsx
│   │   └── lib/
│   │       ├── wagmi.ts
│   │       ├── contract.ts   # ABI + address + typed hooks
│   │       └── classifier.ts # client-safe wrapper around /api/classify
│   └── contracts/            # Foundry project
│       ├── src/MonadPageMinter.sol
│       ├── script/Deploy.s.sol
│       └── test/MonadPageMinter.t.sol
├── packages/
│   └── shared/                # shared types/constants (chain id, addresses)
├── package.json                # workspaces root
└── turbo.json                  # or just npm/pnpm workspaces, turborepo optional
```

Use **pnpm workspaces** (fast, simple) — skip Turborepo unless your agent already knows it well; it adds config overhead you don't need for a 2-app monorepo tonight.

Add to `apps/web/components/`: `ChatBuilder.tsx`, `LivePreviewPane.tsx`, `PublishHeader.tsx`. Add `apps/web/app/api/build-chat/route.ts` (streaming chat, structured output) and `apps/web/app/api/interpret-contract/route.ts` (tier-3 fallback, §4).

---

## 3b. Conversational creation flow (replaces the plain form)

**Interaction model:**
1. Creator lands on `/dashboard`, sees a **single-column chat**, nothing else. First LLM message asks for the contract address.
2. Each subsequent message asks for one more thing at a time: project name, one-line description, "feel" (a few style words — cyberpunk / minimal / playful / etc.), gate token address + minimum balance, and the roadmap/pitch content to gate.
3. Alongside its human-readable reply, the LLM returns **structured JSON** on every turn: `{ title, description, theme, contractAddress, gateToken, minTokenToUnlock, roadmapText }`. This structured object — not prose-parsing — is what drives the preview. Use the model's native JSON-mode / tool-calling, not regex on the chat text.
4. As soon as `contractAddress` + at least `title` are present, the view **splits into two columns**: chat narrows to the left, a live preview of the actual page renders right (same components the real `/page/[address]` route uses, just fed from in-memory state, not chain state yet). A toggle can collapse the preview back to full-width chat.
5. **Publish** button lives in a header bar above the preview. Clicking it fires the real `mintPage()` transaction with the accumulated struct data, waits for confirmation, then shows the live `/page/[address]` URL.
6. Header also shows a disabled **"Custom domain — coming soon"** badge/input — pure UI, no backend.

**Implementation:** use the **Vercel AI SDK** (`ai` package, `useChat`/`useObject` hooks) against Groq or an OpenRouter-compatible endpoint — it's purpose-built for streaming-chat-drives-structured-UI and will save real time over hand-rolling SSE parsing. `useObject` in particular is a good fit for the "stream a structured JSON object turn by turn" behavior in step 3.

**Scope guard:** keep the question sequence fixed/guided (steps 1-2 above), not fully open-ended — a bounded script keeps the structured-extraction reliable and demoable, and you can still make it feel conversational (LLM phrases each ask naturally, reacts to what they said) without needing to handle arbitrary tangents.

---

## 4. Deterministic classifier + last-resort LLM fallback

No LLM. Runs server-side (`/api/classify`) using `viem`:

```
1. supportsInterface(0x80ac58cd) → true?  => ERC-721
2. supportsInterface(0xd9b67a26) → true?  => ERC-1155
3. try: name(), symbol(), decimals(), totalSupply() all succeed
     AND supportsInterface reverts/false  => ERC-20 (Token Asset)
4. else: probe a fixed list of common selectors against the deployed
   bytecode using eth_getCode + selector substring match:
     stake(uint256), unstake(uint256), deposit(uint256), deposit(),
     withdraw(uint256), redeem(uint256), claim(), mint(uint256),
     swap(...), borrow(uint256), repay(uint256)
   Any hit → classify as Protocol Asset, and surface the matched
   functions as the interactive buttons on the page (encode calldata
   with viem, prompt user's wallet to send the tx).
5. else → Tier 3, LAST RESORT: check whether the block explorer has
   VERIFIED SOURCE for this address (explorer API — most Monad
   explorers expose this like Etherscan does). If yes: send the
   source (or just the unmatched function signatures) to Groq,
   JSON-mode prompt asking it to label each function in plain
   English and suggest an input form shape. Render those as the
   interactive buttons.
   If NO verified source exists: render the honest "Unknown/Custom
   contract" read-only card (address, code size, recent tx count).
   Do NOT let the LLM guess from bytecode alone — it will
   hallucinate, and that's exactly the "faked functionality" the
   judging agent is screening for.
```

Tiers 1-2 are a few hundred lines, run in milliseconds, need no third-party API keys beyond the RPC itself, and cover the overwhelming majority of real contracts (any standard token, and most custom protocols reuse common verb-shaped function names). Tier 3 only fires on genuinely bespoke, verified contracts — build it last, after the core loop (mint → gate → vote → leaderboard) is rock solid, since it's the one piece with any non-determinism.

---

## 5. Smart contract — trimmed `MonadPageMinter.sol`

Start from the contract in the PRD but **delete**: `buyCredits`, `spendCredits`, `userCredits` mapping, `creditCostPerMon`, and the credit-reward lines inside `mintPage`/`submitTrustVote`. Keep: `Page` struct, `registry`, `hasVoted`, `mintPage`, `updatePageConfig`, `submitTrustVote` (80/20 split), `checkAccess`, `withdrawFees`, `updateMintFee`. This cuts gas, cuts surface area, cuts one whole feature you don't have time to wire a UI for, and doesn't touch anything the demo depends on.

Deploy with **Foundry** (`forge create` or a `Deploy.s.sol` script) — faster iteration than Hardhat for a single-file contract, and Monskills should have Foundry-flavored deploy prompts.

Verify the contract on Monad's explorer immediately after deploy — the submission form asks for the contract address and judges will look it up.

---

## 6. Design direction

Dark, high-contrast, Monad-purple (`#A100FF`) accents on near-black (`bg-neutral-950`). Frosted-glass cards (`backdrop-blur-md border-white/10`), Geist or Inter type, generous negative space, subtle glowing status dot for "live on-chain" indicators, `hover:scale-[1.02] transition-all duration-300` on interactive elements. Fit everything in one viewport per screen — no endless scroll, no generic three-column SaaS template. Give the coding agent the **Impeccable skills** (linked in hackathon resources) alongside your shadcn skill so it has actual design vocabulary instead of defaulting to a template look.

For the chat builder specifically: single-column chat should feel like a considered onboarding moment (centered, generous whitespace, one question at a time), not a bare textbox. The split transition (§3b step 4) should animate smoothly, not jump-cut — the preview pane sliding in is a good "wow" beat for the demo video.

Follwo this but PRIORITIZE THE DESING.MD USE THAT TO BUILD OUR DESING SYSTEM WITH THIS. BUT PRIORITIZE DESING.MD IF TEHRES ANY CONFLICT. 
---

## 7. Skills / tools to give the coding agent

- **Monskills** (from hackathon resources) — Monad-specific deploy + frontend prompts
- **Impeccable skills** (from hackathon resources) — design vocabulary, anti-AI-slop
- Your **shadcn skill**
- `viem` + `wagmi` for all chain reads/writes (lighter than ethers for this)
- A wallet connector — **RainbowKit** or **ConnectKit** (RainbowKit is the faster path if the agent already knows it)
- **Foundry** for the contract side

Node packages (web): `next`, `react`, `wagmi`, `viem`, `@rainbow-me/rainbowkit`, `tailwindcss`, shadcn CLI-generated components, `zod` (structured-output validation), `clsx`, `ai` (Vercel AI SDK — powers the chat builder, §3b), `groq-sdk` (used both by the chat builder and the tier-3 fallback in §4).

---

## 8. 9-10 hour timeline

1. **Hr 0–1:** Repo scaffold (pnpm workspace, Next.js app, Foundry project), wallet connect working, trimmed contract written.
2. **Hr 1–2:** Deploy contract to Monad Testnet, verify on explorer, generate typed ABI hooks.
3. **Hr 2–4.5:** Chat builder (§3b): guided single-column chat → structured JSON per turn → split to live preview → Publish fires real `mintPage()` tx → returns URL. This is the biggest single block — protect this time, it's the demo's centerpiece.
4. **Hr 4.5–5.5:** Dynamic `/page/[address]` route: deterministic classifier tiers 1-2 + token/protocol widget rendering.
5. **Hr 5.5–6.5:** Gated roadmap section (`checkAccess()` read + blur/unblur UI) — **priority #1 of the read-side, don't let anything else eat this slot.**
6. **Hr 6.5–7.5:** Trust vote button (real staking tx, 80/20 split, live vote count) + leaderboard page.
7. **Hr 7.5–8:** Tier-3 LLM fallback (§4) — only if on schedule; otherwise skip and let Unknown/Custom contracts show the honest fallback card.
8. **Hr 8–8.5:** Design pass — cyberpunk/glass polish, mobile viewport check, remove any placeholder/lorem text, verify the chat→preview transition animates cleanly.
9. **Hr 8.5–9.5:** End-to-end test with a *real* deployed token or protocol on Monad testnet (not your own mint contract — use something else that already exists, to prove the classifier generalizes). Fix bugs.
10. **Last hour:** Record 3-min demo (open with the personal-problem line from §1, show the chat build a page live, then gate/vote/leaderboard), write README, fill submission form, post the social link.

**If you're falling behind by hour 5:** cut tier-3 LLM fallback first (§4 stays deterministic-only, still honest and functional), then simplify the protocol function-call widget to read-only display for anything past the first matched selector. Never cut the chat builder or the gated section — those are your two strongest demo beats.

---

## 9. Testing checklist before recording

- [ ] Chat builder produces a correct structured object from a real back-and-forth (not just a scripted happy-path you tested once) and the split-to-preview transition works
- [ ] Publish button in the chat builder fires a real `mintPage()` tx and lands on a working `/page/[address]` URL
- [ ] Mint a page for a *real, pre-existing* Monad testnet token/protocol (not one you just deployed) — proves the classifier isn't hardcoded to a single test case
- [ ] If tier-3 fallback was built: verify it only fires for verified contracts with unmatched selectors, and that unverified/unmatched contracts still show the honest "Unknown/Custom" card rather than an LLM guess
- [ ] Gated section correctly blurs when wallet holds 0 gate token, unlocks when it holds enough — test both states on camera
- [ ] Trust vote executes a real tx, creator balance visibly increases, vote count updates without refresh
- [ ] Leaderboard reflects live `totalTrustVotes` from chain, not a static array
- [ ] Whole UI fits one viewport per page at 1080p and on a phone width
- [ ] No lorem ipsum / placeholder copy anywhere

## 10. Submission form mapping

- **Problem/Solution:** use §1 verbatim
- **Contract address:** the verified `MonadPageMinter` deployment
- **Category:** Testnet (unless you also have time to redeploy to mainnet)
- **Demo video:** ≤3 min, lead with the personal problem, show live txs (mint → gate unlock → vote), end on the leaderboard
- **Post URL:** required for the viral prize — post the demo clip