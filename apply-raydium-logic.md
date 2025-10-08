# RAYDIUM INTEGRATION - MODIFICATIONS RESTANTES

## ✅ DÉJÀ COMPLÉTÉ (Étapes 1-4)
1. ✅ Méthodes Raydium API ajoutées (lignes 118-189)
2. ✅ Description du node mise à jour avec CHECKHC (ligne 324)
3. ✅ Descriptions des opérations de swap mises à jour (lignes 373-389)
4. ✅ Sélecteur DEX ajouté (lignes 484-509)

## 🔴 À FAIRE MANUELLEMENT (Étapes 5-7)

### ÉTAPE 5: Modifier case 'getSwapQuote' (ligne ~854)

**Chercher:**
```typescript
case 'getSwapQuote':
    const inputMint = this.getNodeParameter('inputMint', i) as string;
    const outputMint = this.getNodeParameter('outputMint', i) as string;
    const swapAmount = this.getNodeParameter('swapAmount', i) as number;
    const slippageBps = this.getNodeParameter('slippageBps', i) as number;
```

**Ajouter après `slippageBps`:**
```typescript
const dexProvider = this.getNodeParameter('dexProvider', i) as string;
```

**Remplacer:**
```typescript
const quote = await rpc.getJupiterQuote(inputMint, outputMint, amountInSmallestUnit, slippageBps);
```

**Par:**
```typescript
let quote: any;
if (dexProvider === 'raydium') {
    const raydiumQuote = await rpc.getRaydiumQuote(inputMint, outputMint, amountInSmallestUnit, slippageBps);
    quote = raydiumQuote.data;
} else {
    quote = await rpc.getJupiterQuote(inputMint, outputMint, amountInSmallestUnit, slippageBps);
}
```

**Dans result, ajouter en premier:**
```typescript
result = {
    dex: dexProvider,  // ← AJOUTER CETTE LIGNE
    inputMint,
    ...
```

---

### ÉTAPE 6: Modifier case 'executeSwap' (ligne ~898)

**Chercher:**
```typescript
case 'executeSwap':
    const execInputMint = this.getNodeParameter('inputMint', i) as string;
    const execOutputMint = this.getNodeParameter('outputMint', i) as string;
    const execSwapAmount = this.getNodeParameter('swapAmount', i) as number;
    const execSlippageBps = this.getNodeParameter('slippageBps', i) as number;
    const priorityFee = this.getNodeParameter('priorityFee', i) as number;
```

**Ajouter après `priorityFee`:**
```typescript
const execDexProvider = this.getNodeParameter('dexProvider', i) as string;
```

**Remplacer:**
```typescript
// Get quote first
const execQuote = await rpc.getJupiterQuote(execInputMint, execOutputMint, execAmountInSmallestUnit, execSlippageBps);

// Get swap transaction data (but don't execute it automatically)
const swapTransaction = await rpc.getJupiterSwapTransaction(execQuote, walletAddress, priorityFee);
```

**Par:**
```typescript
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
```

**Dans result, ajouter:**
```typescript
result = {
    dex: execDexProvider,  // ← AJOUTER CETTE LIGNE
    swapTransaction: swapTransaction.swapTransaction,
    ...
```

---

### ÉTAPE 7: Modifier case 'executeSwapAdvanced' (ligne ~948)

**Chercher:**
```typescript
case 'executeSwapAdvanced':
    if (!credentials.privateKey) {
        throw new NodeOperationError(this.getNode(), 'Private key required for swap execution');
    }

    const advInputMint = this.getNodeParameter('inputMint', i) as string;
    const advOutputMint = this.getNodeParameter('outputMint', i) as string;
    const advSwapAmount = this.getNodeParameter('swapAmount', i) as number;
    const advSlippageBps = this.getNodeParameter('slippageBps', i) as number;
    const advPriorityFee = this.getNodeParameter('priorityFee', i) as number;
```

**Ajouter après `advPriorityFee`:**
```typescript
const advDexProvider = this.getNodeParameter('dexProvider', i) as string;
```

**Remplacer:**
```typescript
// Get quote first
const advQuote = await rpc.getJupiterQuote(advInputMint, advOutputMint, advAmountInSmallestUnit, advSlippageBps);

// Get swap transaction
const advSwapTransaction = await rpc.getJupiterSwapTransaction(advQuote, walletAddress, advPriorityFee);
```

**Par:**
```typescript
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
```

**Dans les deux blocs result (VersionedTransaction et legacy), ajouter:**
```typescript
result = {
    dex: advDexProvider,  // ← AJOUTER CETTE LIGNE
    signature: txSignature,
    ...
```

---

## 📦 APRÈS LES MODIFICATIONS (Étape 8)

### Compiler et tester:
```bash
cd /home/greg/n8n/n8n-nodes-solana-swap

# Vérifier la syntaxe
yarn tsc --noEmit

# Compiler
yarn build

# Créer le package
yarn pack

# Installer localement
cd ~/.n8n/nodes
yarn remove n8n-nodes-solana-swap
yarn add file:/home/greg/n8n/n8n-nodes-solana-swap/n8n-nodes-solana-swap-v1.4.0.tgz

# Redémarrer n8n
cd /home/greg/n8n
./stop-n8n.sh && ./start-n8n.sh
```

---

## 📝 MISE À JOUR PACKAGE.JSON (Étape 9)

```json
{
  "name": "n8n-nodes-solana-swap",
  "version": "1.4.0",  // ← INCRÉMENTER
  "description": "n8n node for Solana blockchain operations with Raydium and Jupiter swap integration. Developed by CHECKHC.",
  "keywords": [
    "n8n-community-node-package",
    "n8n",
    "solana",
    "blockchain",
    "crypto",
    "trading",
    "jupiter",
    "raydium",  // ← AJOUTER
    "swap",
    "dex",  // ← AJOUTER
    "defi"
  ],
  ...
}
```

---

## ✅ CHECKLIST FINALE

- [ ] Étape 5: case 'getSwapQuote' modifié avec support Raydium
- [ ] Étape 6: case 'executeSwap' modifié avec support Raydium
- [ ] Étape 7: case 'executeSwapAdvanced' modifié avec support Raydium
- [ ] Étape 8: Compilation réussie sans erreurs
- [ ] Étape 9: package.json mis à jour (version + keywords)
- [ ] Test local: Swap Raydium fonctionne
- [ ] Test local: Swap Jupiter fonctionne toujours
- [ ] Commit et push vers Git
- [ ] Déploiement serveur distant (git pull)

---

## 🎯 RÉSUMÉ

**4 modifications complétées automatiquement ✅**
**3 modifications à faire manuellement 🔴** (étapes 5-7 ci-dessus)
**2 étapes finales** (compilation + package.json)

Les modifications sont simples et suivent le même pattern pour les 3 cases.
