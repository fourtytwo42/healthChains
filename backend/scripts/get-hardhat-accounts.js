/**
 * Script to extract Hardhat default account private keys
 * 
 * Hardhat uses the mnemonic: "test test test test test test test test test test test junk"
 * and derives accounts using BIP44 path: m/44'/60'/0'/0/{index}
 * 
 * Run: node scripts/get-hardhat-accounts.js
 */

const { ethers } = require('hardhat');

async function main() {
  console.log('Hardhat Default Accounts Private Keys\n');
  console.log('='.repeat(80));
  
  // Get signers (accounts) from Hardhat
  const signers = await ethers.getSigners();
  
  console.log('\n=== PATIENT ACCOUNTS (0-9) ===\n');
  for (let i = 0; i < 10; i++) {
    const signer = signers[i];
    const address = await signer.getAddress();
    // Note: Hardhat doesn't expose private keys directly, but we can derive them
    // from the known mnemonic
    console.log(`Account #${i}: ${address}`);
  }
  
  console.log('\n=== PROVIDER ACCOUNTS (10-19) ===\n');
  for (let i = 10; i < 20 && i < signers.length; i++) {
    const signer = signers[i];
    const address = await signer.getAddress();
    console.log(`Account #${i}: ${address}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\nTo get private keys, use the known Hardhat mnemonic:');
  console.log('"test test test test test test test test test test test junk"');
  console.log('\nOr run: npx hardhat node');
  console.log('The private keys will be displayed in the output.\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

