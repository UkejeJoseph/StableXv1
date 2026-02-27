// ──────────────────────────────────────────────────────────────
// Dynamic TRON Gas Fee Estimator
// Uses triggerconstantcontract to simulate a TRC20 transfer
// and calculate the exact TRX needed for the energy cost.
// ──────────────────────────────────────────────────────────────

const TRON_GRID_API = "https://api.trongrid.io";
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

// Current energy unit price on TRON mainnet (in SUN). 
// As of Proposal #104 (2025), this is 420 SUN per energy unit.
const ENERGY_UNIT_PRICE_SUN = 420;
const SUN_PER_TRX = 1_000_000;
const SAFETY_BUFFER = 1.2; // 20% buffer

/**
 * Estimate the TRX gas cost for a TRC20 USDT transfer.
 * @param {string} fromAddress - The sender's TRON address (hex or base58)
 * @param {string} toAddress   - The recipient's TRON address (hex or base58)
 * @param {number} amount      - The USDT amount to transfer
 * @returns {Promise<number>}  - Estimated TRX needed (with safety buffer)
 */
export async function estimateTronGas(fromAddress, toAddress, amount = 1) {
    try {
        const amountInSun = Math.floor(amount * 1_000_000);

        // Encode transfer(address,uint256) parameters
        const toHex = tronAddressToHex(toAddress).slice(2).padStart(64, '0');
        const amountHex = BigInt(amountInSun).toString(16).padStart(64, '0');
        const parameter = toHex + amountHex;

        const response = await fetch(`${TRON_GRID_API}/wallet/triggerconstantcontract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                owner_address: tronAddressToHex(fromAddress),
                contract_address: tronAddressToHex(USDT_CONTRACT),
                function_selector: "transfer(address,uint256)",
                parameter,
            }),
        });

        const data = await response.json();

        if (!data.result?.result) {
            console.warn('[GAS] triggerconstantcontract failed, using fallback gas estimate');
            return getFallbackGas();
        }

        const energyUsed = data.energy_used || 65000; // Default ~65K for existing USDT holders
        const trxCost = (energyUsed * ENERGY_UNIT_PRICE_SUN * SAFETY_BUFFER) / SUN_PER_TRX;
        const rounded = Math.ceil(trxCost);

        console.log(`[GAS] Estimated energy: ${energyUsed} units → ${rounded} TRX (with ${(SAFETY_BUFFER - 1) * 100}% buffer)`);
        return rounded;

    } catch (error) {
        console.error(`[GAS] Estimation failed: ${error.message}. Using fallback.`);
        return getFallbackGas();
    }
}

/**
 * Fallback gas value from .env or hardcoded default
 */
function getFallbackGas() {
    const fallback = Number(process.env.TRX_GAS_FEE_AMOUNT) || 30;
    console.log(`[GAS] Using fallback gas: ${fallback} TRX`);
    return fallback;
}

// ── Helper: Convert Tron base58 address to hex ──
function tronAddressToHex(address) {
    if (address.startsWith('41')) return address;
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let num = BigInt(0);
    for (const char of address) {
        num = num * BigInt(58) + BigInt(ALPHABET.indexOf(char));
    }
    return num.toString(16).slice(0, 42);
}
