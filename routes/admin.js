const express = require('express');
const adminApp = express.Router();
const Group = require('../models/Group');
const Server = require('../models/Server');
const User = require('../models/User');
const authenticateAPI = require('../middlewares/auth');
require('dotenv').config();

// ==========================================
// 1. HOME DASHBOARD (Groups များကိုသာ ပြမည်)
// ==========================================
adminApp.get('/', async (req, res) => {
    const groups = await Group.find({});
    
    let groupsHtml = '';
    for (const g of groups) {
        const userCount = await User.countDocuments({ groupName: g.name });
        const serverCount = await Server.countDocuments({ groupName: g.name });
        
        groupsHtml += `
        <div class="bg-white rounded-xl shadow-sm border p-6 flex flex-col justify-between hover:shadow-md transition">
            <div>
                <h3 class="text-xl font-bold text-gray-800 mb-2"><i class="fas fa-folder-open text-indigo-500 mr-2"></i>${g.name}</h3>
                <p class="text-sm text-gray-500 mb-4">Servers: <b>${serverCount}</b> | Users: <b>${userCount}</b></p>
            </div>
            <a href="/admin/group/${encodeURIComponent(g.name)}" class="text-center w-full bg-indigo-50 text-indigo-700 font-bold py-2 rounded-lg hover:bg-indigo-600 hover:text-white transition">
                ဝင်ရောက်ကြည့်ရှုမည် <i class="fas fa-arrow-right ml-1"></i>
            </a>
        </div>`;
    }

    res.send(`
        <!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"></head>
        <body class="bg-gray-50 font-sans pb-10">
            <nav class="bg-indigo-700 text-white shadow-md p-4 mb-8"><div class="max-w-6xl mx-auto font-bold text-xl"><i class="fas fa-shield-alt mr-2"></i>VPN Admin Panel</div></nav>
            <div class="max-w-6xl mx-auto px-4">
                <div class="flex justify-between items-center mb-6">
                    <h1 class="text-2xl font-black text-gray-800">Server Groups</h1>
                </div>

                <div class="bg-white p-5 rounded-xl shadow-sm border mb-8 flex gap-4 items-end">
                    <div class="flex-1">
                        <label class="block text-sm font-bold text-gray-700 mb-2">Create New Group (ဥပမာ - VIP Package)</label>
                        <form action="/admin/create-group" method="POST" class="flex gap-4">
                            <input type="text" name="groupName" placeholder="Group Name..." required class="flex-1 border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50">
                            <button type="submit" class="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 shadow-sm"><i class="fas fa-plus mr-2"></i>Create Group</button>
                        </form>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${groupsHtml || '<p class="text-gray-400">Group မရှိသေးပါ။ အသစ်တည်ဆောက်ပါ။</p>'}
                </div>
            </div>
        </body></html>
    `);
});

adminApp.post('/create-group', async (req, res) => {
    try {
        if (req.body.groupName) await Group.create({ name: req.body.groupName });
        res.redirect('/admin');
    } catch (error) { res.status(500).send("Error creating group (Name may already exist)"); }
});

