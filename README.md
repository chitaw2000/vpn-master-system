## PanelMaster API Integration

This module connects the Node.js project to the master PanelMaster server to manage VPN keys, groups, and user actions.

### 1. Environment Variables (.env)
You must define the following variables in your `.env` file:
```env
PANELMASTER_BASE_URL=http://YOUR_PANEL_IP:8888
PANELMASTER_API_KEY=My_Super_Secret_VPN_Key_2026
PANELMASTER_TIMEOUT_MS=15000
