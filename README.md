# pagemint.

> An AI-powered Website-as-a-Service (WaaS) built natively for the Monad blockchain.
> Built for the Monad Spark Hackathon.

**pagemint.** allows anyone to automatically generate, mint, and deploy a premium, interactive landing page for any smart contract (ERC-20 tokens, protocols, or NFTs) on Monad just by chatting with an AI. 

## Features

- 🤖 **Conversational Builder**: Chat with the AI to generate a highly-polished landing page dynamically.
- 🎨 **Premium Aesthetics**: Features a modern dark-mode UI with glassmorphism and animated effects out of the box.
- 🔒 **Token-Gated Roadmaps**: Restrict exclusive content based on users holding a certain amount of your ERC-20 token on Monad.
- 💸 **Trust Voting**: Community members can stake MON to upvote projects. 80% of the staked MON goes directly to the project creator's wallet instantly, while 20% goes to the pagemint protocol.
- 🧠 **Deterministic Classifier**: Automatically detects if a contract is a Token or a Protocol and displays appropriate interaction widgets.
- ⚡ **Built for Monad**: Leverages Monad's high-throughput architecture to handle instant, low-cost mints and interactions.

## Architecture

This is a full-stack monorepo managed with `pnpm`:
- **`apps/contracts`**: Hardhat project containing the `MonadPageMinter.sol` smart contract.
- **`apps/web`**: Next.js 14 App Router application featuring the Vercel AI SDK, Wagmi, RainbowKit, Shadcn UI, and Nexus UI.

## Getting Started

### 1. Clone the repository and install dependencies
```bash
git clone <your-repo-url> pagemint
cd pagemint
pnpm install
```

### 2. Configure Environment Variables
Copy the example environment variables in the web app:
```bash
cd apps/web
cp .env.example .env.local
```
Fill in `.env.local` with your WalletConnect ID, Groq API key, and Monad RPC URL.

### 3. Deploy the Smart Contract
Navigate to the contracts app and deploy to Monad Testnet:
```bash
cd ../contracts
# Create a .env file based on the keys needed for deployment
npx hardhat compile
npx hardhat run scripts/deploy.js --network monadTestnet
```
Copy the deployed contract address and paste it into your `apps/web/.env.local` as `NEXT_PUBLIC_CONTRACT_ADDRESS`.

### 4. Run the Development Server
```bash
cd ../web
pnpm run dev
```

Visit `http://localhost:3000` to start building!

## Built With
- [Monad](https://monad.xyz/) - High-performance EVM L1
- [Next.js](https://nextjs.org/) - React Framework
- [Vercel AI SDK](https://sdk.vercel.ai/) - AI Streaming
- [Groq](https://groq.com/) - Llama 3 Inference
- [Wagmi](https://wagmi.sh/) & [RainbowKit](https://www.rainbowkit.com/) - Web3 Hooks & Wallet UI
- [Shadcn UI](https://ui.shadcn.com/) & [Nexus UI](https://nexus-ui.dev/) - UI Primitives
