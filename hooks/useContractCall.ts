'use client'

const CONTRACT_ADDRESS = 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N'
const CONTRACT_NAME    = 'stacks-quest-v2'

export async function callPlay(
  guess:     number,
  betAmount: number,
  token:     number,
  onFinish:  (txid: string) => void,
  onCancel:  () => void,
) {
  const provider =
    (window as any).LeatherProvider ||
    (window as any).StacksProvider

  if (!provider) {
    window.open('https://leather.io/install-extension', '_blank')
    return
  }

  const microBet = betAmount * 1_000_000

  // Arguments Clarity en format ABI lisible — supporte Leather et Xverse
  const functionArgs = [
    { type: 'uint', value: guess.toString() },
    { type: 'uint', value: microBet.toString() },
    { type: 'uint', value: token.toString() },
  ]

  try {
    const response = await provider.request('stx_callContract', {
      contractAddress:   CONTRACT_ADDRESS,
      contractName:      CONTRACT_NAME,
      functionName:      'play',
      functionArgs,
      postConditionMode: 'allow',
      network:           'mainnet',
    })

    const txid =
      response?.result?.txid ||
      response?.txid ||
      response?.result?.transaction_id

    if (txid) {
      onFinish(txid)
    } else {
      console.warn('[callPlay] no txid in response', response)
      onCancel()
    }
  } catch (e: any) {
    console.error('[callPlay]', e?.message || e)
    onCancel()
  }
}