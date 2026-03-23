const express = require('express');
const adminApp = express.Router();
const Server = require('../models/Server');
const User = require('../models/User');
const authenticateAPI = require('../middlewares/auth');

// ➕ Server အသစ်ထည့်ရန် (MongoDB သို့)
adminApp.post('/add-server', async (req, res) => {
    try {
        const { groupName, serverName, serverKey } = req.body;
        if (groupName && serverName && serverKey) {
            await Server.create({ groupName, serverName, serverKey });
        }
        res.redirect('/admin');
    } catch (error) { res.status(500).send("Error adding server"); }
});

// ➕ User အသစ်ထည့်ရန် (MongoDB သို့)
adminApp.post('/add-user', async (req, res) => {
    try {
        const { name, token, totalGB, serverName } = req.body;
        if (name && token && totalGB && serverName) {
            await User.create({ name, token, totalGB: Number(totalGB), usedGB: 0, currentServer: serverName });
        }
        res.redirect('/admin');
    } catch (error) { res.status(500).send("Error adding user (Token may already exist)"); }
});

// 🖥️ Admin Dashboard မျက်နှာပြင်
adminApp.get('/', async (req, res) => {
    const servers = await Server.find({});
    const users = await User.find({});
    
    // Server များကို Group လိုက်ခွဲခြင်း
    let groupHtml = '';
    let serverOptions = ''; // User ထည့်ရာတွင် ရွေးချယ်ရန် Dropdown
    const groups = {};
    
    servers.forEach(s => { 
        if(!groups[s.groupName]) groups[s.groupName] = []; 
        groups[s.groupName].push(s); 
        serverOptions += `<option value="${s.serverName}">${s.serverName} (${s.groupName})</option>`;
    });

    for (const g in groups) {
        groupHtml += `
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
            <h3 class="font-bold text-gray-800 mb-3 border-b pb-2 text-lg"><i class="fas fa-server text-indigo-500 mr-2"></i> ${g}</h3>
            <div class="space-y-2">`;
        groups[g].forEach(s => { 
            groupHtml += `
            <div class="bg-gray-50 p-3 rounded-lg border flex justify-between items-center">
                <span class="font-semibold text-gray-700">${s.serverName}</span>
                <code class="text-xs text-pink-600 bg-pink-50 px-2 py-1 rounded truncate w-48">${s.serverKey}</code>
            </div>`; 
        });
        groupHtml += `</div></div>`;
    }

    // User များကို ပြသခြင်း
    let usersHtml = '';
    users.forEach(u => {
        const usagePercent = (u.usedGB / u.totalGB) * 100;
        let pColor = usagePercent > 80 ? 'bg-red-500' : 'bg-green-500';
        usersHtml += `
        <tr class="border-b hover:bg-gray-50">
            <td class="p-3"><div class="font-bold text-gray-800">${u.name}</div><div class="text-xs text-gray-400 font-mono">${u.token}</div></td>
            <td class="p-3"><span class="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-xs font-semibold">${u.currentServer}</span></td>
            <td class="p-3">
                <div class="flex justify-between text-xs mb-1"><span class="font-semibold">${u.usedGB} GB</span><span class="text-gray-400">${u.totalGB} GB</span></div>
                <div class="w-full bg-gray-200 rounded-full h-1.5"><div class="${pColor} h-1.5 rounded-full" style="width: ${usagePercent}%"></div></div>
            </td>
        </tr>`;
    });

    res.send(`
        <!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"></head>
        <body class="bg-gray-100 font-sans pb-10">
            <nav class="bg-indigo-600 text-white shadow-md p-4 mb-6"><div class="max-w-7xl mx-auto font-bold text-xl"><i class="fas fa-shield-alt mr-2"></i>VPN Master Admin</div></nav>
            <div class="max-w-7xl mx-auto px-4">
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div class="bg-white rounded-xl shadow border p-5">
                        <h2 class="font-bold text-gray-800 mb-4"><i class="fas fa-plus-circle text-green-500 mr-2"></i> Add Server Node</h2>
                        <form action="/admin/add-server" method="POST" class="space-y-3">
                            <input type="text" name="groupName" placeholder="Group Name (e.g. ⭐ VIP)" required class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                            <input type="text" name="serverName" placeholder="Server Name (e.g. SG-1)" required class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                            <input type="text" name="serverKey" placeholder="ss://..." required class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                            <button type="submit" class="w-full bg-green-600 text-white p-2 rounded font-bold hover:bg-green-700">Add Server</button>
                        </form>
                    </div>

                    <div class="bg-white rounded-xl shadow border p-5">
                        <h2 class="font-bold text-gray-800 mb-4"><i class="fas fa-user-plus text-blue-500 mr-2"></i> Add New User</h2>
                        <form action="/admin/add-user" method="POST" class="space-y-3">
                            <input type="text" name="name" placeholder="User Name" required class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                            <input type="text" name="token" placeholder="Unique Token (e.g. user123)" required class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                            <div class="flex gap-3">
                                <input type="number" name="totalGB" placeholder="Total GB" required class="w-1/3 border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                                <select name="serverName" required class="w-2/3 border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
                                    <option value="" disabled selected>Assign to Server...</option>
                                    ${serverOptions}
                                </select>
                            </div>
                            <button type="submit" class="w-full bg-blue-600 text-white p-2 rounded font-bold hover:bg-blue-700">Add User</button>
                        </form>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="lg:col-span-1"><h2 class="text-xl font-bold text-gray-800 mb-4"><i class="fas fa-network-wired text-gray-400 mr-2"></i> Nodes</h2>${groupHtml}</div>
                    <div class="lg:col-span-2 bg-white rounded-xl shadow border overflow-hidden">
                        <div class="p-4 border-b bg-gray-50"><h2 class="text-xl font-bold text-gray-800"><i class="fas fa-users text-gray-400 mr-2"></i> Active Users</h2></div>
                        <div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="bg-gray-100 text-xs uppercase text-gray-500"><th class="p-3">User</th><th class="p-3">Node</th><th class="p-3">Usage</th></tr></thead><tbody>${usersHtml}</tbody></table></div>
                    </div>
                </div>
            </div>
        </body></html>
    `);
});

// Internal APIs for SSConf (Secured with API Key)
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
