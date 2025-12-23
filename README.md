# n8n-nodes-solana-swap

<div align="center">

[![npm version](https://badge.fury.io/js/n8n-nodes-solana-swap.svg)](https://www.npmjs.com/package/n8n-nodes-solana-swap)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CHECKHC](https://img.shields.io/badge/Powered_by-CHECKHC-orange?style=flat&logo=solana)](https://www.checkhc.net)
[![Discord Support](https://img.shields.io/badge/Support-Discord-5865F2)](https://discord.com/channels/1324516144979382335/1429512698504151200)

### ⚡ **Solana Blockchain Operations & DEX Trading**

**Powered by [CHECKHC](https://www.checkhc.net) - The Certified Human Data Layer for the AI Era**

[🌐 CHECKHC.net](https://www.checkhc.net) | [📦 GitHub](https://github.com/checkhc/n8n-nodes-solana-swap) | [💬 Discord Support](https://discord.com/channels/1324516144979382335/1429512698504151200)

</div>

---

## 🎯 What's Inside This Package?

Complete Solana automation node for n8n - Trade tokens, check balances, and send tokens with enterprise-grade features.

### **Key Features:**

- 🔄 **Dual DEX Support** - Raydium (lower fees) AND Jupiter (best routing)
- 💰 **Token Swaps** - Trade any SPL token with automatic signing
- 💸 **Token Transfers** - Send SOL, USDC, USDT, CHECKHC or any SPL token
- 📊 **Balance Checks** - SOL and SPL token balances
- 📈 **Price Tracking** - Live token prices via CoinGecko
- 📜 **Transaction History** - Full account activity logs
- 🔐 **Enterprise Security** - Sanitized errors, timeout protection, retry logic

---

## 🔗 Related CHECKHC Packages

| Package | Use Case |
|---------|----------|
| **n8n-nodes-solana-swap** (this) | DEX trading & Solana operations |
| [n8n-nodes-digicryptostore](https://www.npmjs.com/package/n8n-nodes-digicryptostore) | NFT Document certification |
| [n8n-nodes-photocertif](https://www.npmjs.com/package/n8n-nodes-photocertif) | Image & Art certification with AI |
| [n8n-nodes-proofofauthenticity](https://www.npmjs.com/package/n8n-nodes-proofofauthenticity) | Lightweight hash timestamping + C2PA |

---

## 🚀 Quick Start

### **1. Install**

```bash
cd ~/.n8n/nodes
npm install n8n-workflow
npm install n8n-nodes-solana-swap
```

Restart n8n after installation.

### **2. Configure Credentials**

In n8n: **Credentials** → **Solana API**

- **Network**: mainnet-beta, devnet, or testnet
- **RPC Endpoint**: Public RPC or custom (Helius, QuickNode)
- **Public Key**: Your wallet address
- **Private Key**: For swap/transfer operations (base58 format)

---

## 📚 Operations

| Operation | Description |
|-----------|-------------|
| `Get Balance` | Get SOL balance of a wallet |
| `Get Token Balance` | Get SPL token balance |
| `Get Token Price` | Get current price via CoinGecko |
| `Get Transaction History` | Get wallet transaction history |
| `Get Account Info` | Get on-chain account data |
| `Get Swap Quote` | Get quote from Raydium or Jupiter |
| `Execute Swap` | Prepare swap transaction |
| `Execute Swap (Advanced)` | Execute swap with auto-signing |
| `Send Token` | Send SOL or SPL tokens |

---

## 🔄 DEX Selection

| Feature | Raydium | Jupiter |
|---------|---------|---------|
| **Fees** | ✅ Lower | Variable |
| **Speed** | ✅ Fast | Depends on routing |
| **Best For** | Popular tokens | Exotic tokens |

---

## 📋 Common Token Addresses

| Token | Mint Address |
|-------|-------------|
| **SOL** | `So11111111111111111111111111111111111111112` |
| **USDC** | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| **USDT** | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| **CHECKHC** | `5tpkrCVVh6tjjve4TuyP8MXBwURufgAnaboaLwo49uau` |

---

## 🔐 Security Best Practices

✅ **DO:**
- Use a dedicated wallet for n8n automation
- Test on devnet before mainnet
- Start with small amounts
- Monitor transactions on [Solscan](https://solscan.io)

❌ **DON'T:**
- Use your main wallet
- Store large amounts in automation wallet
- Share your private key

---

## 🐛 Troubleshooting

### **"getaddrinfo ENOTFOUND quote-api.jup.ag"**
- This node uses correct URLs: `lite-api.jup.ag/swap/v1`
- If you see this error, update to latest version

### **"Node not updating"**
- Remove and reinstall the package
- Restart n8n after updates

---

## 🔗 Links

- **🌐 Official Website**: https://www.checkhc.net
- **📚 GitHub**: https://github.com/checkhc/n8n-nodes-solana-swap
- **📦 npm Package**: https://www.npmjs.com/package/n8n-nodes-solana-swap
- **Discord Support**: https://discord.com/channels/1324516144979382335/1429512698504151200
- **Email Support**: contact@checkhc.net

---

## 📄 License

MIT © [CHECKHC](https://checkhc.net)

---

## 🏢 About CHECKHC

**[CHECKHC](https://www.checkhc.net)** is building the **Certified Human Data Layer for the AI Era**.

### **🛠️ Our Solutions:**

- ⚡ **Solana Swap** - This package! DEX trading automation
- 📸 **PhotoCertif** - Image & Art certification with AI
- 📄 **DigiCryptoStore** - NFT document certification
- 📝 **ProofOfAuthenticity** - Privacy-first hash timestamping
- 🪙 **$CHECKHC Token** - Native utility token

📧 Contact: **contact@checkhc.net**  
🌐 **Official Website: [www.checkhc.net](https://www.checkhc.net)**

---

**Made with ❤️ by CHECKHC** - Empowering Solana automation for everyone 🚀
