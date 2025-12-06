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
  const path = require("path");
  
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

  // Copy ABI to frontend public folder
  try {
    const artifactPath = path.join(__dirname, "../artifacts/contracts/PatientConsentManager.sol/PatientConsentManager.json");
    const frontendAbiPath = path.join(__dirname, "../../frontend/public/contract-abi.json");
    
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      const abiWrapper = { abi: artifact.abi };
      fs.writeFileSync(frontendAbiPath, JSON.stringify(abiWrapper, null, 2));
      console.log("Contract ABI copied to frontend/public/contract-abi.json");
    } else {
      console.warn("Warning: Artifact file not found, ABI not copied to frontend");
    }
  } catch (error) {
    console.error("Error copying ABI to frontend:", error.message);
    console.warn("Please manually copy the ABI to frontend/public/contract-abi.json");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

