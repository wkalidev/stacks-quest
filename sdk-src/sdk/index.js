"use strict";
/**
 * @wkalidev/stacks-quest-sdk
 * Universal SDK for the Stacks Quest multichain puzzle game
 * Supports: Stacks, Base, Celo
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StacksQuestSDK = void 0;
class StacksQuestSDK {
    constructor(opts = {}) {
        this.DEFAULTS = {
            baseRpc: 'https://mainnet.base.org',
            celoRpc: 'https://forno.celo.org',
            hiroApi: 'https://api.mainnet.hiro.so',
            stacksContract: 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N',
            appUrl: 'https://stacks-quest-ten.vercel.app',
        };
        this.opts = opts;
    }
    /** MCP server endpoint URL */
    getMCPEndpoint() {
        return `${this.DEFAULTS.appUrl}/api/mcp`;
    }
    /** A2A agent card URL */
    getAgentCard() {
        return `${this.DEFAULTS.appUrl}/.well-known/agent-card.json`;
    }
    /** App URL */
    getAppURL() {
        return this.DEFAULTS.appUrl;
    }
    /** Get today's puzzle for a given chain */
    async getPuzzle(chain) {
        try {
            const res = await fetch(`${this.DEFAULTS.appUrl}/api/puzzle?chain=${chain}`);
            if (!res.ok)
                return null;
            return res.json();
        }
        catch {
            return null;
        }
    }
    /** Get player stats for a given chain */
    async getPlayerStats(address, chain) {
        if (!address)
            throw new Error('StacksQuestSDK: address required');
        if (chain === 'stacks' && !/^SP[A-Z0-9]+$/.test(address)) {
            throw new Error('StacksQuestSDK: invalid Stacks address');
        }
        if (chain !== 'stacks' && !/^0x[0-9a-fA-F]{40}$/.test(address)) {
            throw new Error('StacksQuestSDK: invalid EVM address');
        }
        try {
            const res = await fetch(`${this.DEFAULTS.appUrl}/api/player?address=${address}&chain=${chain}`);
            if (!res.ok)
                return null;
            return res.json();
        }
        catch {
            return null;
        }
    }
    /** Get live Stacks network stats */
    async getNetworkStats() {
        try {
            const res = await fetch(`${this.DEFAULTS.hiroApi}/v2/info`);
            if (!res.ok)
                return null;
            return res.json();
        }
        catch {
            return null;
        }
    }
    /** Get supported tokens for a chain */
    getSupportedTokens(chain) {
        const map = {
            stacks: ['STX', 'B2S', 'USDCX', 'AEUSDC', 'SBTC'],
            base: ['ETH', 'USDC', 'USDT'],
            celo: ['CELO', 'CUSD'],
        };
        return map[chain];
    }
    /** Get contract addresses for a chain */
    getContracts(chain) {
        const map = {
            stacks: {
                game: `${this.DEFAULTS.stacksContract}.stacks-quest-v2`,
                checkIn: `${this.DEFAULTS.stacksContract}.stacks-quest-agent-v3`,
            },
            base: {
                game: this.opts.contracts?.baseGame || '0xE355F73B188713f60F42552d942383303EDE313f',
                checkIn: this.opts.contracts?.baseCheckIn || '0x63529080bb946ED0611c4DC6521a9CcC7579b2FB',
            },
            celo: {
                game: this.opts.contracts?.celoGame || '0x23B7ac7a7171322B1DAF1c8887e47e0C0c181735',
                checkIn: this.opts.contracts?.celoCheckIn || '0x21ad9DDFB07d67c46d0949d887394c70be145775',
            },
        };
        return map[chain];
    }
}
exports.StacksQuestSDK = StacksQuestSDK;
exports.default = StacksQuestSDK;
