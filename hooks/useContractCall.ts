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
  // Import only what we need — avoid type conflicts with serializeCV
  const stacks = await import('@stacks/transactions')

  const leather = (window as any).LeatherProvider
  const xverse  = (window as any).XverseProviders?.StacksProvider ||
                  (window as any).StacksProvider

  const microBet = betAmount * 1_000_000

  // Build CVs
  const cvGuess  = stacks.uintCV(guess)
  const cvBet    = stacks.uintCV(microBet)
  const cvToken  = stacks.uintCV(token)

  // Serialize to hex — works regardless of whether serializeCV returns string or Uint8Array
  const toHex = (cv: any): string => {
    const result = stacks.serializeCV(cv)
    if (typeof result === 'string') return result
    return Array.from(result as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('')
  }

  const functionArgs = [toHex(cvGuess), toHex(cvBet), toHex(cvToken)]

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
      console.error('[callPlay:leather]', e?.message || e)
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
      console.error('[callPlay:xverse]', e?.message || e)
      onCancel()
      return
    }
  }

  window.open('https://leather.io/install-extension', '_blank')
  onCancel()
}

export async function checkResult(
  txid:   string,
  guess:  number,
  onWin:  () => void,
  onLose: () => void,
  onHint: (hint: 'hot' | 'warm' | 'cold') => void,
) {
  const maxAttempts = 20
  let attempts = 0

  const poll = async () => {
    attempts++
    try {
      const res  = await fetch(`https://api.mainnet.hiro.so/extended/v1/tx/${txid}`)
      const data = await res.json()

      if (data.tx_status === 'success') {
        const event = data.events?.find((e: any) => e.event_type === 'smart_contract_log')
        const value = event?.contract_log?.value?.repr

        if (value?.includes('won') || value?.includes('correct')) {
          onWin(); return
        }
        if (value?.includes('lost') || value?.includes('wrong')) {
          const actual = parseInt(value?.match(/\d+/)?.[0] || '0')
          if (actual > 0) {
            const diff = Math.abs(guess - actual) / actual
            if (diff < 0.01)      onHint('hot')
            else if (diff < 0.05) onHint('warm')
            else                  onHint('cold')
          } else { onHint('cold') }
          onLose(); return
        }
      }

      if (data.tx_status === 'abort_by_response' || data.tx_status === 'abort_by_post_condition') {
        onLose(); return
      }

      if (attempts < maxAttempts) setTimeout(poll, 3000)
      else onLose()
    } catch {
      if (attempts < maxAttempts) setTimeout(poll, 3000)
      else onLose()
    }
  }

  setTimeout(poll, 3000)
}