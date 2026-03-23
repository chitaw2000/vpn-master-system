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
        if(!user) return res.status(404).send("User not found or Token is invalid!");

        const servers = await Server.find({});
        const groups = {};
        
        // Dropdown အတွက် Server များကို Group လိုက် ပြန်စုခြင်း
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

        // Host ကိုအလိုအလျောက်ယူ၍ SSConf Link ဖန်တီးခြင်း
        const ssconfLink = `ssconf://${req.get('host')}/${token}.json#VPN-${user.name.replace(/\s+/g, '')}`;

        res.send(`
            <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet"></head>
            <body class="bg-gray-100 flex justify-center items-center min-h-screen p-4">
                <div class="bg-white p-6 md:p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
                    
                    <div class="text-center mb-6">
                        <h2 class="text-2xl font-black text-gray-800"><i class="fas fa-shield-alt text-indigo-600 mr-2"></i>VPN Dials</h2>
                        <p class="text-gray-500 mt-1">Welcome back, <b class="text-gray-800">${user.name}</b></p>
                    </div>
                    
                    <button onclick="copyLink('${ssconfLink}')" class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg transition transform hover:-translate-y-1 mb-6 flex justify-center items-center text-lg">
                        <i class="fas fa-copy mr-3 text-xl"></i> COPY SSCONF LINK
                    </button>

                    <div class="bg-indigo-50 p-5 rounded-xl mb-6 border border-indigo-100">
                        <p class="mb-2 text-sm text-gray-600 uppercase font-bold tracking-wider">Data Usage</p>
                        <div class="flex justify-between items-end mb-2">
                            <span class="text-2xl font-black text-indigo-700">${user.usedGB} <span class="text-base text-indigo-500 font-medium">GB</span></span>
                            <span class="text-gray-500 font-medium">/ ${user.totalGB} GB</span>
                        </div>
                        <div class="w-full bg-indigo-200 rounded-full h-2">
                            <div class="bg-indigo-600 h-2 rounded-full" style="width: ${(user.usedGB / user.totalGB) * 100}%"></div>
                        </div>
                    </div>

                    <form action="/panel/change-server" method="POST" class="bg-gray-50 p-5 rounded-xl border border-gray-100">
                        <input type="hidden" name="token" value="${token}">
                        <label class="block text-sm font-bold text-gray-700 mb-2">Change Location</label>
                        <select name="newServer" class="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                            ${dropdownOptions}
                        </select>
                        <button type="submit" class="w-full bg-gray-800 hover:bg-black text-white font-bold py-3 rounded-lg shadow transition">
                            Switch Server
                        </button>
                    </form>
                </div>

                <script>
                    function copyLink(link) {
                        navigator.clipboard.writeText(link).then(() => {
                            const btn = document.querySelector('button');
                            const originalHtml = btn.innerHTML;
                            btn.innerHTML = '<i class="fas fa-check-circle mr-3 text-xl"></i> LINK COPIED!';
                            btn.classList.replace('bg-green-500', 'bg-teal-600');
                            setTimeout(() => {
                                btn.innerHTML = originalHtml;
                                btn.classList.replace('bg-teal-600', 'bg-green-500');
                            }, 3000);
                        }).catch(err => {
                            alert("Failed to copy link.");
                        });
                    }
                </script>
            </body></html>
        `);
    } catch (error) { res.status(500).send("System Error"); }
});

userApp.post('/panel/change-server', async (req, res) => {
    const { token, newServer } = req.body;
    try {
        await axios.post(`http://127.0.0.1:${process.env.ADMIN_PORT}/api/internal/change-server`, { token, newServer }, { headers: { 'x-api-key': process.env.SECRET_API_KEY } });
        await redisClient.del(token);
        res.redirect('/panel/' + token);
    } catch (error) { res.status(500).send("Error changing server"); }
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
