const express = require('express');
const mongoose = require('mongoose');
const app = express();
__path = process.cwd()
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;
let code = require('./pair'); 

require('events').EventEmitter.defaultMaxListeners = 500;

// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://navamitharushika61_db_user:7qEidJfJbrRK1dge@cluster0.usexkva.mongodb.net/myAppDB?retryWrites=true&w=majority/SOLOMINI2424DEXTER?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ MongoDB Connected Successfully!');
}).catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
});

app.use('/code', code);
app.use('/pair', async (req, res, next) => {
    res.sendFile(__path + '/pair.html')
});
app.use('/', async (req, res, next) => {
    res.sendFile(__path + '/main.html')
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║     ZANTA-XMD MINI BOT - ONLINE           ║
║     MongoDB Connected ✓              ║
║     Server: http://localhost:${PORT}    ║
╚══════════════════════════════════════╝
    `)
});

module.exports = app;