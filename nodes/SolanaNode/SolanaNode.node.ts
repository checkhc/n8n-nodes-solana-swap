import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import * as bs58 from 'bs58';
import * as nacl from 'tweetnacl';
import axios from 'axios';
import { Transaction, VersionedTransaction, Keypair, PublicKey } from '@solana/web3.js';

// Constants
const LAMPORTS_PER_SOL = 1000000000;
const SOL_MINT_ADDRESS = 'So11111111111111111111111111111111111111112';
const DEFAULT_TOKEN_DECIMALS = 6;
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const API_TIMEOUT_MS = 30000;
const PRIORITY_FEE_CACHE_MS = 10000;

// Helper functions for Solana RPC calls
class SolanaRPC {
	public rpcUrl: string;
	private priorityFeeCache: { value: number; timestamp: number } | null = null;
	private axiosInstance;

	constructor(rpcUrl: string) {
		this.rpcUrl = rpcUrl;
		// Configure axios with timeout and retry
		this.axiosInstance = axios.create({
			timeout: API_TIMEOUT_MS,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// Validation utilities
	private validateSolanaAddress(address: string): boolean {
		const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
		return base58Regex.test(address);
	}

	private convertToSmallestUnit(amount: number, mint: string): number {
		if (mint === SOL_MINT_ADDRESS) {
			return amount * LAMPORTS_PER_SOL;
		}
		return amount * Math.pow(10, DEFAULT_TOKEN_DECIMALS);
	}

	async call(method: string, params: any[] = [], retries = 3): Promise<any> {
		for (let attempt = 0; attempt < retries; attempt++) {
			try {
				const response = await this.axiosInstance.post(this.rpcUrl, {
					jsonrpc: '2.0',
					id: Date.now(),
					method,
					params,
				});

				if (response.data.error) {
					throw new Error(
						`RPC Error (${method}): ${response.data.error.message}\nEndpoint: ${this.rpcUrl}`
					);
				}

				return response.data.result;
			} catch (error) {
				if (attempt === retries - 1) throw error;
				await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
			}
		}
	}

	async getBalance(publicKey: string): Promise<number> {
		const result = await this.call('getBalance', [publicKey]);
		return result.value;
	}

	async getTokenAccountsByOwner(owner: string, mint: string): Promise<any> {
		const result = await this.call('getTokenAccountsByOwner', [
			owner,
			{ mint },
			{ encoding: 'jsonParsed' },
		]);
		return result.value;
	}

	async getSignaturesForAddress(address: string, limit: number = 10): Promise<any[]> {
		const result = await this.call('getSignaturesForAddress', [
			address,
			{ limit },
		]);
		return result;
	}

	async getTransaction(signature: string): Promise<any> {
		const result = await this.call('getTransaction', [
			signature,
			{ encoding: 'jsonParsed' },
		]);
		return result;
	}

	// Jupiter API methods
	async getJupiterQuote(inputMint: string, outputMint: string, amount: number, slippageBps: number = 50): Promise<any> {
		const jupiterUrl = 'https://lite-api.jup.ag/swap/v1/quote';
		const params = new URLSearchParams({
			inputMint,
			outputMint,
			amount: amount.toString(),
			slippageBps: slippageBps.toString(),
		});

		const response = await this.axiosInstance.get(`${jupiterUrl}?${params}`);
		
		if (response.data.error) {
			throw new Error(
				`Jupiter Error: ${response.data.error}\nInput: ${inputMint} -> Output: ${outputMint}\nAmount: ${amount}`
			);
		}

		return response.data;
	}

	async getJupiterSwapTransaction(quoteResponse: any, userPublicKey: string, priorityFee: number = 0): Promise<any> {
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

		const response = await this.axiosInstance.post(jupiterUrl, swapRequest);

		if (response.data.error) {
			throw new Error(`Jupiter Swap Error: ${response.data.error}`);
		}

		return response.data;
	}

	// Raydium API methods
	async getRaydiumQuote(inputMint: string, outputMint: string, amount: number, slippageBps: number = 50, txVersion: string = 'V0'): Promise<any> {
		const raydiumUrl = 'https://transaction-v1.raydium.io/compute/swap-base-in';
		const params = new URLSearchParams({
			inputMint,
			outputMint,
			amount: amount.toString(),
			slippageBps: slippageBps.toString(),
			txVersion,
		});

		const response = await this.axiosInstance.get(`${raydiumUrl}?${params}`);
		
		if (!response.data.success) {
			throw new Error(
				`Raydium Error: ${response.data.msg || 'Unknown error'}\nInput: ${inputMint} -> Output: ${outputMint}\nAmount: ${amount}, Slippage: ${slippageBps}bps`
			);
		}

		return response.data;
	}

	async getRaydiumPriorityFee(): Promise<number> {
		const now = Date.now();
		if (this.priorityFeeCache && (now - this.priorityFeeCache.timestamp) < PRIORITY_FEE_CACHE_MS) {
			return this.priorityFeeCache.value;
		}

		try {
			const response = await this.axiosInstance.get('https://transaction-v1.raydium.io/compute/priority-fee');
			if (response.data.success && response.data.data?.default?.h) {
				const fee = response.data.data.default.h;
				this.priorityFeeCache = { value: fee, timestamp: now };
				return fee;
			}
		} catch (error) {
			if (this.priorityFeeCache) return this.priorityFeeCache.value;
		}
		return 100000;
	}

	async getRaydiumSwapTransaction(
		swapResponse: any,
		userPublicKey: string,
		priorityFee: number = 0,
		inputMint: string,
		outputMint: string,
		txVersion: string = 'V0'
	): Promise<any> {
		const raydiumUrl = 'https://transaction-v1.raydium.io/transaction/swap-base-in';
		
		const isInputSol = inputMint === 'So11111111111111111111111111111111111111112';
		const isOutputSol = outputMint === 'So11111111111111111111111111111111111111112';

		if (priorityFee === 0) {
			priorityFee = await this.getRaydiumPriorityFee();
		}

		const swapRequest = {
			computeUnitPriceMicroLamports: String(priorityFee),
			swapResponse: swapResponse,
			txVersion,
			wallet: userPublicKey,
			wrapSol: isInputSol,
			unwrapSol: isOutputSol,
			inputAccount: undefined,
			outputAccount: undefined,
		};

		const response = await this.axiosInstance.post(raydiumUrl, swapRequest);

		if (!response.data.success) {
			throw new Error(`Raydium Swap Error: ${response.data.msg || 'Unknown error'}`);
		}

		return response.data;
	}

	// Token transfer methods
	async createSolTransferTransaction(fromPublicKey: string, toPublicKey: string, lamports: number, priorityFee: number = 0): Promise<any> {
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

	async createSplTransferTransaction(fromPublicKey: string, toPublicKey: string, tokenMint: string, amount: number, decimals: number, priorityFee: number = 0): Promise<any> {
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

	private createTransferInstruction(lamports: number): Buffer {
		const data = Buffer.alloc(12);
		data.writeUInt32LE(2, 0); // Transfer instruction
		data.writeBigUInt64LE(BigInt(lamports), 4);
		return data;
	}

	private createSplTransferInstruction(amount: number): Buffer {
		const data = Buffer.alloc(9);
		data.writeUInt8(3, 0); // Transfer instruction
		data.writeBigUInt64LE(BigInt(amount), 1);
		return data;
	}

	private createPriorityFeeInstruction(microLamports: number): Buffer {
		const data = Buffer.alloc(9);
		data.writeUInt8(3, 0); // SetComputeUnitPrice instruction
		data.writeBigUInt64LE(BigInt(microLamports), 1);
		return data;
	}

	private getAssociatedTokenAccount(owner: string, mint: string): string {
		try {
			const ownerPubkey = new PublicKey(owner);
			const mintPubkey = new PublicKey(mint);
			
			const [ata] = PublicKey.findProgramAddressSync(
				[
					ownerPubkey.toBuffer(),
					TOKEN_PROGRAM_ID.toBuffer(),
					mintPubkey.toBuffer(),
				],
				ASSOCIATED_TOKEN_PROGRAM_ID
			);
			
			return ata.toBase58();
		} catch (error) {
			throw new Error(`Failed to derive Associated Token Account: Invalid address format`);
		}
	}

	async sendTransaction(serializedTransaction: string): Promise<string> {
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

export class SolanaNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Solana',
		name: 'solanaNode',
		icon: 'file:solana-checkhc.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with Solana blockchain - Powered by CHECKHC',
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
						description: 'Get quote for token swap via DEX (Raydium/Jupiter)',
						action: 'Get quote for token swap',
					},
					{
						name: 'Execute Swap',
						value: 'executeSwap',
						description: 'Prepare token swap transaction via DEX (Raydium/Jupiter)',
						action: 'Prepare token swap transaction',
					},
					{
						name: 'Execute Swap (Advanced)',
						value: 'executeSwapAdvanced',
						description: 'Execute token swap with proper transaction signing via DEX',
						action: 'Execute token swap with signing',
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

		// DEX Selection parameter for swap operations
		{
			displayName: 'DEX',
			name: 'dexProvider',
			type: 'options',
			required: true,
			default: 'raydium',
			options: [
				{
					name: 'Raydium',
					value: 'raydium',
					description: 'Use Raydium DEX (Recommended - Lower fees)',
				},
				{
					name: 'Jupiter',
					value: 'jupiter',
					description: 'Use Jupiter Aggregator (Better routing)',
				},
			],
			displayOptions: {
				show: {
					operation: ['getSwapQuote', 'executeSwap', 'executeSwapAdvanced'],
				},
			},
			description: 'Select which DEX to use for the swap',
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const credentials = await this.getCredentials('solanaApi', i);
				const operation = this.getNodeParameter('operation', i) as string;

				// Setup RPC connection
				let rpcUrl: string;
				if (credentials.rpcType === 'custom') {
					rpcUrl = credentials.customRpcUrl as string;
				} else {
					const network = credentials.network as string;
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
				let walletAddress: string;
				if (credentials.publicKey) {
					walletAddress = credentials.publicKey as string;
				} else {
					throw new NodeOperationError(this.getNode(), 'Public key must be provided in credentials');
				}

				let result: any = {};

				switch (operation) {
					case 'getBalance':
						const balanceWallet = this.getNodeParameter('walletAddress', i) as string || walletAddress;
						const balance = await rpc.getBalance(balanceWallet);
						result = {
							walletAddress: balanceWallet,
							balance: balance / LAMPORTS_PER_SOL,
							balanceLamports: balance,
						};
						break;

					case 'getTokenBalance':
						const tokenWallet = this.getNodeParameter('walletAddress', i) as string || walletAddress;
						const tokenMint = this.getNodeParameter('tokenMint', i) as string;
						
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
							} else {
								result = {
									walletAddress: tokenWallet,
									tokenMint: tokenMint,
									balance: 0,
									balanceRaw: '0',
									error: 'Token account not found',
								};
							}
						} catch (error) {
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
						const tokenSymbol = this.getNodeParameter('tokenSymbol', i) as string;
						
						try {
							// Using CoinGecko API for price data
							const priceResponse = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${tokenSymbol.toLowerCase()}&vs_currencies=usd`);
							const price = priceResponse.data[tokenSymbol.toLowerCase()]?.usd;
							
							result = {
								symbol: tokenSymbol,
								price: price || 0,
								currency: 'USD',
								timestamp: new Date().toISOString(),
							};
						} catch (error) {
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
						const historyWallet = this.getNodeParameter('walletAddress', i) as string || walletAddress;
						const limit = this.getNodeParameter('limit', i) as number;
						
						try {
							const signatures = await rpc.getSignaturesForAddress(historyWallet, limit);
							
							// Parallel fetching for better performance
							const transactions = await Promise.all(
								signatures.map(async (sig) => {
									try {
										const tx = await rpc.getTransaction(sig.signature);
										if (tx) {
											return {
												signature: sig.signature,
												slot: sig.slot,
												blockTime: sig.blockTime,
												confirmationStatus: sig.confirmationStatus,
												fee: tx.meta?.fee,
												success: tx.meta?.err === null,
											};
										}
									} catch (error) {
										return null;
									}
								})
							).then(results => results.filter(Boolean));
							
							result = {
								walletAddress: historyWallet,
								transactions,
								count: transactions.length,
							};
						} catch (error) {
							result = {
								walletAddress: historyWallet,
								transactions: [],
								count: 0,
								error: 'Failed to fetch transaction history',
							};
						}
						break;

					case 'getAccountInfo':
						const accountWallet = this.getNodeParameter('walletAddress', i) as string || walletAddress;
						
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
						} catch (error) {
							result = {
								walletAddress: accountWallet,
								accountInfo: null,
								exists: false,
								error: error.message,
							};
						}
						break;

					case 'getSwapQuote':
						const inputMint = this.getNodeParameter('inputMint', i) as string;
						const outputMint = this.getNodeParameter('outputMint', i) as string;
						const swapAmount = this.getNodeParameter('swapAmount', i) as number;
						const slippageBps = this.getNodeParameter('slippageBps', i) as number;
						const dexProvider = this.getNodeParameter('dexProvider', i) as string;

						try {
							// Validation
							if (swapAmount <= 0) {
								throw new NodeOperationError(this.getNode(), 'Swap amount must be greater than 0');
							}
							if (swapAmount > 1000000) {
								throw new NodeOperationError(this.getNode(), 'Swap amount too large (max: 1,000,000)');
							}

							// Use helper method for conversion
							const amountInSmallestUnit = rpc['convertToSmallestUnit'](swapAmount, inputMint);

							let quote: any;
							if (dexProvider === 'raydium') {
								const raydiumQuote = await rpc.getRaydiumQuote(inputMint, outputMint, amountInSmallestUnit, slippageBps);
								quote = raydiumQuote.data;
							} else {
								quote = await rpc.getJupiterQuote(inputMint, outputMint, amountInSmallestUnit, slippageBps);
							}
							
							// Calculate output with proper decimals
							const outputDecimals = outputMint === SOL_MINT_ADDRESS ? LAMPORTS_PER_SOL : Math.pow(10, DEFAULT_TOKEN_DECIMALS);
							
							result = {
								dex: dexProvider,
								inputMint,
								outputMint,
								inputAmount: swapAmount,
								inputAmountRaw: amountInSmallestUnit.toString(),
								outputAmount: parseFloat(quote.outAmount) / outputDecimals,
								outputAmountRaw: quote.outAmount,
								priceImpactPct: quote.priceImpactPct,
								slippageBps: slippageBps,
								routePlan: quote.routePlan,
								quote: quote,
								timestamp: new Date().toISOString(),
							};
						} catch (error) {
							result = {
								dex: dexProvider,
								inputMint,
								outputMint,
								inputAmount: swapAmount,
								error: 'Swap quote failed. Check token addresses and amount.',
								timestamp: new Date().toISOString(),
							};
						}
						break;

					case 'executeSwap':
						const execInputMint = this.getNodeParameter('inputMint', i) as string;
						const execOutputMint = this.getNodeParameter('outputMint', i) as string;
						const execSwapAmount = this.getNodeParameter('swapAmount', i) as number;
						const execSlippageBps = this.getNodeParameter('slippageBps', i) as number;
						const priorityFee = this.getNodeParameter('priorityFee', i) as number;
						const execDexProvider = this.getNodeParameter('dexProvider', i) as string;

						try {
							// Validation
							if (execSwapAmount <= 0) {
								throw new NodeOperationError(this.getNode(), 'Swap amount must be greater than 0');
							}
							
							// Use helper method
							const execAmountInSmallestUnit = rpc['convertToSmallestUnit'](execSwapAmount, execInputMint);
							const outputDecimals = execOutputMint === SOL_MINT_ADDRESS ? LAMPORTS_PER_SOL : Math.pow(10, DEFAULT_TOKEN_DECIMALS);

							// Get quote and swap transaction based on DEX
							let execQuote: any;
							let swapTransaction: any;
							
							if (execDexProvider === 'raydium') {
								const raydiumQuote = await rpc.getRaydiumQuote(execInputMint, execOutputMint, execAmountInSmallestUnit, execSlippageBps);
								const raydiumSwap = await rpc.getRaydiumSwapTransaction(raydiumQuote.data, walletAddress, priorityFee, execInputMint, execOutputMint);
								execQuote = raydiumQuote.data;
								swapTransaction = { swapTransaction: raydiumSwap.data.transaction[0] };
							} else {
								execQuote = await rpc.getJupiterQuote(execInputMint, execOutputMint, execAmountInSmallestUnit, execSlippageBps);
								swapTransaction = await rpc.getJupiterSwapTransaction(execQuote, walletAddress, priorityFee);
							}
							
							result = {
								dex: execDexProvider,
								swapTransaction: swapTransaction.swapTransaction, // Base64 encoded transaction
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
						} catch (error) {
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
							throw new NodeOperationError(this.getNode(), 'Private key required for swap execution');
						}

						const advInputMint = this.getNodeParameter('inputMint', i) as string;
						const advOutputMint = this.getNodeParameter('outputMint', i) as string;
						const advSwapAmount = this.getNodeParameter('swapAmount', i) as number;
						const advSlippageBps = this.getNodeParameter('slippageBps', i) as number;
						const advPriorityFee = this.getNodeParameter('priorityFee', i) as number;
						const advDexProvider = this.getNodeParameter('dexProvider', i) as string;

						try {
							// Validation
							if (advSwapAmount <= 0) {
								throw new NodeOperationError(this.getNode(), 'Swap amount must be greater than 0');
							}

							// Use helper method
							const advAmountInSmallestUnit = rpc['convertToSmallestUnit'](advSwapAmount, advInputMint);
							const outputDecimals = advOutputMint === SOL_MINT_ADDRESS ? LAMPORTS_PER_SOL : Math.pow(10, DEFAULT_TOKEN_DECIMALS);

							// Get quote and swap transaction based on DEX
							let advQuote: any;
							let advSwapTransaction: any;
							
							if (advDexProvider === 'raydium') {
								const raydiumQuote = await rpc.getRaydiumQuote(advInputMint, advOutputMint, advAmountInSmallestUnit, advSlippageBps);
								advQuote = raydiumQuote.data;
								advSwapTransaction = await rpc.getRaydiumSwapTransaction(advQuote, walletAddress, advPriorityFee, advInputMint, advOutputMint);
							} else {
								advQuote = await rpc.getJupiterQuote(advInputMint, advOutputMint, advAmountInSmallestUnit, advSlippageBps);
								advSwapTransaction = await rpc.getJupiterSwapTransaction(advQuote, walletAddress, advPriorityFee);
							}
							
							// Create keypair from private key (with error sanitization)
							let keypair: Keypair;
							try {
								const privateKeyBytes = bs58.decode(credentials.privateKey as string);
								keypair = Keypair.fromSecretKey(privateKeyBytes);
							} catch (keyError) {
								throw new NodeOperationError(this.getNode(), 'Invalid private key format. Please check your credentials.');
							}
							
							// Deserialize and sign transaction properly
							const transactionBuffer = Buffer.from(advSwapTransaction.swapTransaction, 'base64');
							
							try {
								// Try as VersionedTransaction first (Jupiter v6 format)
								const versionedTx = VersionedTransaction.deserialize(transactionBuffer);
								versionedTx.sign([keypair]);
								const signedTxBuffer = versionedTx.serialize();
								const signedTxBase64 = Buffer.from(signedTxBuffer).toString('base64');
								
								// Send transaction
								const txSignature = await rpc.sendTransaction(signedTxBase64);
								
								result = {
									dex: advDexProvider,
									signature: txSignature,
									inputMint: advInputMint,
									outputMint: advOutputMint,
									inputAmount: advSwapAmount,
									inputAmountRaw: advAmountInSmallestUnit.toString(),
									outputAmount: parseFloat(advQuote.outAmount) / outputDecimals,
									outputAmountRaw: advQuote.outAmount,
									priceImpactPct: advQuote.priceImpactPct,
									slippageBps: advSlippageBps,
									priorityFee: advPriorityFee,
									timestamp: new Date().toISOString(),
									status: 'submitted',
									transactionType: 'versioned'
								};
								
							} catch (versionedError) {
								// Fallback to legacy Transaction format
								const legacyTx = Transaction.from(transactionBuffer);
								legacyTx.sign(keypair);
								const signedTxBuffer = legacyTx.serialize();
								const signedTxBase64 = Buffer.from(signedTxBuffer).toString('base64');
								
								// Send transaction
								const txSignature = await rpc.sendTransaction(signedTxBase64);
								
								result = {
									dex: advDexProvider,
									signature: txSignature,
									inputMint: advInputMint,
									outputMint: advOutputMint,
									inputAmount: advSwapAmount,
									inputAmountRaw: advAmountInSmallestUnit.toString(),
									outputAmount: parseFloat(advQuote.outAmount) / outputDecimals,
									outputAmountRaw: advQuote.outAmount,
									priceImpactPct: advQuote.priceImpactPct,
									slippageBps: advSlippageBps,
									priorityFee: advPriorityFee,
									timestamp: new Date().toISOString(),
									status: 'submitted',
									transactionType: 'legacy'
								};
							}
							
						} catch (error) {
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
							throw new NodeOperationError(this.getNode(), 'Private key required for token transfer');
						}

						const recipientAddress = this.getNodeParameter('recipientAddress', i) as string;
						const tokenType = this.getNodeParameter('tokenType', i) as string;
						const sendAmount = this.getNodeParameter('sendAmount', i) as number;
						const sendPriorityFee = this.getNodeParameter('sendPriorityFee', i) as number;

						try {
							let tokenMint: string;
							let decimals: number;

							// Define token configurations
							const tokenConfigs = {
								'SOL': { mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
								'USDC': { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
								'USDT': { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
								'CHECKHC': { mint: '5tpkrCVVh6tjjve4TuyP8MXBwURufgAnaboaLwo49uau', decimals: 6 },
							};

							if (tokenType === 'CUSTOM') {
								tokenMint = this.getNodeParameter('customTokenMint', i) as string;
								decimals = 6; // Default to 6 decimals for custom tokens
							} else if (tokenConfigs[tokenType]) {
								tokenMint = tokenConfigs[tokenType].mint;
								decimals = tokenConfigs[tokenType].decimals;
							} else {
								throw new Error(`Unsupported token type: ${tokenType}`);
							}

							let transferTransaction: any;
							
							if (tokenType === 'SOL') {
								// SOL transfer
								const lamports = sendAmount * LAMPORTS_PER_SOL;
								transferTransaction = await rpc.createSolTransferTransaction(
									walletAddress,
									recipientAddress,
									lamports,
									sendPriorityFee
								);
							} else {
								// SPL token transfer
								transferTransaction = await rpc.createSplTransferTransaction(
									walletAddress,
									recipientAddress,
									tokenMint,
									sendAmount,
									decimals,
									sendPriorityFee
								);
							}

							// Create keypair from private key
							const privateKeyBytes = bs58.decode(credentials.privateKey as string);
							const keypair = Keypair.fromSecretKey(privateKeyBytes);

							// Use @solana/web3.js for transaction building
							const { Transaction, SystemProgram, PublicKey, TransactionInstruction } = await import('@solana/web3.js');
							
							let transaction: Transaction;
							
							if (tokenType === 'SOL') {
								// Create SOL transfer transaction
								transaction = new Transaction().add(
									SystemProgram.transfer({
										fromPubkey: new PublicKey(walletAddress),
										toPubkey: new PublicKey(recipientAddress),
										lamports: sendAmount * LAMPORTS_PER_SOL,
									})
								);
							} else {
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

						} catch (error) {
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
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
				}

				returnData.push({
					json: result,
					pairedItem: { item: i },
				});

			} catch (error) {
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
