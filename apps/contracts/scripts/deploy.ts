import { ethers } from "hardhat";

async function main() {
  console.log("Deploying MonadPageMinter...");

  const MonadPageMinter = await ethers.getContractFactory("MonadPageMinter");
  const contract = await MonadPageMinter.deploy();

  await contract.waitForDeployment();

  // ethers v6: getAddress() is on the BaseContract — cast to access it
  const address = await (contract as unknown as { getAddress(): Promise<string> }).getAddress();
  console.log(`MonadPageMinter deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
