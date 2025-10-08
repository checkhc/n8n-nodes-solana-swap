# 🚀 n8n-nodes-solana-swap

[![npm version](https://badge.fury.io/js/n8n-nodes-solana-swap.svg)](https://www.npmjs.com/package/n8n-nodes-solana-swap)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dt/n8n-nodes-solana-swap)](https://www.npmjs.com/package/n8n-nodes-solana-swap)

> **🎁 Free & Open Source** | Developed with ❤️ by [CHECKHC](https://checkhc.net)

**The most complete Solana automation node for n8n** - Trade tokens, check balances, and automate your Solana workflows with ease.

🔥 **NEW:** Support for both **Raydium** (lower fees) and **Jupiter** (best routing) DEXs!

---

## 🌟 Why This Node?

- ✅ **100% Free & Open Source** - No hidden costs, no API keys required
- ⚡ **Lightning Fast** - Optimized with parallel requests and smart caching
- 🔐 **Enterprise Security** - Audited code, sanitized errors, timeout protection
- 🎯 **Production Ready** - Used in real trading bots and automation workflows
- 🤝 **Community Driven** - Built by developers, for developers

## ✨ Features

### 💰 Trading & Swaps
- 🔄 **Token Swaps** - Trade any SPL token via Raydium or Jupiter
- 📊 **Real-time Quotes** - Get best prices across multiple DEXs
- ⚙️ **Advanced Execution** - Automatic transaction signing and submission
- 🎯 **Smart Routing** - Choose between low fees (Raydium) or best price (Jupiter)

### 📈 Monitoring & Analytics  
- 💵 **Balance Checks** - SOL and SPL token balances
- 📉 **Price Tracking** - Live token prices via CoinGecko
- 📜 **Transaction History** - Full account activity logs
- 🔍 **Account Info** - Detailed on-chain account data

### 🔐 Security First
- 🛡️ **Private Key Protection** - Sanitized error messages
- ⏱️ **Request Timeouts** - No hanging workflows
- ✅ **Input Validation** - Safe amount and address checks
- 🔄 **Auto Retry** - Exponential backoff for failed requests

## Installation

### Via n8n Community Nodes (Recommended)

1. Go to **Settings** → **Community Nodes**
2. Click **Install**
3. Enter: `n8n-nodes-solana-swap`
4. Click **Install**

### Manual Installation

```bash
cd ~/.n8n/nodes
npm install n8n-workflow
npm install n8n-nodes-solana-swap
```

Then restart n8n to load the new node.

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

### 💎 Swap SOL for CHECKHC Token

**Get Best Quote:**
```json
{
  "operation": "getSwapQuote",
  "dexProvider": "raydium",
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "5tpkrCVVh6tjjve4TuyP8MXBwURufgAnaboaLwo49uau",
  "swapAmount": 1,
  "slippageBps": 50
}
```

**Execute Swap:**
```json
{
  "operation": "executeSwapAdvanced",
  "dexProvider": "raydium",
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "5tpkrCVVh6tjjve4TuyP8MXBwURufgAnaboaLwo49uau",
  "swapAmount": 1,
  "slippageBps": 100,
  "priorityFee": 5000
}
```

> 💡 **Tip:** Start with small amounts on devnet to test your automation before going to mainnet!

### 🔄 Swap Any Token

**Example: USDC → CHECKHC**
```json
{
  "operation": "executeSwapAdvanced",
  "dexProvider": "jupiter",
  "inputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "outputMint": "5tpkrCVVh6tjjve4TuyP8MXBwURufgAnaboaLwo49uau",
  "swapAmount": 10,
  "slippageBps": 100,
  "priorityFee": 5000
}
```

**DEX Options:**
- 🟢 `raydium` - Lower fees, faster execution (Recommended for popular tokens)
- 🔵 `jupiter` - Best routing, multi-DEX aggregation (Better for less liquid tokens)

## DEX Selection: Raydium vs Jupiter

| Feature | Raydium | Jupiter |
|---------|---------|----------|
| **Fees** | ✅ Lower | ⚠️ Variable |
| **Speed** | ✅ Fast | ⚠️ Depends on routing |
| **Best For** | Popular tokens | Exotic tokens |
| **Liquidity** | Raydium pools | Multi-DEX aggregation |
| **Recommended** | Default choice | Alternative option |

**When to use Raydium:**
- Swapping popular tokens (SOL, USDC, USDT, RAY, etc.)
- Want to minimize fees
- Need faster execution

**When to use Jupiter:**
- Swapping less common tokens
- Need best price across multiple DEXs
- Willing to pay higher fees for better routing

## 📋 Token Addresses (Mainnet)

### CHECKHC Ecosystem
- **CHECKHC Token**: `5tpkrCVVh6tjjve4TuyP8MXBwURufgAnaboaLwo49uau`
  - 💎 Our native utility token
  - 🎨 Used for content certification on Solana
  - 🔗 Trade on Raydium and Jupiter

### Popular Tokens
- **SOL (Wrapped)**: `So11111111111111111111111111111111111111112`
- **USDC**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **USDT**: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- **RAY (Raydium)**: `4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R`

> 🔍 Find more tokens on [Solscan](https://solscan.io) or [Jupiter Token List](https://station.jup.ag/)

## Security Notes

- Start with small amounts for testing
- Use dedicated wallets for n8n automation
- Test on devnet before mainnet
- Monitor transactions on Solscan

---

## 💙 About CHECKHC

We're a small team passionate about making Solana accessible to everyone. This node is our contribution to the n8n and Solana communities - **completely free, forever**.

### 🎨 Our Mission
**Content Certification on Solana**
- Protect your digital creations (photos, documents, art, videos)
- Immutable proof of authenticity stored on-chain
- GDPR-compliant and enterprise-ready

### 🪙 CHECKHC Token
Our utility token powers our content certification platform:
- **Symbol**: CHECKHC
- **Use Cases**: Certification fees, platform access, governance
- **Trade**: Available on Raydium and Jupiter
- **Contract**: `5tpkrCVVh6tjjve4TuyP8MXBwURufgAnaboaLwo49uau`

### 🤝 Support Us
If this node saves you time, consider:
- ⭐ **Star** our [GitHub repo](https://github.com/checkhc/n8n-nodes-solana-swap)
- 🐦 **Follow** us on [Twitter/X](https://twitter.com/checkhc)
- 💎 **Try** our [CHECKHC token](https://checkhc.net)
- 📧 **Share** your feedback at [contact@checkhc.net](mailto:contact@checkhc.net)

### 🏢 Professional Services
Need custom Solana automation or n8n workflows?
- 🔧 Custom node development
- 🤖 Trading bot implementation
- 🎨 Content certification integration
- 📊 Blockchain analytics workflows

**Get in touch**: [contact@checkhc.net](mailto:contact@checkhc.net) | [https://checkhc.net](https://checkhc.net)

---

## Development & Deployment

### Architecture

This node uses **pre-compiled distribution** following n8n best practices:
- TypeScript source files in `nodes/` and `credentials/`
- Pre-compiled JavaScript files in `dist/` (included in Git)
- n8n loads nodes from `dist/` - **NO compilation happens at install time**

### Jupiter API Configuration

**IMPORTANT**: This node uses Jupiter DEX aggregator for swaps.

**Correct API URLs**:
- Quote endpoint: `https://lite-api.jup.ag/swap/v1/quote`
- Swap endpoint: `https://lite-api.jup.ag/swap/v1/swap`

**⚠️ Common Error**: The domain `quote-api.jup.ag` does NOT exist and will cause `ENOTFOUND` errors. Always use `lite-api.jup.ag`.

### Local Development (WSL2/Linux)

```bash
# 1. Clone the repository
git clone https://github.com/checkhc/n8n-nodes-solana-swap.git
cd n8n-nodes-solana-swap

# 2. Install dependencies
yarn install

# 3. Make your changes in nodes/ or credentials/

# 4. Compile TypeScript to JavaScript
yarn build

# 5. Commit changes (includes dist/ folder)
git add .
git commit -m "Your commit message"
git push origin main

# 6. Create package for local testing
yarn pack

# 7. Install in n8n (replace with your actual paths)
cd ~/.n8n/nodes
npm uninstall n8n-nodes-solana-swap
npm install /path/to/n8n-nodes-solana-swap/n8n-nodes-solana-swap-v1.3.0.tgz

# 8. Restart n8n (choose your method)
# Systemd: sudo systemctl restart n8n
# PM2: pm2 restart n8n
# Docker: docker restart <container-name>
# Custom scripts: ./stop-n8n.sh && ./start-n8n.sh
```

### Production Deployment (Docker Container)

**Simple Git-based deployment** - NO compilation needed on server:

```bash
# 1. Enter the Docker container (replace <container-name> with yours)
docker exec -it <container-name> /bin/sh

# 2. Navigate to the node directory
cd /home/node/.n8n/nodes/node_modules/n8n-nodes-solana-swap

# 3. Pull pre-compiled files from GitHub
git pull origin main

# 4. Exit container
exit

# 5. Restart n8n container
docker restart <container-name>

# 6. Verify logs
docker logs -f <container-name>
```

**Why it's simple**:
- ✅ `dist/` folder is versioned in Git with compiled JS files
- ✅ No need to run `npm install` or `npm run build` on server
- ✅ Just `git pull` to get latest pre-compiled version
- ✅ Existing workflows work automatically without modification

### Troubleshooting

**Error: `getaddrinfo ENOTFOUND quote-api.jup.ag`**
- **Cause**: Incorrect Jupiter API URL
- **Solution**: Update to `lite-api.jup.ag/swap/v1` (see commit 886870a)
- **Fix**: Run `git pull origin main` and restart

**Error: Node not updating after changes**
- **Cause**: n8n caches nodes from `~/.n8n/nodes/node_modules/`
- **Solution**: Remove and reinstall the package, then restart n8n

**Error: Workflows not working after update**
- **Cause**: n8n needs restart to load new node version
- **Solution**: Always restart n8n after updating nodes

## Support

### Community
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/checkhc/n8n-nodes-solana-swap/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/checkhc/n8n-nodes-solana-swap/discussions)
- 📖 **Documentation**: [GitHub Wiki](https://github.com/checkhc/n8n-nodes-solana-swap/wiki)

### Professional Support
Need custom development or enterprise support?
- 📧 **Email**: [contact@checkhc.net](mailto:contact@checkhc.net)
- 🌐 **Website**: [https://checkhc.net](https://checkhc.net)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details

---

---

<div align="center">

**Made with ❤️ by [CHECKHC](https://checkhc.net)**

*Empowering Solana automation for everyone - 100% free, forever*

🌐 [Website](https://checkhc.net) • 🐦 [Twitter](https://twitter.com/checkhc) • 💬 [Discord](https://discord.gg/checkhc) • 📧 [Email](mailto:contact@checkhc.net)

⭐ **Star us on GitHub** if this node is useful to you!

</div>
