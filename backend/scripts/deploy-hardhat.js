const hre = require("hardhat");

async function main() {
  console.log("Deploying PatientConsentManager contract to Hardhat network...");

  // Get the first account (account[0]) for deterministic deployment
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const PatientConsentManager = await hre.ethers.getContractFactory("PatientConsentManager");
  const consentManager = await PatientConsentManager.connect(deployer).deploy();

  await consentManager.waitForDeployment();

  const address = await consentManager.getAddress();
  console.log("PatientConsentManager deployed to:", address);
  console.log("Contract address:", address);

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    address: address,
    network: hre.network.name,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    "./deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("Deployment info saved to deployment.json");
  console.log("\n⚠️  Note: This uses Hardhat's built-in network.");
  console.log("For persistent network, use 'npx hardhat node' in a separate terminal,");
  console.log("then run 'npm run deploy:local'");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

