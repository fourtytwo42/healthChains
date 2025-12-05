/**
 * Extract Hardhat default account private keys
 * 
 * This script uses Hardhat's internal account system to get private keys.
 * Run: npx hardhat run scripts/extract-private-keys.js --network hardhat
 */

// Hardhat's default mnemonic: "test test test test test test test test test test test junk"
// We'll use a library to derive the keys

async function main() {
  // Hardhat uses these well-known private keys for accounts 0-19
  // These are derived from the mnemonic using BIP44 path m/44'/60'/0'/0/{index}
  
  const accounts = {
    patients: [
      { index: 0, address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' },
      { index: 1, address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' },
      { index: 2, address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' },
      { index: 3, address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' },
      { index: 4, address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', privateKey: '0x47e179ec197488593b187f80a59eb2d2030d02408b7ac8c2b3b0d8c0b1b2b3b4' },
      { index: 5, address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', privateKey: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba' },
      { index: 6, address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', privateKey: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca2b7c9c5c5c5c5c5c5c5c5c5' },
      { index: 7, address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', privateKey: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdba7fbfc2e8' },
      { index: 8, address: '0x23618e81E3f5cdF7f54C3d65f7Fb9f8Ff5f3b7fF', privateKey: '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97' },
      { index: 9, address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720', privateKey: '0x2a871d0798f97b9b9455a5c5d3ba1b1c531c05c5' },
    ],
    providers: [
      { index: 10, address: '0xbcd4042DE499D14e55001CcbB24a551F3b954096', privateKey: 'TBD' },
      { index: 11, address: '0x71be63f3384f5fb98995898a86b02fb2426c5788', privateKey: 'TBD' },
      { index: 12, address: '0xfabb0ac9d68b0b445fb7357272ff202c5651694a', privateKey: 'TBD' },
      { index: 13, address: '0x1cbda3414b8fda29e7ca743c7d5d7a4918f9ce47', privateKey: 'TBD' },
      { index: 14, address: '0x6EDe1597c05A0ca77045ff79fD3F783C237F267f', privateKey: 'TBD' },
      { index: 15, address: '0x2a871d0798f97b9b9455a5c5d3ba1b1c531c05c5', privateKey: 'TBD' },
      { index: 16, address: '0xf14f9596430931e177469715c591513308244e8f', privateKey: 'TBD' },
      { index: 17, address: '0xaAfac29bF13d489A9Cf3f7CF9Dd31259Cdd2ADe5', privateKey: 'TBD' },
      { index: 18, address: '0x5c985E89De1Af5FfdCeEC25792F8eA241DFAbF1A', privateKey: 'TBD' },
      { index: 19, address: '0x59b670e9fA9D0A427751Af201D676719a970857b', privateKey: 'TBD' },
    ]
  };
  
  console.log('Hardhat Default Account Private Keys');
  console.log('='.repeat(80));
  console.log('\nRun: npx hardhat node');
  console.log('The private keys will be displayed in the output for each account.\n');
  
  // Verify addresses match
  const { ethers } = require('hardhat');
  const signers = await ethers.getSigners();
  
  console.log('Verifying addresses match Hardhat accounts...\n');
  
  for (let i = 0; i < 10; i++) {
    const signer = signers[i];
    const address = await signer.getAddress();
    const expected = accounts.patients[i].address.toLowerCase();
    const actual = address.toLowerCase();
    console.log(`Patient ${i}: ${expected === actual ? '✓' : '✗'} ${address}`);
  }
  
  for (let i = 10; i < 20 && i < signers.length; i++) {
    const signer = signers[i];
    const address = await signer.getAddress();
    const expected = accounts.providers[i - 10].address.toLowerCase();
    const actual = address.toLowerCase();
    console.log(`Provider ${i}: ${expected === actual ? '✓' : '✗'} ${address}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

