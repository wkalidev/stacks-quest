import pkg from '@stacks/transactions'
import networkPkg from '@stacks/network'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const { makeContractDeploy, AnchorMode, serializeTransactionBytes } = pkg
const { STACKS_MAINNET } = networkPkg

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read .env.local manually — bypass dotenvx
const envLines = readFileSync(join(__dirname, '../.env.local'), 'utf8').split('\n')
const getEnv = (key) => envLines.find(l => l.startsWith(key + '='))?.split('=').slice(1).join('=').trim()

const privateKey = getEnv('STACKS_PRIVATE_KEY')
if (!privateKey) { console.error('STACKS_PRIVATE_KEY missing'); process.exit(1) }

const network  = STACKS_MAINNET
const codePath = join(__dirname, '../contracts/stacks-quest-agent-v3.clar')

let code = readFileSync(codePath, 'utf8')
code = code.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[^\x20-\x7E\n]/g, '')

const res     = await fetch('https://api.mainnet.hiro.so/v2/accounts/SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N')
const account = await res.json()
const nonce   = BigInt(account.nonce)

console.log('Address: SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N')
console.log('Nonce:', nonce)
console.log('Broadcasting...')

const tx = await makeContractDeploy({
  contractName: 'stacks-quest-agent-v3',
  codeBody:     code,
  senderKey:    privateKey,
  network,
  anchorMode:   AnchorMode.Any,
  fee:          200000n,
  nonce,
})

const bytes = serializeTransactionBytes(tx)
console.log('TX bytes:', bytes.length)

const broadcast = await fetch('https://api.mainnet.hiro.so/v2/transactions', {
  method:  'POST',
  headers: { 'Content-Type': 'application/octet-stream' },
  body:    bytes,
})

const text = await broadcast.text()
console.log('Response:', text)

try {
  const json = JSON.parse(text)
  if (json.error) { console.error('Error:', json.error, json.reason); process.exit(1) }
  const txid = json.txid || json
  console.log('Success! TXID:', txid)
  console.log('Explorer: https://explorer.hiro.so/txid/' + txid + '?chain=mainnet')
} catch {
  console.log('Raw:', text)
}
