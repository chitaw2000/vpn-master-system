const express = require('express');
const adminApp = express.Router();
const Server = require('../models/Server');
const User = require('../models/User');
const authenticateAPI = require('../middlewares/auth');
require('dotenv').config();

// ➕ Add Server
adminApp.post('/add-server', async (req, res) => {
    try {
        const { groupName, serverName, serverKey } = req.body;
        if (groupName && serverName && serverKey) await Server.create({ groupName, serverName, serverKey });
        res.redirect('/admin');
    } catch (error) { res.status(500).send("Error adding server"); }
});

// ➕ Add User (Group သတ်မှတ်ချက်ပါဝင်သည်)
adminApp.post('/add-user', async (req, res) => {
    try {
        const { name, token, totalGB, serverName } = req.body;
        if (name && token && totalGB && serverName) {
            // Server နာမည်ကိုကြည့်ပြီး သူဘယ် Group ကလဲဆိုတာကို အရင်ရှာမည်
            const serverInfo = await Server.findOne({ serverName: serverName });
            if(serverInfo) {
                await User.create({ name, token, groupName: serverInfo.groupName, totalGB: Number(totalGB), usedGB: 0, currentServer: serverName });
            }
        }
        res.redirect('/admin');
    } catch (error) { res.status(500).send("Error adding user"); }
});

// 🖥️ Admin UI
adminApp.get('/', async (req, res) => {
    const servers = await Server.find({});
    const users = await User.find({});
    
    // Group လိုက် Data များကို စုစည်းခြင်း
    const groups = {};
    let serverDropdown = '';
    
    servers.forEach(s => {
        if (!groups[s.groupName]) groups[s.groupName] = { servers: [], users: [] };
        groups[s.groupName].servers.push(s);
        serverDropdown += `<option value="${s.serverName}">${s.serverName} (${s.groupName})</option>`;
    });

    users.forEach(u => {
        if (!groups[u.groupName]) groups[u.groupName] = { servers: [], users: [] };
        groups[u.groupName].users.push(u);
    });

    let mainHtml = '';
    for (const gName in groups) {
        let serversHtml = '';
        groups[gName].servers.forEach(s => {
            serversHtml += `<div class="bg-gray-100 px-3 py-2 rounded mb-2 flex justify-between"><span class="font-bold text-gray-700 text-sm">${s.serverName}</span><code class="text-xs text-gray-500 truncate w-32">${s.serverKey}</code></div>`;
        });

        let usersHtml = '';
        groups[gName].users.forEach(u => {
            const usage = (u.usedGB / u.totalGB) * 100;
            const link = `ssconf://${process.env.VPS_IP}:${process.env.USER_PORT}/${u.token}.json#VPN-${u.name.replace(/\s+/g, '')}`;
            
            usersHtml += `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-3"><div class="font-bold">${u.name}</div><div class="text-xs text-gray-400 font-mono">${u.token}</div></td>
                <td class="p-3 text-sm font-semibold text-indigo-600">${u.currentServer}</td>
                <td class="p-3 w-1/4">
                    <div class="text-xs mb-1">${u.usedGB} / ${u.totalGB} GB</div>
                    <div class="w-full bg-gray-200 rounded-full h-1.5"><div class="bg-blue-500 h-1.5 rounded-full" style="width: ${usage}%"></div></div>
                </td>
                <td class="p-3 text-right">
                    <button onclick="copyLink('${link}')" class="bg-green-100 text-green-700 hover:bg-green-500 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition shadow-sm border border-green-200">
                        <i class="fas fa-copy mr-1"></i> Copy SSConf
                    </button>
                </td>
            </tr>`;
        });

        mainHtml += `
        <div class="bg-white rounded-xl shadow-sm border p-6 mb-8 border-t-4 border-indigo-500">
            <h2 class="text-2xl font-black text-gray-800 mb-6"><i class="fas fa-layer-group text-indigo-500 mr-2"></i> ${gName}</h2>
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div class="lg:col-span-1 bg-gray-50 p-4 rounded-lg border">
                    <h3 class="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wider">Nodes in Package</h3>
                    ${serversHtml || '<p class="text-xs text-gray-400">No servers added yet.</p>'}
                </div>
                <div class="lg:col-span-3">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead><tr class="bg-gray-100 text-xs uppercase text-gray-500"><th class="p-3">User Key</th><th class="p-3">Active Node</th><th class="p-3">Data Limit</th><th class="p-3 text-right">Action</th></tr></thead>
                            <tbody>${usersHtml || '<tr><td colspan="4" class="p-4 text-center text-sm text-gray-400">No users in this group yet.</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>`;
    }

    res.send(`
        <!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"></head>
        <body class="bg-gray-100 font-sans pb-10">
            <nav class="bg-indigo-700 text-white shadow-md p-4 mb-6"><div class="max-w-7xl mx-auto font-bold text-xl"><i class="fas fa-database mr-2"></i>VPN Master Management</div></nav>
            <div class="max-w-7xl mx-auto px-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div class="bg-white rounded-xl shadow border p-5">
                        <h2 class="font-bold text-gray-800 mb-4"><i class="fas fa-plus text-green-500 mr-2"></i> Add Server Node</h2>
                        <form action="/admin/add-server" method="POST" class="space-y-3">
                            <input type="text" name="groupName" placeholder="Group / Package Name (e.g. ⭐ VIP Asia)" required class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                            <input type="text" name="serverName" placeholder="Server Name (e.g. SG-1)" required class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                            <input type="text" name="serverKey" placeholder="ss://..." required class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                            <button type="submit" class="w-full bg-gray-800 text-white p-2 rounded font-bold hover:bg-black">Save Node</button>
                        </form>
                    </div>
                    <div class="bg-white rounded-xl shadow border p-5">
                        <h2 class="font-bold text-gray-800 mb-4"><i class="fas fa-user-plus text-blue-500 mr-2"></i> Generate User Key</h2>
                        <form action="/admin/add-user" method="POST" class="space-y-3">
                            <input type="text" name="name" placeholder="Customer Name or Note" required class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                            <input type="text" name="token" placeholder="Custom Secret Token (e.g. user_ko_aung_01)" required class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                            <div class="flex gap-3">
                                <input type="number" name="totalGB" placeholder="Total GB" required class="w-1/3 border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                                <select name="serverName" required class="w-2/3 border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                                    <option value="" disabled selected>Assign to Package & Server...</option>
                                    ${serverDropdown}
                                </select>
                            </div>
                            <button type="submit" class="w-full bg-blue-600 text-white p-2 rounded font-bold hover:bg-blue-700">Generate Key</button>
                        </form>
                    </div>
                </div>
                ${mainHtml}
            </div>
            <script>
                function copyLink(link) {
                    navigator.clipboard.writeText(link).then(() => { alert("✅ SSConf Link Copied! You can send this to the user."); }).catch(() => { alert("Failed to copy link."); });
                }
            </script>
        </body></html>
    `);
});

// APIs (Same as before)
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
