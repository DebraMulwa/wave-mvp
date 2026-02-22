import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import "dotenv/config";

const rawPrivateKey = process.env.PRIVATE_KEY ?? "";
const normalizedPrivateKey = rawPrivateKey
  ? rawPrivateKey.startsWith("0x")
    ? rawPrivateKey
    : `0x${rawPrivateKey}`
  : "";

export default defineConfig({
  plugins: [hardhatEthers],
  solidity: "0.8.13",
  networks: {
    sepolia: {
      type: "http",
      url: process.env.RPC_URL,
      accounts: normalizedPrivateKey ? [normalizedPrivateKey] : [],
    },
  },
});
