const express = require('express');
const axios = require('axios');
const userApp = express.Router();
const redisClient = require('../config/redis');
const User = require('../models/User');
const Server = require('../models/Server');
require('dotenv').config();

userApp.get('/panel/:token', async (req, res) => {
    try {
        const token = req.params.token;
        const user = await User.findOne({ token: token });
        if(!user) return res.status(404).send("User not found!");

        const servers = await Server.find({});
        const groups = {};
        servers.forEach(s => {
            if (!groups[s.groupName]) groups[s.groupName] = [];
            groups[s.groupName].push(s.serverName);
        });

        let dropdownOptions = '';
        for (const groupName in groups) {
            dropdownOptions += `<optgroup label="${groupName}">`;
            groups[groupName].forEach(serverName => {
                const isSelected = user.currentServer === serverName ? 'selected' : '';
                dropdownOptions += `<option value="${serverName}" ${isSelected}>${serverName}</option>`;
            });
            dropdownOptions += `</optgroup>`;
        }

        const ssconfLink = `ssconf://${process.env.VPS_IP}:${process.env.USER_PORT}/${token}.json#VPN-${user.name.replace(/\s+/g, '')}`;

        res.send(`<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"></head><body class="bg-gray-100 flex justify-center items-center min-h-screen p-4"><div class="bg-white p-8 rounded-xl shadow-lg w-full max-w-md"><h2 class="text-2xl font-bold text-gray-800 mb-2">My VPN</h2><p class="text-gray-600 mb-6">Welcome back, <b>${user.name}</b></p><div class="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200"><p class="mb-2"><strong>Usage:</strong> ${user.usedGB} GB / ${user.totalGB} GB</p><p><strong>Node:</strong> <span class="text-indigo-600 font-bold">${user.currentServer}</span></p></div><form action="/panel/change-server" method="POST" class="mb-6"><input type="hidden" name="token" value="${token}"><label class="block text-sm text-gray-600 mb-2">Change Location:</label><select name="newServer" class="w-full p-3 border rounded-lg mb-4 outline-none focus:ring-2 focus:ring-indigo-500">${dropdownOptions}</select><button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition">Update Server</button></form><hr class="mb-6"><button onclick="copyLink('${ssconfLink}')" class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg flex justify-center items-center shadow-md transition"><i class="fas fa-copy mr-2"></i> Copy SSConf Link</button><p class="text-xs text-center text-gray-400 mt-3 break-all">${ssconfLink}</p></div><script>function copyLink(link) { navigator.clipboard.writeText(link).then(() => { alert("✅ Link Copied! Open Outline App to add."); }).catch(err => { alert("Failed to copy"); }); }</script></body></html>`);
    } catch (error) { res.status(500).send("Error"); }
});

userApp.post('/panel/change-server', async (req, res) => {
    const { token, newServer } = req.body;
    try {
        await axios.post(`http://127.0.0.1:${process.env.ADMIN_PORT}/api/internal/change-server`, { token, newServer }, { headers: { 'x-api-key': process.env.SECRET_API_KEY } });
        await redisClient.del(token);
        res.redirect('/panel/' + token);
    } catch (error) { res.status(500).send("Error"); }
});

userApp.get('/:token.json', async (req, res) => {
    const token = req.params.token;
    try {
        const cachedKey = await redisClient.get(token);
        if (cachedKey) return res.json({ server: cachedKey });

        const response = await axios.post(`http://127.0.0.1:${process.env.ADMIN_PORT}/api/internal/get-server`, { token }, { headers: { 'x-api-key': process.env.SECRET_API_KEY } });
        if (response.data && response.data.outline_key) {
            await redisClient.setEx(token, 300, response.data.outline_key);
            return res.json({ server: response.data.outline_key });
        }
    } catch (error) { res.status(500).json({ error: "Config Error" }); }
});
module.exports = userApp;
