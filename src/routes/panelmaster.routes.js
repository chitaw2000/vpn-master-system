const express = require('express');
const panelMasterClient = require('../integrations/panelmaster/client');

const router = express.Router();

/**
 * Standardized error response handler
 */
const handleError = (res, error) => {
    console.error('[PanelMaster Route Error]', error.message);
    res.status(500).json({
        success: false,
        error: error.message || 'An unexpected error occurred'
    });
};

// GET /panelmaster/groups
router.get('/groups', async (req, res) => {
    try {
        const data = await panelMasterClient.getActiveGroups();
        res.json({ success: true, data });
    } catch (error) {
        handleError(res, error);
    }
});

// POST /panelmaster/users
router.post('/users', async (req, res) => {
    try {
        const { masterGroupId, userName, totalGB, expireDate } = req.body;
        if (!masterGroupId || !userName || !totalGB || !expireDate) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        const data = await panelMasterClient.createUser({ masterGroupId, userName, totalGB, expireDate });
        res.status(201).json({ success: true, data });
    } catch (error) {
        handleError(res, error);
    }
});

// POST /panelmaster/users/:token/switch
router.post('/users/:token/switch', async (req, res) => {
    try {
        const { token } = req.params;
        const { activeServer } = req.body;
        if (!activeServer) {
            return res.status(400).json({ success: false, error: 'activeServer is required' });
        }
        const data = await panelMasterClient.switchServer({ token, activeServer });
        res.json({ success: true, data });
    } catch (error) {
        handleError(res, error);
    }
});

// POST /panelmaster/users/:token/suspend
router.post('/users/:token/suspend', async (req, res) => {
    try {
        const data = await panelMasterClient.suspendUser(req.params.token);
        res.json({ success: true, data });
    } catch (error) {
        handleError(res, error);
    }
});

// POST /panelmaster/users/:token/resume
router.post('/users/:token/resume', async (req, res) => {
    try {
        const data = await panelMasterClient.resumeUser(req.params.token);
        res.json({ success: true, data });
    } catch (error) {
        handleError(res, error);
    }
});

// DELETE /panelmaster/users/:token
router.delete('/users/:token', async (req, res) => {
    try {
        const data = await panelMasterClient.deleteUser(req.params.token);
        res.json({ success: true, data });
    } catch (error) {
        handleError(res, error);
    }
});

// GET /panelmaster/users/:token/config
router.get('/users/:token/config', async (req, res) => {
    try {
        const data = await panelMasterClient.getUserConfig(req.params.token);
        res.json({ success: true, data });
    } catch (error) {
        handleError(res, error);
    }
});

module.exports = router;
