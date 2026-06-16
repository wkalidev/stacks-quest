import { ethers } from 'hardhat'

// Celo mainnet token addresses (from app/lib/chains.ts)
const CUSD   = '0x765DE816845861e75A25fCA122bb6898B8B1282a'
const UNUSED = '0x0000000000000000000000000000000000000000'

async function main() {
  const [deployer] = await ethers.getSigners()
  const balance    = await deployer.provider.getBalance(deployer.address)
  console.log('Deploying on Celo with:', deployer.address)
  console.log('Balance:', ethers.formatEther(balance), 'CELO')

  const QuestGame    = await ethers.getContractFactory('QuestGame')
  const game         = await QuestGame.deploy(CUSD, UNUSED)
  await game.waitForDeployment()
  const gameAddr     = await game.getAddress()
  console.log('QuestGame deployed:   ', gameAddr)

  const QuestCheckIn = await ethers.getContractFactory('QuestCheckIn')
  const checkIn      = await QuestCheckIn.deploy()
  await checkIn.waitForDeployment()
  const checkInAddr  = await checkIn.getAddress()
  console.log('QuestCheckIn deployed:', checkInAddr)

  console.log('\nAdd to .env.local:')
  console.log(`NEXT_PUBLIC_CELO_QUEST_GAME=${gameAddr}`)
  console.log(`NEXT_PUBLIC_CELO_QUEST_CHECKIN=${checkInAddr}`)
}

main().catch(err => { console.error(err); process.exit(1) })
