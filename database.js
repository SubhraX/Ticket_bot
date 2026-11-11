const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./tickets.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
        userId TEXT,
        channelId TEXT,
        status TEXT,
        guildId TEXT,
        createdAt INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS guild_config (
        guildId TEXT PRIMARY KEY,
        categoryId TEXT,
        staffRoleId TEXT,
        transcriptChannelId TEXT,
        deleteOnClose INTEGER DEFAULT 1,
        transcriptEnabled INTEGER DEFAULT 1,
        autoCloseTimer INTEGER DEFAULT 0
    )`);
});

module.exports = db;