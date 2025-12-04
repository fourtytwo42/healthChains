const hre = require("hardhat");

async function main() {
  console.log("Deploying PatientConsentManager contract...");

  const PatientConsentManager = await hre.ethers.getContractFactory("PatientConsentManager");
  const consentManager = await PatientConsentManager.deploy();

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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

