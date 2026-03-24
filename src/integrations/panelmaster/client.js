/**
 * PanelMaster API Client
 * Requires Node.js 18+ for native fetch support.
 */

class PanelMasterClient {
    constructor() {
        this.baseUrl = process.env.PANELMASTER_BASE_URL;
        this.apiKey = process.env.PANELMASTER_API_KEY;
        this.timeoutMs = parseInt(process.env.PANELMASTER_TIMEOUT_MS, 10) || 15000;

        if (!this.baseUrl || !this.apiKey) {
            console.warn('⚠️ PANELMASTER_BASE_URL or PANELMASTER_API_KEY is not set.');
        }
    }

    /**
     * Internal request handler with AbortController for timeouts
     */
    async _request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const headers = {
            'Content-Type': 'application/json',
            ...(options.requireApiKey !== false && { 'x-api-key': this.apiKey }),
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal
            });

            if (!response.ok) {
                let errorMsg = `HTTP Error: ${response.status}`;
                try {
                    const errorBody = await response.json();
                    errorMsg = errorBody.message || errorBody.error || errorMsg;
                } catch {
                    errorMsg = await response.text() || errorMsg;
                }
                throw new Error(`PanelMaster API Error: ${errorMsg}`);
            }

            // Return JSON if present, otherwise empty object
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            return {};
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(`PanelMaster API Request timed out after ${this.timeoutMs}ms`);
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async getActiveGroups() {
        return this._request('/api/active-groups', { method: 'GET' });
    }

    async createUser({ masterGroupId, userName, totalGB, expireDate }) {
        return this._request('/api/generate-keys', {
            method: 'POST',
            body: JSON.stringify({ masterGroupId, userName, totalGB, expireDate })
        });
    }

    async switchServer({ token, activeServer }) {
        return this._request('/api/webhook/switch', {
            method: 'POST',
            body: JSON.stringify({ token, activeServer })
        });
    }

    async userAction({ token, action }) {
        const validActions = ['suspend', 'resume', 'delete'];
        if (!validActions.includes(action)) {
            throw new Error(`Invalid action. Must be one of: ${validActions.join(', ')}`);
        }
        return this._request('/api/user-action', {
            method: 'POST',
            body: JSON.stringify({ token, action })
        });
    }

    async suspendUser(token) {
        return this.userAction({ token, action: 'suspend' });
    }

    async resumeUser(token) {
        return this.userAction({ token, action: 'resume' });
    }

    async deleteUser(token) {
        return this.userAction({ token, action: 'delete' });
    }

    async getUserConfig(token) {
        return this._request(`/conf/${token}.json`, { 
            method: 'GET',
            requireApiKey: false // No x-api-key required for this endpoint
        });
    }
}

module.exports = new PanelMasterClient();
