#!/usr/bin/env python3
"""
Script pour appliquer les modifications Raydium au fichier SolanaNode.node.ts
"""

def apply_patches():
    filepath = 'nodes/SolanaNode/SolanaNode.node.ts'
    
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # PATCH 1: Ajouter dexProvider dans case 'getSwapQuote' (après ligne 858)
    for i, line in enumerate(lines):
        if i >= 857 and "const slippageBps = this.getNodeParameter('slippageBps', i) as number;" in line:
            # Vérifier si la ligne suivante n'est pas déjà le dexProvider
            if i + 1 < len(lines) and 'dexProvider' not in lines[i + 1]:
                # Copier l'indentation de la ligne actuelle
                indent = line[:len(line) - len(line.lstrip())]
                lines.insert(i + 1, f"{indent}const dexProvider = this.getNodeParameter('dexProvider', i) as string;\n")
                print("✅ Patch 1a appliqué: dexProvider ajouté dans getSwapQuote")
                break
    
    # PATCH 2: Modifier la logique de quote dans getSwapQuote (ligne ~873)
    for i, line in enumerate(lines):
        if 'const quote = await rpc.getJupiterQuote(inputMint, outputMint, amountInSmallestUnit, slippageBps);' in line:
            indent = line[:len(line) - len(line.lstrip())]
            # Remplacer par la nouvelle logique
            new_lines = [
                f"{indent}let quote: any;\n",
                f"{indent}if (dexProvider === 'raydium') {{\n",
                f"{indent}\tconst raydiumQuote = await rpc.getRaydiumQuote(inputMint, outputMint, amountInSmallestUnit, slippageBps);\n",
                f"{indent}\tquote = raydiumQuote.data;\n",
                f"{indent}}} else {{\n",
                f"{indent}\tquote = await rpc.getJupiterQuote(inputMint, outputMint, amountInSmallestUnit, slippageBps);\n",
                f"{indent}}}\n",
            ]
            lines[i:i+1] = new_lines
            print("✅ Patch 1b appliqué: logique Raydium dans getSwapQuote")
            break
    
    # PATCH 3: Ajouter dex dans result de getSwapQuote
    for i, line in enumerate(lines):
        if i > 860 and i < 900 and 'result = {' in line and 'inputMint,' in lines[i+1]:
            indent_result = lines[i+1][:len(lines[i+1]) - len(lines[i+1].lstrip())]
            if 'dex:' not in lines[i+1]:
                lines.insert(i + 1, f"{indent_result}dex: dexProvider,\n")
                print("✅ Patch 1c appliqué: dex ajouté dans result getSwapQuote")
                break
    
    # PATCH 4: Ajouter dex dans error result de getSwapQuote
    for i, line in enumerate(lines):
        if i > 890 and i < 910 and 'result = {' in line and 'error.message' in ''.join(lines[i:i+5]):
            if 'inputMint,' in lines[i+1] and 'dex:' not in lines[i+1]:
                indent_result = lines[i+1][:len(lines[i+1]) - len(lines[i+1].lstrip())]
                lines.insert(i + 1, f"{indent_result}dex: dexProvider,\n")
                print("✅ Patch 1d appliqué: dex ajouté dans error result getSwapQuote")
                break
    
    # PATCH 5: Ajouter execDexProvider dans case 'executeSwap'
    for i, line in enumerate(lines):
        if 'case \'executeSwap\':' in line:
            # Chercher la ligne avec priorityFee
            for j in range(i, min(i + 20, len(lines))):
                if "const priorityFee = this.getNodeParameter('priorityFee', i) as number;" in lines[j]:
                    if j + 1 < len(lines) and 'execDexProvider' not in lines[j + 1]:
                        indent = lines[j][:len(lines[j]) - len(lines[j].lstrip())]
                        lines.insert(j + 1, f"{indent}const execDexProvider = this.getNodeParameter('dexProvider', i) as string;\n")
                        print("✅ Patch 2a appliqué: execDexProvider ajouté dans executeSwap")
                        break
            break
    
    # PATCH 6: Modifier logique executeSwap
    for i, line in enumerate(lines):
        if '// Get quote first' in line and 'executeSwap' in ''.join(lines[max(0,i-30):i]):
            if 'const execQuote = await rpc.getJupiterQuote' in lines[i+1]:
                indent = lines[i+1][:len(lines[i+1]) - len(lines[i+1].lstrip())]
                # Trouver les 3 lignes à remplacer
                new_lines = [
                    f"{indent}// Get quote and swap transaction based on DEX\n",
                    f"{indent}let execQuote: any;\n",
                    f"{indent}let swapTransaction: any;\n",
                    f"{indent}\n",
                    f"{indent}if (execDexProvider === 'raydium') {{\n",
                    f"{indent}\tconst raydiumQuote = await rpc.getRaydiumQuote(execInputMint, execOutputMint, execAmountInSmallestUnit, execSlippageBps);\n",
                    f"{indent}\tconst raydiumSwap = await rpc.getRaydiumSwapTransaction(raydiumQuote.data, walletAddress, priorityFee, execInputMint, execOutputMint);\n",
                    f"{indent}\texecQuote = raydiumQuote.data;\n",
                    f"{indent}\tswapTransaction = {{ swapTransaction: raydiumSwap.data.transaction[0] }};\n",
                    f"{indent}}} else {{\n",
                    f"{indent}\texecQuote = await rpc.getJupiterQuote(execInputMint, execOutputMint, execAmountInSmallestUnit, execSlippageBps);\n",
                    f"{indent}\tswapTransaction = await rpc.getJupiterSwapTransaction(execQuote, walletAddress, priorityFee);\n",
                    f"{indent}}}\n",
                ]
                # Remplacer 4 lignes (comment + execQuote + empty + swapTransaction)
                lines[i:i+4] = new_lines
                print("✅ Patch 2b appliqué: logique Raydium dans executeSwap")
                break
    
    # PATCH 7: Ajouter dex dans result executeSwap
    for i, line in enumerate(lines):
        if i > 920 and i < 970 and 'swapTransaction: swapTransaction.swapTransaction' in line:
            # Chercher le result = { avant
            for j in range(i, max(0, i - 10), -1):
                if 'result = {' in lines[j]:
                    if 'dex:' not in lines[j+1]:
                        indent = lines[j+1][:len(lines[j+1]) - len(lines[j+1].lstrip())]
                        lines.insert(j + 1, f"{indent}dex: execDexProvider,\n")
                        print("✅ Patch 2c appliqué: dex ajouté dans result executeSwap")
                        break
            break
    
    # PATCH 8: Ajouter advDexProvider dans executeSwapAdvanced
    for i, line in enumerate(lines):
        if 'case \'executeSwapAdvanced\':' in line:
            for j in range(i, min(i + 30, len(lines))):
                if "const advPriorityFee = this.getNodeParameter('priorityFee', i) as number;" in lines[j]:
                    if j + 1 < len(lines) and 'advDexProvider' not in lines[j + 1]:
                        indent = lines[j][:len(lines[j]) - len(lines[j].lstrip())]
                        lines.insert(j + 1, f"{indent}const advDexProvider = this.getNodeParameter('dexProvider', i) as string;\n")
                        print("✅ Patch 3a appliqué: advDexProvider ajouté dans executeSwapAdvanced")
                        break
            break
    
    # PATCH 9: Modifier logique executeSwapAdvanced
    for i, line in enumerate(lines):
        if '// Get quote first' in line and 'advQuote' in lines[i+1]:
            indent = lines[i+1][:len(lines[i+1]) - len(lines[i+1].lstrip())]
            new_lines = [
                f"{indent}// Get quote and swap transaction based on DEX\n",
                f"{indent}let advQuote: any;\n",
                f"{indent}let advSwapTransaction: any;\n",
                f"{indent}\n",
                f"{indent}if (advDexProvider === 'raydium') {{\n",
                f"{indent}\tconst raydiumQuote = await rpc.getRaydiumQuote(advInputMint, advOutputMint, advAmountInSmallestUnit, advSlippageBps);\n",
                f"{indent}\tadvQuote = raydiumQuote.data;\n",
                f"{indent}\tadvSwapTransaction = await rpc.getRaydiumSwapTransaction(advQuote, walletAddress, advPriorityFee, advInputMint, advOutputMint);\n",
                f"{indent}}} else {{\n",
                f"{indent}\tadvQuote = await rpc.getJupiterQuote(advInputMint, advOutputMint, advAmountInSmallestUnit, advSlippageBps);\n",
                f"{indent}\tadvSwapTransaction = await rpc.getJupiterSwapTransaction(advQuote, walletAddress, advPriorityFee);\n",
                f"{indent}}}\n",
            ]
            lines[i:i+4] = new_lines
            print("✅ Patch 3b appliqué: logique Raydium dans executeSwapAdvanced")
            break
    
    # PATCH 10: Ajouter dex dans les deux results de executeSwapAdvanced
    found_results = 0
    for i, line in enumerate(lines):
        if i > 980 and 'signature: txSignature,' in line and found_results < 2:
            # Chercher le result = { avant
            for j in range(i, max(0, i - 10), -1):
                if 'result = {' in lines[j]:
                    if 'dex:' not in lines[j+1]:
                        indent = lines[j+1][:len(lines[j+1]) - len(lines[j+1].lstrip())]
                        lines.insert(j + 1, f"{indent}dex: advDexProvider,\n")
                        found_results += 1
                        print(f"✅ Patch 3c-{found_results} appliqué: dex ajouté dans result executeSwapAdvanced")
                        break
            if found_results == 2:
                break
    
    # Écrire le fichier modifié
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    
    print("\n✅ Toutes les modifications ont été appliquées avec succès!")
    print(f"📄 Fichier modifié: {filepath}")

if __name__ == '__main__':
    apply_patches()
