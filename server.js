require('dotenv').config();
const express = require('express');
require('./config/db')();

const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

const adminApp = express();
const userApp = express();

adminApp.use(express.json());
adminApp.use(express.urlencoded({ extended: true }));
userApp.use(express.json());
userApp.use(express.urlencoded({ extended: true }));

adminApp.use('/admin', adminRoutes);
adminApp.use('/api/internal', adminRoutes);
userApp.use('/', userRoutes);

adminApp.listen(process.env.ADMIN_PORT, () => console.log(`🚀 Admin Dashboard: http://${process.env.VPS_IP}:${process.env.ADMIN_PORT}/admin`));
userApp.listen(process.env.USER_PORT, () => console.log(`🚀 User Panel     : http://${process.env.VPS_IP}:${process.env.USER_PORT}/panel/nyeSkpYVgoPSe3suIRtys8Lhl09xDohZ`));
