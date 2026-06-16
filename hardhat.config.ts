import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const EVM_KEY       = process.env.EVM_PRIVATE_KEY || '0x' + '0'.repeat(64)
const BASE_RPC      = process.env.BASE_RPC_URL         || 'https://mainnet.base.org'
const CELO_RPC      = process.env.CELO_RPC_URL         || 'https://forno.celo.org'
const BASE_SEP_RPC  = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
const ALFAJORES_RPC = process.env.ALFAJORES_RPC_URL    || 'https://forno.celo-sepolia.celo-testnet.org'

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true },
  },
  networks: {
    base: {
      url:      BASE_RPC,
      chainId:  8453,
      accounts: [EVM_KEY],
    },
    'base-sepolia': {
      url:      BASE_SEP_RPC,
      chainId:  84532,
      accounts: [EVM_KEY],
    },
    celo: {
      url:      CELO_RPC,
      chainId:  42220,
      accounts: [EVM_KEY],
    },
    alfajores: {
      url:      ALFAJORES_RPC,
      chainId:  11142220,
      accounts: [EVM_KEY],
    },
  },
  paths: {
    sources:   './contracts/solidity',
    tests:     './contracts/test',
    cache:     './contracts/cache',
    artifacts: './contracts/artifacts',
  },
}

export default config
