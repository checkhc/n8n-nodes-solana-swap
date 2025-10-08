#!/usr/bin/env python3
"""
Script pour corriger les déclarations de variables en double
"""

def fix_duplicates():
    filepath = 'nodes/SolanaNode/SolanaNode.node.ts'
    
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # FIX 1: Dans executeSwap, supprimer les anciennes lignes getJupiterSwapTransaction
    i = 0
    while i < len(lines):
        # Chercher la nouvelle structure avec let swapTransaction
        if i > 900 and 'let swapTransaction: any;' in lines[i]:
            # Chercher les anciennes lignes en dessous
            for j in range(i + 1, min(i + 20, len(lines))):
                # Si on trouve une ancienne déclaration const swapTransaction
                if 'const swapTransaction = await rpc.getJupiterSwapTransaction' in lines[j]:
                    # Supprimer cette ligne
                    del lines[j]
                    print("✅ Fix 1: Supprimé ancienne ligne swapTransaction dans executeSwap")
                    break
        i += 1
    
    # FIX 2: Dans executeSwapAdvanced, supprimer les anciennes lignes
    i = 0
    while i < len(lines):
        # Chercher la nouvelle structure avec let advSwapTransaction
        if i > 980 and 'let advSwapTransaction: any;' in lines[i]:
            # Chercher les anciennes lignes en dessous
            for j in range(i + 1, min(i + 20, len(lines))):
                # Si on trouve une ancienne déclaration const advSwapTransaction
                if 'const advSwapTransaction = await rpc.getJupiterSwapTransaction' in lines[j]:
                    # Supprimer cette ligne et la ligne avant (// Get swap transaction)
                    if j > 0 and '// Get swap transaction' in lines[j-1]:
                        del lines[j-1:j+1]
                        print("✅ Fix 2: Supprimé anciennes lignes advSwapTransaction dans executeSwapAdvanced")
                    else:
                        del lines[j]
                        print("✅ Fix 2: Supprimé ancienne ligne advSwapTransaction dans executeSwapAdvanced")
                    break
        i += 1
    
    # Écrire le fichier corrigé
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    
    print("\n✅ Corrections appliquées!")

if __name__ == '__main__':
    fix_duplicates()
