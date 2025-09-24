import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SolanaApi implements ICredentialType {
	name = 'solanaApi';
	displayName = 'Solana API';
	documentationUrl = 'https://docs.solana.com/';
	properties: INodeProperties[] = [
		{
			displayName: 'Network',
			name: 'network',
			type: 'options',
			options: [
				{
					name: 'Mainnet Beta',
					value: 'mainnet-beta',
				},
				{
					name: 'Devnet',
					value: 'devnet',
				},
				{
					name: 'Testnet',
					value: 'testnet',
				},
			],
			default: 'devnet',
			description: 'The Solana network to connect to',
		},
		{
			displayName: 'RPC Endpoint Type',
			name: 'rpcType',
			type: 'options',
			options: [
				{
					name: 'Public RPC',
					value: 'public',
				},
				{
					name: 'Custom RPC (Helius, QuickNode, etc.)',
					value: 'custom',
				},
			],
			default: 'public',
			description: 'Type of RPC endpoint to use',
		},
		{
			displayName: 'Custom RPC URL',
			name: 'customRpcUrl',
			type: 'string',
			default: '',
			placeholder: 'https://mainnet.helius-rpc.com/?api-key=your-key',
			displayOptions: {
				show: {
					rpcType: ['custom'],
				},
			},
			description: 'Custom RPC endpoint URL (e.g., Helius, QuickNode)',
		},
		{
			displayName: 'Private Key',
			name: 'privateKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			placeholder: 'Your Solana wallet private key (base58 encoded)',
			description: 'Private key of your Solana wallet (keep this secure!)',
		},
		{
			displayName: 'Public Key (Wallet Address)',
			name: 'publicKey',
			type: 'string',
			default: '',
			placeholder: 'Your Solana wallet public address',
			description: 'Public key/address of your Solana wallet',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.rpcType === "custom" ? $credentials.customRpcUrl : ($credentials.network === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : ($credentials.network === "devnet" ? "https://api.devnet.solana.com" : "https://api.testnet.solana.com"))}}',
			url: '',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: {
				jsonrpc: '2.0',
				id: 1,
				method: 'getHealth',
			},
		},
	};
}
