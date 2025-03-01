// Auto Mint NFT Script for Monad Testnet
// Requires: Node.js, ethers.js

const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config();

// Configuration
const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT;
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Store this in .env file
const RPC_URL = process.env.RPC_URL; // Monad Testnet RPC URL
const GAS_LIMIT = 300000;
const MINT_PRICE = ethers.utils.parseEther("0.001"); // Adjust based on actual mint price

// ABI for the mint function - simplified example, adjust according to the actual contract
const ABI = [
  "function mint(uint256 quantity) payable",
  "function isMintActive() view returns (bool)",
  "function mintPrice() view returns (uint256)"
];

async function setupWallet() {
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, ABI, wallet);
    
    console.log(`Wallet setup complete. Address: ${wallet.address}`);
    
    return { wallet, nftContract, provider };
  } catch (error) {
    console.error("Error setting up wallet:", error);
    throw error;
  }
}

async function checkMintStatus(nftContract) {
  try {
    const isMintActive = await nftContract.isMintActive();
    if (!isMintActive) {
      console.log("Mint is not active yet. Waiting...");
      return false;
    }
    
    // Optional: Check actual mint price from contract
    try {
      const actualPrice = await nftContract.mintPrice();
      console.log(`Current mint price: ${ethers.utils.formatEther(actualPrice)} MONAD`);
    } catch (error) {
      console.log("Couldn't fetch mint price. Using default value.");
    }
    
    return true;
  } catch (error) {
    console.error("Error checking mint status:", error);
    return false;
  }
}

async function mintNFT(nftContract, wallet) {
  try {
    const quantity = 1; // Number of NFTs to mint
    
    console.log(`Attempting to mint ${quantity} NFT(s)...`);
    
    const gasPrice = await wallet.provider.getGasPrice();
    const adjustedGasPrice = gasPrice.mul(120).div(100); // 20% more than current gas price
    
    const tx = await nftContract.mint(quantity, {
      value: MINT_PRICE.mul(quantity),
      gasLimit: GAS_LIMIT,
      gasPrice: adjustedGasPrice
    });
    
    console.log(`Mint transaction submitted: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    
    console.log(`Mint successful! Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    
    // Log success to a file
    const log = `${new Date().toISOString()} - Mint successful - Tx: ${tx.hash}\n`;
    fs.appendFileSync('mint_success.log', log);
    
    return true;
  } catch (error) {
    console.error("Error minting NFT:", error);
    
    // Log error to a file
    const errorLog = `${new Date().toISOString()} - Mint failed - Error: ${error.message}\n`;
    fs.appendFileSync('mint_error.log', errorLog);
    
    return false;
  }
}

async function monitorAndMint() {
  console.log("Starting Auto Mint NFT Script...");
  
  try {
    const { wallet, nftContract, provider } = await setupWallet();
    
    // Check wallet balance
    const balance = await wallet.getBalance();
    console.log(`Wallet balance: ${ethers.utils.formatEther(balance)} MONAD`);
    
    if (balance.lt(MINT_PRICE)) {
      console.error("Insufficient funds for minting!");
      return;
    }
    
    // Check mint status and mint if active
    let success = false;
    const interval = 15000; // Check every 15 seconds
    
    console.log(`Monitoring mint status every ${interval/1000} seconds...`);
    
    // First check immediately
    if (await checkMintStatus(nftContract)) {
      success = await mintNFT(nftContract, wallet);
    }
    
    // If not successful, set up polling
    if (!success) {
      const timer = setInterval(async () => {
        if (await checkMintStatus(nftContract)) {
          const mintResult = await mintNFT(nftContract, wallet);
          if (mintResult) {
            clearInterval(timer);
            console.log("Minting completed successfully. Script will now exit.");
            process.exit(0);
          }
        }
      }, interval);
    } else {
      console.log("Minting completed successfully. Script will now exit.");
      process.exit(0);
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Start the script
monitorAndMint();
