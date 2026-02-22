import { network } from "hardhat";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const srcWavePath = path.join(projectRoot, "src", "Wave.json");
const buildWavePath = path.join(projectRoot, "build", "contracts", "Wave.json");
const hardhatArtifactPath = path.join(
  projectRoot,
  "artifacts",
  "contracts",
  "Wave.sol",
  "Wave.json",
);

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const { ethers } = await network.connect();
  const wave = await ethers.deployContract("Wave");
  await wave.waitForDeployment();
  const deployedAddress = await wave.getAddress();
  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId).toString();

  const hardhatArtifact = await readJson(hardhatArtifactPath);
  const base =
    (await readJson(srcWavePath)) ??
    (await readJson(buildWavePath)) ??
    {};

  const merged = {
    ...base,
    contractName: "Wave",
    abi: hardhatArtifact?.abi ?? base.abi ?? [],
    networks: {
      ...(base.networks ?? {}),
      [chainId]: {
        address: deployedAddress,
      },
    },
  };

  await fs.writeFile(srcWavePath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  console.log(`Wave deployed to: ${deployedAddress}`);
  console.log(`Updated src/Wave.json for chainId ${chainId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