// ==========================================
// 2. INSIDE GROUP VIEW (User Key နှင့် Server များ)
// ==========================================
adminApp.get('/group/:name', async (req, res) => {
    const groupName = req.params.name;
    const servers = await Server.find({ groupName: groupName });
    const users = await User.find({ groupName: groupName });

    let serversHtml = '';
    servers.forEach(s => {
        serversHtml += `<div class="bg-gray-100 px-4 py-2 rounded-lg mb-2 flex justify-between items-center"><span class="font-bold text-gray-700">${s.serverName}</span><code class="text-xs text-gray-500 truncate w-32">${s.serverKey}</code></div>`;
    });

    let usersHtml = '';
    users.forEach((u, index) => {
        // SSConf Link တည်ဆောက်ခြင်း
        const link = `ssconf://${process.env.VPS_IP}:${process.env.USER_PORT}/${u.token}.json#VPN-${u.name.replace(/\s+/g, '')}`;
        usersHtml += `
        <tr class="border-b hover:bg-gray-50">
            <td class="p-4 text-gray-500 font-bold">${index + 1}</td>
            <td class="p-4"><div class="font-bold text-gray-800 text-base">${u.name}</div><div class="text-xs text-indigo-500 font-mono">Token: ${u.token}</div></td>
            <td class="p-4 text-sm font-semibold text-gray-600">${u.currentServer}</td>
            <td class="p-4 text-sm text-red-500 font-semibold"><i class="far fa-clock mr-1"></i>${u.expireDate}</td>
            <td class="p-4"><div class="text-sm font-bold text-gray-700">${u.usedGB} / ${u.totalGB} GB</div></td>
            <td class="p-4 text-right">
                <button id="btn-${u.token}" onclick="copyLink('${link}', 'btn-${u.token}')" class="bg-gray-800 text-white hover:bg-black px-4 py-2 rounded-lg text-xs font-bold transition shadow">
                    <i class="fas fa-copy mr-1"></i> Copy SSConf
                </button>
            </td>
        </tr>`;
    });

    res.send(`
        <!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"></head>
        <body class="bg-gray-50 font-sans pb-10">
            <nav class="bg-indigo-700 text-white shadow-md p-4 mb-6">
                <div class="max-w-6xl mx-auto flex items-center">
                    <a href="/admin" class="hover:text-gray-300 mr-4 text-xl"><i class="fas fa-arrow-left"></i></a>
                    <span class="font-bold text-xl">${groupName} Management</span>
                </div>
            </nav>
            <div class="max-w-6xl mx-auto px-4">
                
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6">
                        <h2 class="font-bold text-gray-800 mb-4 text-lg"><i class="fas fa-key text-yellow-500 mr-2"></i> Create User Key</h2>
                        <form action="/admin/add-user" method="POST" class="grid grid-cols-2 gap-4">
                            <input type="hidden" name="groupName" value="${groupName}">
                            <div class="col-span-2"><input type="text" name="name" placeholder="User Name / Note" required class="w-full border p-3 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"></div>
                            <input type="text" name="token" placeholder="Unique Token (e.g. key123)" required class="border p-3 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <input type="number" name="totalGB" placeholder="Data Limit (GB)" required class="border p-3 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <div class="col-span-2 flex gap-4 items-center">
                                <input type="date" name="expireDate" required class="flex-1 border p-3 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600">
                                <button type="submit" class="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 shadow-sm w-1/2">Generate Key</button>
                            </div>
                        </form>
                    </div>

                    <div class="bg-white rounded-xl shadow-sm border p-6">
                        <h2 class="font-bold text-gray-800 mb-4"><i class="fas fa-server text-gray-500 mr-2"></i> Add Server Node</h2>
                        <form action="/admin/add-server" method="POST" class="space-y-3 mb-6">
                            <input type="hidden" name="groupName" value="${groupName}">
                            <input type="text" name="serverName" placeholder="Node Name (e.g. SG-1)" required class="w-full border p-2 rounded-lg bg-gray-50 text-sm outline-none">
                            <input type="text" name="serverKey" placeholder="Outline Key (ss://...)" required class="w-full border p-2 rounded-lg bg-gray-50 text-sm outline-none">
                            <button type="submit" class="w-full bg-gray-200 text-gray-800 p-2 rounded-lg font-bold hover:bg-gray-300 text-sm">Add Server</button>
                        </form>
                        <hr class="mb-4">
                        <h3 class="font-bold text-xs text-gray-400 uppercase tracking-wider mb-2">Available Nodes (${servers.length})</h3>
                        <div class="max-h-32 overflow-y-auto">${serversHtml || '<p class="text-xs text-red-400">Server ထည့်ပေးရန် လိုအပ်ပါသည်။</p>'}</div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div class="p-5 border-b bg-gray-50"><h2 class="text-xl font-bold text-gray-800"><i class="fas fa-users text-gray-400 mr-2"></i> Key List (${users.length})</h2></div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead><tr class="bg-gray-100 text-xs uppercase text-gray-500"><th class="p-4 w-10">No</th><th class="p-4">User Details</th><th class="p-4">Active Node</th><th class="p-4">Expire Date</th><th class="p-4">Data Usage</th><th class="p-4 text-right">Action</th></tr></thead>
                            <tbody>${usersHtml || '<tr><td colspan="6" class="p-6 text-center text-gray-400">ဒီ Group မှာ User မရှိသေးပါ။</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>
            </div>

            <script>
                function copyLink(link, btnId) {
                    var tempInput = document.createElement("input");
                    tempInput.value = link;
                    document.body.appendChild(tempInput);
                    tempInput.select();
                    tempInput.setSelectionRange(0, 99999); // Mobile များအတွက်
                    
                    try {
                        document.execCommand("copy");
                        
                        // ခလုတ်ကို Copied! ဟု ပြောင်းပြခြင်း
                        var btn = document.getElementById(btnId);
                        var originalText = btn.innerHTML;
                        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                        btn.classList.replace('bg-gray-800', 'bg-green-600');
                        btn.classList.replace('hover:bg-black', 'hover:bg-green-700');
                        
                        // ၃ စက္ကန့်နေရင် နဂိုအတိုင်း ပြန်ပြောင်းမည်
                        setTimeout(function() {
                            btn.innerHTML = originalText;
                            btn.classList.replace('bg-green-600', 'bg-gray-800');
                            btn.classList.replace('hover:bg-green-700', 'hover:bg-black');
                        }, 3000);
                        
                    } catch (err) {
                        alert("Copy ကူးရာတွင် အဆင်မပြေပါ။ ဖုန်း Version ကြောင့်ဖြစ်နိုင်ပါသည်။");
                    }
                    
                    document.body.removeChild(tempInput);
                }
            </script>
        </body></html>
    `);
});

// APIs & Form Handlers
adminApp.post('/add-server', async (req, res) => {
    try {
        const { groupName, serverName, serverKey } = req.body;
        if (groupName && serverName && serverKey) await Server.create({ groupName, serverName, serverKey });
        res.redirect('/admin/group/' + encodeURIComponent(groupName));
    } catch (error) { res.status(500).send("Error adding server"); }
});

adminApp.post('/add-user', async (req, res) => {
    try {
        const { groupName, name, token, totalGB, expireDate } = req.body;
        const firstServer = await Server.findOne({ groupName: groupName });
        const defaultServer = firstServer ? firstServer.serverName : "None";

        if (name && token && totalGB && expireDate) {
            await User.create({ name, token, groupName, totalGB: Number(totalGB), usedGB: 0, currentServer: defaultServer, expireDate });
        }
        res.redirect('/admin/group/' + encodeURIComponent(groupName));
    } catch (error) { res.status(500).send("Error adding user (Token must be unique)"); }
});

// Internal APIs for User Panel
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
