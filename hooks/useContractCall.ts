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
  // v7: serializeCV retourne directement un string hex
  const { uintCV, serializeCV } = await import('@stacks/transactions')

  const leather = (window as any).LeatherProvider
  const xverse  = (window as any).XverseProviders?.StacksProvider ||
                  (window as any).StacksProvider

  const microBet = betAmount * 1_000_000

  const functionArgs: string[] = [
    serializeCV(uintCV(guess))    as unknown as string,
    serializeCV(uintCV(microBet)) as unknown as string,
    serializeCV(uintCV(token))    as unknown as string,
  ]

  if (leather) {
    try {
      const response = await leather.request('stx_callContract', {
        contract:          `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
        functionName:      'play',
        functionArgs,
        postConditionMode: 'allow',
        network:           'mainnet',
      })
      const txid = response?.result?.txid || response?.result?.transaction_id
      if (txid) { onFinish(txid) } else { onCancel() }
      return
    } catch (e: any) {
      console.error('[callPlay:leather]', e)
      onCancel()
      return
    }
  }

  if (xverse) {
    try {
      const response = await xverse.request('stx_callContract', {
        contractAddress:   CONTRACT_ADDRESS,
        contractName:      CONTRACT_NAME,
        functionName:      'play',
        functionArgs,
        postConditionMode: 'allow',
        network:           'mainnet',
      })
      const txid = response?.result?.txid || response?.result?.transaction_id
      if (txid) { onFinish(txid) } else { onCancel() }
      return
    } catch (e: any) {
      console.error('[callPlay:xverse]', e)
      onCancel()
      return
    }
  }

  window.open('https://leather.io/install-extension', '_blank')
  onCancel()
}