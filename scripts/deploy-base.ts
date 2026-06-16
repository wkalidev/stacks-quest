import { ethers } from 'hardhat'

// Base mainnet token addresses (from app/lib/chains.ts)
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const USDT = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'

async function main() {
  const [deployer] = await ethers.getSigners()
  const balance    = await deployer.provider.getBalance(deployer.address)
  console.log('Deploying on Base with:', deployer.address)
  console.log('Balance:', ethers.formatEther(balance), 'ETH')

  const QuestGame    = await ethers.getContractFactory('QuestGame')
  const game         = await QuestGame.deploy(USDC, USDT)
  await game.waitForDeployment()
  const gameAddr     = await game.getAddress()
  console.log('QuestGame deployed:   ', gameAddr)

  const QuestCheckIn = await ethers.getContractFactory('QuestCheckIn')
  const checkIn      = await QuestCheckIn.deploy()
  await checkIn.waitForDeployment()
  const checkInAddr  = await checkIn.getAddress()
  console.log('QuestCheckIn deployed:', checkInAddr)

  console.log('\nAdd to .env.local:')
  console.log(`NEXT_PUBLIC_BASE_QUEST_GAME=${gameAddr}`)
  console.log(`NEXT_PUBLIC_BASE_QUEST_CHECKIN=${checkInAddr}`)
}

main().catch(err => { console.error(err); process.exit(1) })
