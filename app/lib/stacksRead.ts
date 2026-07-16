// app/lib/stacksRead.ts
// Shared helpers for calling Stacks read-only contract functions from server routes
// and decoding the Clarity Value results into plain JSON.

import { principalCV, serializeCV, cvToJSON, hexToCV } from '@stacks/transactions'

const HIRO = 'https://api.mainnet.hiro.so'

/** Serialize a Stacks principal (address) to the hex-encoded Clarity Value the Hiro API expects. */
export function principalToHex(address: string): string {
  const hex = serializeCV(principalCV(address)) as unknown as string
  return hex.startsWith('0x') ? hex : `0x${hex}`
}

/**
 * Call a read-only function on a Stacks contract via the Hiro API and decode the result.
 * Returns the decoded `cvToJSON` value, or null on any failure (network, non-ok, bad CV).
 */
export async function callReadOnly(
  contractAddress: string,
  contractName:    string,
  functionName:    string,
  argsHex:         string[],
  sender:          string,
): Promise<any | null> {
  try {
    const res = await fetch(
      `${HIRO}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sender, arguments: argsHex }),
      },
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.okay || !data?.result) return null
    return cvToJSON(hexToCV(data.result))
  } catch {
    return null
  }
}

/** Pull a `uint` field out of a decoded tuple CV (cvToJSON shape), defaulting to 0. */
export function cvUint(decoded: any, field: string): number {
  const v = decoded?.value?.[field]?.value
  if (v === undefined) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Pull a `bool` value out of a decoded CV. */
export function cvBool(decoded: any): boolean {
  return decoded?.value === true || decoded?.type === 'true'
}
