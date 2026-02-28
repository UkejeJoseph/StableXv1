/**
 * Simple retry utility for blockchain RPC calls
 * @param {Function} fn - The async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>}
 */
export const withRetry = async (fn, { retries = 3, delay = 1000, backoff = 2 } = {}) => {
    let lastError;
    let currentDelay = delay;

    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.warn(`[RETRY] Attempt ${i + 1}/${retries} failed: ${error.message}. Retrying in ${currentDelay}ms...`);

            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, currentDelay));
                currentDelay *= backoff;
            }
        }
    }

    throw lastError;
};
