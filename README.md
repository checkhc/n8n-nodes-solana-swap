# n8n-nodes-solana

Custom Solana node for n8n with Jupiter swap integration.

## Features

- ✅ Get SOL Balance
- ✅ Get Token Balance (SPL tokens)
- ✅ Get Token Price (CoinGecko integration)
- ✅ Get Transaction History
- ✅ Get Account Info
- 🆕 **Get Swap Quote** (Jupiter API)
- 🆕 **Execute Swap** (Jupiter integration)
- 🆕 **Execute Swap (Advanced)** (Automatic signing)

## Installation

### Via n8n Community Nodes (Recommended)

1. Go to **Settings** → **Community Nodes**
2. Click **Install**
3. Enter: `@checkhc/n8n-nodes-solana`
4. Click **Install**

### Manual Installation

```bash
cd ~/.n8n/nodes
yarn add n8n-workflow
yarn add @checkhc/n8n-nodes-solana
```

## Configuration

### Credentials Required

- **Network**: mainnet-beta, devnet, testnet, or custom RPC
- **RPC Endpoint**: Public RPC or custom (Helius, QuickNode, etc.)
- **Public Key**: Your wallet address
- **Private Key**: Required for swap execution (optional for read operations)

### Supported Networks

- **Mainnet Beta** (real SOL)
- **Devnet** (test SOL)
- **Testnet** (test SOL)
- **Custom RPC** (Helius, QuickNode, etc.)

## Usage Examples

### Get SOL Balance
```json
{
  "operation": "getBalance",
  "walletAddress": "YourWalletAddress"
}
```

### Get Token Price
```json
{
  "operation": "getTokenPrice",
  "tokenSymbol": "solana"
}
```

### Get Swap Quote
```json
{
  "operation": "getSwapQuote",
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "swapAmount": 0.1,
  "slippageBps": 50
}
```

### Execute Swap
```json
{
  "operation": "executeSwapAdvanced",
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "swapAmount": 0.01,
  "slippageBps": 100,
  "priorityFee": 5000
}
```

## Popular Token Addresses

### Mainnet
- **SOL**: `So11111111111111111111111111111111111111112`
- **USDC**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **USDT**: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- **RAY**: `4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R`

## Security Notes

- Start with small amounts for testing
- Use dedicated wallets for n8n automation
- Test on devnet before mainnet
- Monitor transactions on Solscan

## Support

- **GitHub**: https://github.com/checkhc/n8n-nodes-solana
- **Issues**: Report bugs and feature requests on GitHub

## License

MIT
