const express = require('express');
const adminApp = express.Router();
const Server = require('../models/Server');
const User = require('../models/User');
const authenticateAPI = require('../middlewares/auth');

adminApp.get('/', async (req, res) => {
    const servers = await Server.find({});
    const users = await User.find({});
    let groupHtml = '';
    const groups = {};
    servers.forEach(s => { if(!groups[s.groupName]) groups[s.groupName]=[]; groups[s.groupName].push(s); });
    for (const g in groups) {
        groupHtml += `<div class="bg-white rounded-xl shadow-sm border p-6 mb-6"><h3 class="font-bold text-gray-800 mb-4 border-b pb-2"> ${g}</h3><div class="space-y-3">`;
        groups[g].forEach(s => { groupHtml += `<div class="bg-gray-50 p-3 rounded-lg border flex justify-between items-center"><span class="font-semibold">${s.serverName}</span><code class="text-xs bg-pink-50 px-3 py-1 rounded-md truncate w-64">${s.serverKey}</code></div>`; });
        groupHtml += `</div></div>`;
    }
    let usersHtml = '';
    users.forEach(u => {
        const usagePercent = (u.usedGB / u.totalGB) * 100;
        let pColor = usagePercent > 80 ? 'bg-red-500' : 'bg-green-500';
        usersHtml += `<tr class="border-b hover:bg-gray-50"><td class="p-4"><div class="font-bold">${u.name}</div><div class="text-xs text-gray-400 font-mono">${u.token}</div></td><td class="p-4"><span class="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-semibold">${u.currentServer}</span></td><td class="p-4"><div class="flex justify-between text-xs mb-1"><span class="font-semibold">${u.usedGB} GB</span><span class="text-gray-400">${u.totalGB} GB</span></div><div class="w-full bg-gray-200 rounded-full h-1.5"><div class="${pColor} h-1.5 rounded-full" style="width: ${usagePercent}%"></div></div></td></tr>`;
    });
    res.send(`<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"></head><body class="bg-gray-100 font-sans"><nav class="bg-indigo-600 text-white shadow-md p-4"><div class="max-w-7xl mx-auto font-bold text-xl"><i class="fas fa-database mr-2"></i>VPN ADMIN (MongoDB)</div></nav><div class="max-w-7xl mx-auto p-4 py-8"><div class="grid grid-cols-1 lg:grid-cols-3 gap-8"><div class="col-span-1">${groupHtml}</div><div class="col-span-2 bg-white rounded-xl shadow-sm border overflow-hidden"><table class="w-full text-left"><thead><tr class="bg-gray-50 text-xs uppercase"><th class="p-4">User</th><th class="p-4">Node</th><th class="p-4">Usage</th></tr></thead><tbody>${usersHtml}</tbody></table></div></div></div></body></html>`);
});

adminApp.post('/api/internal/get-server', authenticateAPI, async (req, res) => {
    const user = await User.findOne({token: req.body.token});
    if (user) {
        const server = await Server.findOne({serverName: user.currentServer});
        if (server) return res.json({ outline_key: server.serverKey });
    }
    res.status(404).json({ error: "Not found" });
});

adminApp.post('/api/internal/change-server', authenticateAPI, async (req, res) => {
    const { token, newServer } = req.body;
    const s = await Server.findOne({serverName: newServer});
    if (s) {
        await User.findOneAndUpdate({token: token}, {currentServer: newServer});
        return res.json({ success: true });
    }
    res.status(400).json({ error: "Failed" });
});
module.exports = adminApp;
