/**
 * @wkalidev/stacks-quest-sdk
 * Universal SDK for the Stacks Quest multichain puzzle game
 * Supports: Stacks, Base, Celo
 */
export type Chain = 'stacks' | 'base' | 'celo';
export type TokenSymbol = 'STX' | 'B2S' | 'USDCX' | 'AEUSDC' | 'SBTC' | 'ETH' | 'USDC' | 'USDT' | 'CELO' | 'CUSD';
export interface Puzzle {
    id: number;
    question: string;
    hint: string;
    type: string;
    deadline: number;
    finalized: boolean;
    totalPlayers: number;
    prizePool: string;
}
export interface PlayerStats {
    address: string;
    streak: number;
    totalCheckIns: number;
    lastCheckIn: number;
    canCheckIn: boolean;
    nextCheckIn: number;
}
export interface QuestSDKOptions {
    baseRpc?: string;
    celoRpc?: string;
    hiroApiKey?: string;
    contracts?: {
        baseGame?: string;
        baseCheckIn?: string;
        celoGame?: string;
        celoCheckIn?: string;
    };
}
export declare class StacksQuestSDK {
    private opts;
    private readonly DEFAULTS;
    constructor(opts?: QuestSDKOptions);
    /** MCP server endpoint URL */
    getMCPEndpoint(): string;
    /** A2A agent card URL */
    getAgentCard(): string;
    /** App URL */
    getAppURL(): string;
    /** Get today's puzzle for a given chain */
    getPuzzle(chain: Chain): Promise<Puzzle | null>;
    /** Get player stats for a given chain */
    getPlayerStats(address: string, chain: Chain): Promise<PlayerStats | null>;
    /** Get live Stacks network stats */
    getNetworkStats(): Promise<Record<string, unknown> | null>;
    /** Get supported tokens for a chain */
    getSupportedTokens(chain: Chain): TokenSymbol[];
    /** Get contract addresses for a chain */
    getContracts(chain: Chain): {
        game: string;
        checkIn: string;
    };
}
export default StacksQuestSDK;
//# sourceMappingURL=index.d.ts.map