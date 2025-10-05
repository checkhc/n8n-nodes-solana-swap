"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolanaNode = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const bs58 = __importStar(require("bs58"));
const axios_1 = __importDefault(require("axios"));
const web3_js_1 = require("@solana/web3.js");
const LAMPORTS_PER_SOL = 1000000000;
// Helper functions for Solana RPC calls
class SolanaRPC {
    constructor(rpcUrl) {
        this.rpcUrl = rpcUrl;
    }
    async call(method, params = []) {
        const response = await axios_1.default.post(this.rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method,
            params,
        }, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (response.data.error) {
            throw new Error(`RPC Error: ${response.data.error.message}`);
        }
        return response.data.result;
    }
    async getBalance(publicKey) {
        const result = await this.call('getBalance', [publicKey]);
        return result.value;
    }
    async getTokenAccountsByOwner(owner, mint) {
        const result = await this.call('getTokenAccountsByOwner', [
            owner,
            { mint },
            { encoding: 'jsonParsed' },
        ]);
        return result.value;
    }
    async getSignaturesForAddress(address, limit = 10) {
        const result = await this.call('getSignaturesForAddress', [
            address,
            { limit },
        ]);
        return result;
    }
    async getTransaction(signature) {
        const result = await this.call('getTransaction', [
            signature,
            { encoding: 'jsonParsed' },
        ]);
        return result;
    }
    // Jupiter API methods
    async getJupiterQuote(inputMint, outputMint, amount, slippageBps = 50) {
        const jupiterUrl = 'https://lite-api.jup.ag/swap/v1/quote';
        const params = new URLSearchParams({
            inputMint,
            outputMint,
            amount: amount.toString(),
            slippageBps: slippageBps.toString(),
        });
        const response = await axios_1.default.get(`${jupiterUrl}?${params}`);
        if (response.data.error) {
            throw new Error(`Jupiter Error: ${response.data.error}`);
        }
        return response.data;
    }
    async getJupiterSwapTransaction(quoteResponse, userPublicKey, priorityFee = 0) {
        const jupiterUrl = 'https://lite-api.jup.ag/swap/v1/swap';
        const swapRequest = {
            quoteResponse,
            userPublicKey,
            wrapAndUnwrapSol: true,
            priorityLevelWithMaxLamports: priorityFee > 0 ? {
                priorityLevel: 'high',
                maxLamports: priorityFee,
            } : undefined,
        };
        const response = await axios_1.default.post(jupiterUrl, swapRequest, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (response.data.error) {
            throw new Error(`Jupiter Swap Error: ${response.data.error}`);
        }
        return response.data;
    }
    // Token transfer methods
    async createSolTransferTransaction(fromPublicKey, toPublicKey, lamports, priorityFee = 0) {
        const recentBlockhash = await this.call('getLatestBlockhash');
        const transaction = {
            feePayer: fromPublicKey,
            recentBlockhash: recentBlockhash.value.blockhash,
            instructions: [
                {
                    programId: '11111111111111111111111111111111',
                    keys: [
                        { pubkey: fromPublicKey, isSigner: true, isWritable: true },
                        { pubkey: toPublicKey, isSigner: false, isWritable: true },
                    ],
                    data: this.createTransferInstruction(lamports),
                },
            ],
        };
        if (priorityFee > 0) {
            transaction.instructions.unshift({
                programId: 'ComputeBudget111111111111111111111111111111',
                keys: [],
                data: this.createPriorityFeeInstruction(priorityFee),
            });
        }
        return transaction;
    }
    async createSplTransferTransaction(fromPublicKey, toPublicKey, tokenMint, amount, decimals, priorityFee = 0) {
        const recentBlockhash = await this.call('getLatestBlockhash');
        // Get or create associated token accounts
        const fromTokenAccount = await this.getAssociatedTokenAccount(fromPublicKey, tokenMint);
        const toTokenAccount = await this.getAssociatedTokenAccount(toPublicKey, tokenMint);
        const adjustedAmount = amount * Math.pow(10, decimals);
        const transaction = {
            feePayer: fromPublicKey,
            recentBlockhash: recentBlockhash.value.blockhash,
            instructions: [],
        };
        // Add priority fee if specified
        if (priorityFee > 0) {
            transaction.instructions.push({
                programId: 'ComputeBudget111111111111111111111111111111',
                keys: [],
                data: this.createPriorityFeeInstruction(priorityFee),
            });
        }
        // Create destination token account if it doesn't exist
        const toTokenAccountInfo = await this.call('getAccountInfo', [toTokenAccount]);
        if (!toTokenAccountInfo.value) {
            transaction.instructions.push({
                programId: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
                keys: [
                    { pubkey: fromPublicKey, isSigner: true, isWritable: true },
                    { pubkey: toTokenAccount, isSigner: false, isWritable: true },
                    { pubkey: toPublicKey, isSigner: false, isWritable: false },
                    { pubkey: tokenMint, isSigner: false, isWritable: false },
                    { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
                    { pubkey: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', isSigner: false, isWritable: false },
                ],
                data: Buffer.from([]),
            });
        }
        // Add transfer instruction
        transaction.instructions.push({
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            keys: [
                { pubkey: fromTokenAccount, isSigner: false, isWritable: true },
                { pubkey: toTokenAccount, isSigner: false, isWritable: true },
                { pubkey: fromPublicKey, isSigner: true, isWritable: false },
            ],
            data: this.createSplTransferInstruction(adjustedAmount),
        });
        return transaction;
    }
    createTransferInstruction(lamports) {
        const data = Buffer.alloc(12);
        data.writeUInt32LE(2, 0); // Transfer instruction
        data.writeBigUInt64LE(BigInt(lamports), 4);
        return data;
    }
    createSplTransferInstruction(amount) {
        const data = Buffer.alloc(9);
        data.writeUInt8(3, 0); // Transfer instruction
        data.writeBigUInt64LE(BigInt(amount), 1);
        return data;
    }
    createPriorityFeeInstruction(microLamports) {
        const data = Buffer.alloc(9);
        data.writeUInt8(3, 0); // SetComputeUnitPrice instruction
        data.writeBigUInt64LE(BigInt(microLamports), 1);
        return data;
    }
    getAssociatedTokenAccount(owner, mint) {
        // This is a simplified version - in production, use @solana/spl-token
        // For now, we'll use a placeholder that works with common tokens
        return `${owner}_${mint}_ata`;
    }
    async sendTransaction(serializedTransaction) {
        const result = await this.call('sendTransaction', [
            serializedTransaction,
            {
                encoding: 'base64',
                skipPreflight: false,
                preflightCommitment: 'confirmed',
            },
        ]);
        return result;
    }
}
class SolanaNode {
    constructor() {
        this.description = {
            displayName: 'Solana',
            name: 'solanaNode',
            icon: 'file:solana.svg',
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["operation"]}}',
            description: 'Interact with Solana blockchain',
            defaults: {
                name: 'Solana',
            },
            inputs: ['main'],
            outputs: ['main'],
            credentials: [
                {
                    name: 'solanaApi',
                    required: true,
                },
            ],
            properties: [
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    options: [
                        {
                            name: 'Get Balance',
                            value: 'getBalance',
                            description: 'Get SOL balance of a wallet',
                            action: 'Get the SOL balance of a wallet',
                        },
                        {
                            name: 'Get Token Balance',
                            value: 'getTokenBalance',
                            description: 'Get balance of a specific SPL token',
                            action: 'Get the balance of a specific SPL token',
                        },
                        {
                            name: 'Get Token Price',
                            value: 'getTokenPrice',
                            description: 'Get current price of a token',
                            action: 'Get current price of a token',
                        },
                        {
                            name: 'Get Transaction History',
                            value: 'getTransactionHistory',
                            description: 'Get transaction history for a wallet',
                            action: 'Get transaction history for a wallet',
                        },
                        {
                            name: 'Get Account Info',
                            value: 'getAccountInfo',
                            description: 'Get account information',
                            action: 'Get account information',
                        },
                        {
                            name: 'Get Swap Quote',
                            value: 'getSwapQuote',
                            description: 'Get quote for token swap via Jupiter',
                            action: 'Get quote for token swap via Jupiter',
                        },
                        {
                            name: 'Execute Swap',
                            value: 'executeSwap',
                            description: 'Prepare token swap transaction via Jupiter',
                            action: 'Prepare token swap transaction via Jupiter',
                        },
                        {
                            name: 'Execute Swap (Advanced)',
                            value: 'executeSwapAdvanced',
                            description: 'Execute token swap with proper transaction signing',
                            action: 'Execute token swap with proper transaction signing',
                        },
                        {
                            name: 'Send Token',
                            value: 'sendToken',
                            description: 'Send SOL or SPL tokens to another wallet',
                            action: 'Send SOL or SPL tokens to another wallet',
                        },
                    ],
                    default: 'getBalance',
                },
                // Get Balance parameters
                {
                    displayName: 'Wallet Address',
                    name: 'walletAddress',
                    type: 'string',
                    default: '',
                    placeholder: 'Enter wallet address or leave empty to use credential wallet',
                    displayOptions: {
                        show: {
                            operation: ['getBalance', 'getAccountInfo'],
                        },
                    },
                    description: 'Wallet address to check balance for (leave empty to use credential wallet)',
                },
                // Get Token Balance parameters
                {
                    displayName: 'Wallet Address',
                    name: 'walletAddress',
                    type: 'string',
                    default: '',
                    placeholder: 'Enter wallet address or leave empty to use credential wallet',
                    displayOptions: {
                        show: {
                            operation: ['getTokenBalance'],
                        },
                    },
                    description: 'Wallet address to check token balance for',
                },
                {
                    displayName: 'Token Mint Address',
                    name: 'tokenMint',
                    type: 'string',
                    default: '',
                    placeholder: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                    displayOptions: {
                        show: {
                            operation: ['getTokenBalance'],
                        },
                    },
                    description: 'Token mint address (e.g., USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)',
                },
                // Get Token Price parameters
                {
                    displayName: 'Token Symbol',
                    name: 'tokenSymbol',
                    type: 'string',
                    default: 'SOL',
                    displayOptions: {
                        show: {
                            operation: ['getTokenPrice'],
                        },
                    },
                    description: 'Token symbol (e.g., SOL, USDC)',
                },
                // Get Transaction History parameters
                {
                    displayName: 'Wallet Address',
                    name: 'walletAddress',
                    type: 'string',
                    default: '',
                    displayOptions: {
                        show: {
                            operation: ['getTransactionHistory'],
                        },
                    },
                    description: 'Wallet address to get transaction history for',
                },
                {
                    displayName: 'Limit',
                    name: 'limit',
                    type: 'number',
                    default: 10,
                    displayOptions: {
                        show: {
                            operation: ['getTransactionHistory'],
                        },
                    },
                    description: 'Number of transactions to retrieve',
                },
                // Get Swap Quote parameters
                {
                    displayName: 'Input Token Mint',
                    name: 'inputMint',
                    type: 'string',
                    required: true,
                    default: 'So11111111111111111111111111111111111111112',
                    placeholder: 'So11111111111111111111111111111111111111112',
                    displayOptions: {
                        show: {
                            operation: ['getSwapQuote', 'executeSwap', 'executeSwapAdvanced'],
                        },
                    },
                    description: 'Input token mint address (SOL: So11111111111111111111111111111111111111112)',
                },
                {
                    displayName: 'Output Token Mint',
                    name: 'outputMint',
                    type: 'string',
                    required: true,
                    default: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                    placeholder: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                    displayOptions: {
                        show: {
                            operation: ['getSwapQuote', 'executeSwap', 'executeSwapAdvanced'],
                        },
                    },
                    description: 'Output token mint address (USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)',
                },
                {
                    displayName: 'Amount',
                    name: 'swapAmount',
                    type: 'number',
                    required: true,
                    default: 0,
                    displayOptions: {
                        show: {
                            operation: ['getSwapQuote', 'executeSwap', 'executeSwapAdvanced'],
                        },
                    },
                    description: 'Amount to swap (in input token units)',
                },
                {
                    displayName: 'Slippage (%)',
                    name: 'slippageBps',
                    type: 'number',
                    default: 50,
                    displayOptions: {
                        show: {
                            operation: ['getSwapQuote', 'executeSwap', 'executeSwapAdvanced'],
                        },
                    },
                    description: 'Maximum slippage in basis points (50 = 0.5%)',
                },
                {
                    displayName: 'Priority Fee (Lamports)',
                    name: 'priorityFee',
                    type: 'number',
                    default: 0,
                    displayOptions: {
                        show: {
                            operation: ['executeSwap', 'executeSwapAdvanced'],
                        },
                    },
                    description: 'Priority fee in lamports for faster execution (optional)',
                },
                // Send Token parameters
                {
                    displayName: 'Recipient Address',
                    name: 'recipientAddress',
                    type: 'string',
                    required: true,
                    default: '',
                    placeholder: 'Enter recipient wallet address',
                    displayOptions: {
                        show: {
                            operation: ['sendToken'],
                        },
                    },
                    description: 'Wallet address to send tokens to',
                },
                {
                    displayName: 'Token Type',
                    name: 'tokenType',
                    type: 'options',
                    required: true,
                    default: 'SOL',
                    options: [
                        {
                            name: 'SOL (Native)',
                            value: 'SOL',
                            description: 'Send native SOL tokens',
                        },
                        {
                            name: 'USDC',
                            value: 'USDC',
                            description: 'Send USDC tokens',
                        },
                        {
                            name: 'USDT',
                            value: 'USDT',
                            description: 'Send USDT tokens',
                        },
                        {
                            name: 'CHECKHC',
                            value: 'CHECKHC',
                            description: 'Send CHECKHC tokens',
                        },
                        {
                            name: 'Custom Token',
                            value: 'CUSTOM',
                            description: 'Send custom SPL token',
                        },
                    ],
                    displayOptions: {
                        show: {
                            operation: ['sendToken'],
                        },
                    },
                    description: 'Type of token to send',
                },
                {
                    displayName: 'Custom Token Mint',
                    name: 'customTokenMint',
                    type: 'string',
                    required: true,
                    default: '',
                    placeholder: 'Enter token mint address',
                    displayOptions: {
                        show: {
                            operation: ['sendToken'],
                            tokenType: ['CUSTOM'],
                        },
                    },
                    description: 'Mint address of the custom SPL token',
                },
                {
                    displayName: 'Amount',
                    name: 'sendAmount',
                    type: 'number',
                    required: true,
                    default: 0,
                    placeholder: '0.1',
                    displayOptions: {
                        show: {
                            operation: ['sendToken'],
                        },
                    },
                    description: 'Amount to send (in token units, e.g., 0.1 SOL or 10 USDC)',
                },
                {
                    displayName: 'Priority Fee (Lamports)',
                    name: 'sendPriorityFee',
                    type: 'number',
                    default: 5000,
                    displayOptions: {
                        show: {
                            operation: ['sendToken'],
                        },
                    },
                    description: 'Priority fee in lamports for faster transaction processing',
                },
            ],
        };
    }
    async execute() {
        var _a, _b, _c;
        const items = this.getInputData();
        const returnData = [];
        for (let i = 0; i < items.length; i++) {
            try {
                const credentials = await this.getCredentials('solanaApi', i);
                const operation = this.getNodeParameter('operation', i);
                // Setup RPC connection
                let rpcUrl;
                if (credentials.rpcType === 'custom') {
                    rpcUrl = credentials.customRpcUrl;
                }
                else {
                    const network = credentials.network;
                    switch (network) {
                        case 'mainnet-beta':
                            rpcUrl = 'https://api.mainnet-beta.solana.com';
                            break;
                        case 'devnet':
                            rpcUrl = 'https://api.devnet.solana.com';
                            break;
                        case 'testnet':
                            rpcUrl = 'https://api.testnet.solana.com';
                            break;
                        default:
                            rpcUrl = 'https://api.devnet.solana.com';
                    }
                }
                const rpc = new SolanaRPC(rpcUrl);
                // Get wallet address
                let walletAddress;
                if (credentials.publicKey) {
                    walletAddress = credentials.publicKey;
                }
                else {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Public key must be provided in credentials');
                }
                let result = {};
                switch (operation) {
                    case 'getBalance':
                        const balanceWallet = this.getNodeParameter('walletAddress', i) || walletAddress;
                        const balance = await rpc.getBalance(balanceWallet);
                        result = {
                            walletAddress: balanceWallet,
                            balance: balance / LAMPORTS_PER_SOL,
                            balanceLamports: balance,
                        };
                        break;
                    case 'getTokenBalance':
                        const tokenWallet = this.getNodeParameter('walletAddress', i) || walletAddress;
                        const tokenMint = this.getNodeParameter('tokenMint', i);
                        try {
                            const tokenAccounts = await rpc.getTokenAccountsByOwner(tokenWallet, tokenMint);
                            if (tokenAccounts.length > 0) {
                                const tokenAccount = tokenAccounts[0];
                                const balance = tokenAccount.account.data.parsed.info.tokenAmount;
                                result = {
                                    walletAddress: tokenWallet,
                                    tokenMint: tokenMint,
                                    balance: parseFloat(balance.uiAmountString || '0'),
                                    balanceRaw: balance.amount,
                                    decimals: balance.decimals,
                                };
                            }
                            else {
                                result = {
                                    walletAddress: tokenWallet,
                                    tokenMint: tokenMint,
                                    balance: 0,
                                    balanceRaw: '0',
                                    error: 'Token account not found',
                                };
                            }
                        }
                        catch (error) {
                            result = {
                                walletAddress: tokenWallet,
                                tokenMint: tokenMint,
                                balance: 0,
                                balanceRaw: '0',
                                error: error.message,
                            };
                        }
                        break;
                    case 'getTokenPrice':
                        const tokenSymbol = this.getNodeParameter('tokenSymbol', i);
                        try {
                            // Using CoinGecko API for price data
                            const priceResponse = await axios_1.default.get(`https://api.coingecko.com/api/v3/simple/price?ids=${tokenSymbol.toLowerCase()}&vs_currencies=usd`);
                            const price = (_a = priceResponse.data[tokenSymbol.toLowerCase()]) === null || _a === void 0 ? void 0 : _a.usd;
                            result = {
                                symbol: tokenSymbol,
                                price: price || 0,
                                currency: 'USD',
                                timestamp: new Date().toISOString(),
                            };
                        }
                        catch (error) {
                            result = {
                                symbol: tokenSymbol,
                                price: 0,
                                currency: 'USD',
                                error: 'Failed to fetch price data',
                                timestamp: new Date().toISOString(),
                            };
                        }
                        break;
                    case 'getTransactionHistory':
                        const historyWallet = this.getNodeParameter('walletAddress', i) || walletAddress;
                        const limit = this.getNodeParameter('limit', i);
                        try {
                            const signatures = await rpc.getSignaturesForAddress(historyWallet, limit);
                            const transactions = [];
                            for (const sig of signatures) {
                                const tx = await rpc.getTransaction(sig.signature);
                                if (tx) {
                                    transactions.push({
                                        signature: sig.signature,
                                        slot: sig.slot,
                                        blockTime: sig.blockTime,
                                        confirmationStatus: sig.confirmationStatus,
                                        fee: (_b = tx.meta) === null || _b === void 0 ? void 0 : _b.fee,
                                        success: ((_c = tx.meta) === null || _c === void 0 ? void 0 : _c.err) === null,
                                    });
                                }
                            }
                            result = {
                                walletAddress: historyWallet,
                                transactions,
                                count: transactions.length,
                            };
                        }
                        catch (error) {
                            result = {
                                walletAddress: historyWallet,
                                transactions: [],
                                count: 0,
                                error: error.message,
                            };
                        }
                        break;
                    case 'getAccountInfo':
                        const accountWallet = this.getNodeParameter('walletAddress', i) || walletAddress;
                        try {
                            const accountInfo = await rpc.call('getAccountInfo', [
                                accountWallet,
                                { encoding: 'jsonParsed' },
                            ]);
                            result = {
                                walletAddress: accountWallet,
                                accountInfo: accountInfo.value,
                                exists: accountInfo.value !== null,
                            };
                        }
                        catch (error) {
                            result = {
                                walletAddress: accountWallet,
                                accountInfo: null,
                                exists: false,
                                error: error.message,
                            };
                        }
                        break;
                    case 'getSwapQuote':
                        const inputMint = this.getNodeParameter('inputMint', i);
                        const outputMint = this.getNodeParameter('outputMint', i);
                        const swapAmount = this.getNodeParameter('swapAmount', i);
                        const slippageBps = this.getNodeParameter('slippageBps', i);
                        try {
                            // Convert amount to proper decimals (assuming input token decimals)
                            let amountInSmallestUnit;
                            if (inputMint === 'So11111111111111111111111111111111111111112') {
                                // SOL has 9 decimals
                                amountInSmallestUnit = swapAmount * LAMPORTS_PER_SOL;
                            }
                            else {
                                // For other tokens, assume 6 decimals (most common)
                                // In production, you should fetch the mint info to get exact decimals
                                amountInSmallestUnit = swapAmount * 1000000;
                            }
                            const quote = await rpc.getJupiterQuote(inputMint, outputMint, amountInSmallestUnit, slippageBps);
                            result = {
                                inputMint,
                                outputMint,
                                inputAmount: swapAmount,
                                inputAmountRaw: amountInSmallestUnit.toString(),
                                outputAmount: parseFloat(quote.outAmount) / (outputMint === 'So11111111111111111111111111111111111111112' ? LAMPORTS_PER_SOL : 1000000),
                                outputAmountRaw: quote.outAmount,
                                priceImpactPct: quote.priceImpactPct,
                                slippageBps: slippageBps,
                                routePlan: quote.routePlan,
                                quote: quote,
                                timestamp: new Date().toISOString(),
                            };
                        }
                        catch (error) {
                            result = {
                                inputMint,
                                outputMint,
                                inputAmount: swapAmount,
                                error: error.message,
                                timestamp: new Date().toISOString(),
                            };
                        }
                        break;
                    case 'executeSwap':
                        const execInputMint = this.getNodeParameter('inputMint', i);
                        const execOutputMint = this.getNodeParameter('outputMint', i);
                        const execSwapAmount = this.getNodeParameter('swapAmount', i);
                        const execSlippageBps = this.getNodeParameter('slippageBps', i);
                        const priorityFee = this.getNodeParameter('priorityFee', i);
                        try {
                            // Convert amount to proper decimals
                            let execAmountInSmallestUnit;
                            if (execInputMint === 'So11111111111111111111111111111111111111112') {
                                execAmountInSmallestUnit = execSwapAmount * LAMPORTS_PER_SOL;
                            }
                            else {
                                execAmountInSmallestUnit = execSwapAmount * 1000000;
                            }
                            // Get quote first
                            const execQuote = await rpc.getJupiterQuote(execInputMint, execOutputMint, execAmountInSmallestUnit, execSlippageBps);
                            // Get swap transaction data (but don't execute it automatically)
                            const swapTransaction = await rpc.getJupiterSwapTransaction(execQuote, walletAddress, priorityFee);
                            result = {
                                swapTransaction: swapTransaction.swapTransaction,
                                inputMint: execInputMint,
                                outputMint: execOutputMint,
                                inputAmount: execSwapAmount,
                                inputAmountRaw: execAmountInSmallestUnit.toString(),
                                outputAmount: parseFloat(execQuote.outAmount) / (execOutputMint === 'So11111111111111111111111111111111111111112' ? LAMPORTS_PER_SOL : 1000000),
                                outputAmountRaw: execQuote.outAmount,
                                priceImpactPct: execQuote.priceImpactPct,
                                slippageBps: execSlippageBps,
                                priorityFee: priorityFee,
                                timestamp: new Date().toISOString(),
                                status: 'transaction_ready',
                                instructions: 'Use the swapTransaction field with your wallet to sign and send the transaction',
                                note: 'For security reasons, transaction signing should be done client-side with your wallet'
                            };
                        }
                        catch (error) {
                            result = {
                                inputMint: execInputMint,
                                outputMint: execOutputMint,
                                inputAmount: execSwapAmount,
                                error: error.message,
                                timestamp: new Date().toISOString(),
                                status: 'failed',
                            };
                        }
                        break;
                    case 'executeSwapAdvanced':
                        if (!credentials.privateKey) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Private key required for swap execution');
                        }
                        const advInputMint = this.getNodeParameter('inputMint', i);
                        const advOutputMint = this.getNodeParameter('outputMint', i);
                        const advSwapAmount = this.getNodeParameter('swapAmount', i);
                        const advSlippageBps = this.getNodeParameter('slippageBps', i);
                        const advPriorityFee = this.getNodeParameter('priorityFee', i);
                        try {
                            // Convert amount to proper decimals
                            let advAmountInSmallestUnit;
                            if (advInputMint === 'So11111111111111111111111111111111111111112') {
                                advAmountInSmallestUnit = advSwapAmount * LAMPORTS_PER_SOL;
                            }
                            else {
                                advAmountInSmallestUnit = advSwapAmount * 1000000;
                            }
                            // Get quote first
                            const advQuote = await rpc.getJupiterQuote(advInputMint, advOutputMint, advAmountInSmallestUnit, advSlippageBps);
                            // Get swap transaction
                            const advSwapTransaction = await rpc.getJupiterSwapTransaction(advQuote, walletAddress, advPriorityFee);
                            // Create keypair from private key
                            const privateKeyBytes = bs58.decode(credentials.privateKey);
                            const keypair = web3_js_1.Keypair.fromSecretKey(privateKeyBytes);
                            // Deserialize and sign transaction properly
                            const transactionBuffer = Buffer.from(advSwapTransaction.swapTransaction, 'base64');
                            try {
                                // Try as VersionedTransaction first (Jupiter v6 format)
                                const versionedTx = web3_js_1.VersionedTransaction.deserialize(transactionBuffer);
                                versionedTx.sign([keypair]);
                                const signedTxBuffer = versionedTx.serialize();
                                const signedTxBase64 = Buffer.from(signedTxBuffer).toString('base64');
                                // Send transaction
                                const txSignature = await rpc.sendTransaction(signedTxBase64);
                                result = {
                                    signature: txSignature,
                                    inputMint: advInputMint,
                                    outputMint: advOutputMint,
                                    inputAmount: advSwapAmount,
                                    inputAmountRaw: advAmountInSmallestUnit.toString(),
                                    outputAmount: parseFloat(advQuote.outAmount) / (advOutputMint === 'So11111111111111111111111111111111111111112' ? LAMPORTS_PER_SOL : 1000000),
                                    outputAmountRaw: advQuote.outAmount,
                                    priceImpactPct: advQuote.priceImpactPct,
                                    slippageBps: advSlippageBps,
                                    priorityFee: advPriorityFee,
                                    timestamp: new Date().toISOString(),
                                    status: 'submitted',
                                    transactionType: 'versioned'
                                };
                            }
                            catch (versionedError) {
                                // Fallback to legacy Transaction format
                                const legacyTx = web3_js_1.Transaction.from(transactionBuffer);
                                legacyTx.sign(keypair);
                                const signedTxBuffer = legacyTx.serialize();
                                const signedTxBase64 = Buffer.from(signedTxBuffer).toString('base64');
                                // Send transaction
                                const txSignature = await rpc.sendTransaction(signedTxBase64);
                                result = {
                                    signature: txSignature,
                                    inputMint: advInputMint,
                                    outputMint: advOutputMint,
                                    inputAmount: advSwapAmount,
                                    inputAmountRaw: advAmountInSmallestUnit.toString(),
                                    outputAmount: parseFloat(advQuote.outAmount) / (advOutputMint === 'So11111111111111111111111111111111111111112' ? LAMPORTS_PER_SOL : 1000000),
                                    outputAmountRaw: advQuote.outAmount,
                                    priceImpactPct: advQuote.priceImpactPct,
                                    slippageBps: advSlippageBps,
                                    priorityFee: advPriorityFee,
                                    timestamp: new Date().toISOString(),
                                    status: 'submitted',
                                    transactionType: 'legacy'
                                };
                            }
                        }
                        catch (error) {
                            result = {
                                inputMint: advInputMint,
                                outputMint: advOutputMint,
                                inputAmount: advSwapAmount,
                                error: error.message,
                                timestamp: new Date().toISOString(),
                                status: 'failed',
                            };
                        }
                        break;
                    case 'sendToken':
                        if (!credentials.privateKey) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Private key required for token transfer');
                        }
                        const recipientAddress = this.getNodeParameter('recipientAddress', i);
                        const tokenType = this.getNodeParameter('tokenType', i);
                        const sendAmount = this.getNodeParameter('sendAmount', i);
                        const sendPriorityFee = this.getNodeParameter('sendPriorityFee', i);
                        try {
                            let tokenMint;
                            let decimals;
                            // Define token configurations
                            const tokenConfigs = {
                                'SOL': { mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
                                'USDC': { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
                                'USDT': { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
                                'CHECKHC': { mint: '5tpkrCVVh6tjjve4TuyP8MXBwURufgAnaboaLwo49uau', decimals: 6 },
                            };
                            if (tokenType === 'CUSTOM') {
                                tokenMint = this.getNodeParameter('customTokenMint', i);
                                decimals = 6; // Default to 6 decimals for custom tokens
                            }
                            else if (tokenConfigs[tokenType]) {
                                tokenMint = tokenConfigs[tokenType].mint;
                                decimals = tokenConfigs[tokenType].decimals;
                            }
                            else {
                                throw new Error(`Unsupported token type: ${tokenType}`);
                            }
                            let transferTransaction;
                            if (tokenType === 'SOL') {
                                // SOL transfer
                                const lamports = sendAmount * LAMPORTS_PER_SOL;
                                transferTransaction = await rpc.createSolTransferTransaction(walletAddress, recipientAddress, lamports, sendPriorityFee);
                            }
                            else {
                                // SPL token transfer
                                transferTransaction = await rpc.createSplTransferTransaction(walletAddress, recipientAddress, tokenMint, sendAmount, decimals, sendPriorityFee);
                            }
                            // Create keypair from private key
                            const privateKeyBytes = bs58.decode(credentials.privateKey);
                            const keypair = web3_js_1.Keypair.fromSecretKey(privateKeyBytes);
                            // Use @solana/web3.js for transaction building
                            const { Transaction, SystemProgram, PublicKey, TransactionInstruction } = await Promise.resolve().then(() => __importStar(require('@solana/web3.js')));
                            let transaction;
                            if (tokenType === 'SOL') {
                                // Create SOL transfer transaction
                                transaction = new Transaction().add(SystemProgram.transfer({
                                    fromPubkey: new PublicKey(walletAddress),
                                    toPubkey: new PublicKey(recipientAddress),
                                    lamports: sendAmount * LAMPORTS_PER_SOL,
                                }));
                            }
                            else {
                                // For SPL tokens, we'll use a simplified approach
                                // In a production environment, you'd want to use @solana/spl-token
                                // For now, we'll return an error asking users to use SOL transfers
                                throw new Error(`SPL token transfers (${tokenType}) are not yet implemented. Please use SOL transfers for now, or use the swap functionality to convert to SOL first.`);
                            }
                            // Set recent blockhash
                            const blockhashResult = await rpc.call('getLatestBlockhash');
                            transaction.recentBlockhash = blockhashResult.value.blockhash;
                            transaction.feePayer = new PublicKey(walletAddress);
                            // Sign transaction
                            transaction.sign(keypair);
                            // Serialize and send
                            const serializedTx = transaction.serialize().toString('base64');
                            const signature = await rpc.sendTransaction(serializedTx);
                            result = {
                                signature,
                                from: walletAddress,
                                to: recipientAddress,
                                tokenType,
                                tokenMint: tokenType !== 'SOL' ? tokenMint : undefined,
                                amount: sendAmount,
                                priorityFee: sendPriorityFee,
                                timestamp: new Date().toISOString(),
                                status: 'submitted',
                            };
                        }
                        catch (error) {
                            result = {
                                from: walletAddress,
                                to: recipientAddress,
                                tokenType,
                                amount: sendAmount,
                                error: error.message,
                                timestamp: new Date().toISOString(),
                                status: 'failed',
                            };
                        }
                        break;
                    default:
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
                }
                returnData.push({
                    json: result,
                    pairedItem: { item: i },
                });
            }
            catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: {
                            error: error.message,
                        },
                        pairedItem: { item: i },
                    });
                    continue;
                }
                throw error;
            }
        }
        return [returnData];
    }
}
exports.SolanaNode = SolanaNode;
