require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('./database'); // Connect to the database
const discordTranscripts = require('discord-html-transcripts');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();
const commandsArray = [];

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
    commandsArray.push(command.data.toJSON());
}

const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    client.on('interactionCreate', (...args) => event.execute(...args, client));
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    
    // Set the bot's status
    client.user.setActivity('HostMC tickets', { type: ActivityType.Watching });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commandsArray }
        );
        console.log('Successfully registered global slash commands.');
    } catch (error) {
        console.error(error);
    }

    // =======================================
    // AUTO-CLOSE TIMER ENGINE
    // =======================================
    setInterval(() => {
        db.all(`
            SELECT t.channelId, t.userId, t.createdAt, t.guildId, 
                   c.autoCloseTimer, c.transcriptChannelId, c.transcriptEnabled, c.deleteOnClose 
            FROM tickets t 
            JOIN guild_config c ON t.guildId = c.guildId 
            WHERE t.status = 'open' AND c.autoCloseTimer > 0
        `, async (err, tickets) => {
            if (err || !tickets) return;

            const now = Date.now();
            
            for (const ticket of tickets) {
                // Convert chosen hours into milliseconds
                const timerMs = ticket.autoCloseTimer * 60 * 60 * 1000;
                
                // If the current time minus creation time is greater than the limit, close it
                if (now - ticket.createdAt >= timerMs) {
                    try {
                        const guild = client.guilds.cache.get(ticket.guildId);
                        if (!guild) continue;
                        
                        const channel = guild.channels.cache.get(ticket.channelId) || await guild.channels.fetch(ticket.channelId).catch(() => null);
                        
                        // If channel doesn't exist anymore, just close it in DB
                        if (!channel) {
                            db.run(`UPDATE tickets SET status = 'closed' WHERE channelId = ?`, [ticket.channelId]);
                            continue;
                        }

                        let opener = await client.users.fetch(ticket.userId).catch(() => null);
                        const openerTag = opener ? opener.tag : 'Unknown User';
                        const openerUsername = opener ? opener.username : 'unknown';

                        // 1. Transcript Logic
                        if (ticket.transcriptEnabled && ticket.transcriptChannelId) {
                            const messages = await channel.messages.fetch({ limit: 100 });
                            const filteredMessages = messages.filter(msg => msg.author.id !== client.user.id);
                            
                            let textTranscript = `Auto-closed due to inactivity.\nOpened by ${openerTag}\n\n`;
                            filteredMessages.reverse().forEach(msg => { 
                                if (!msg.content) return;
                                const timestamp = msg.createdAt.toLocaleString('en-GB', { 
                                    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', 
                                    hour: 'numeric', minute: '2-digit', hour12: true 
                                }).toUpperCase();
                                textTranscript += `[${timestamp}] ${msg.author.tag}: ${msg.content}\n`; 
                            });
                            
                            const textFile = new AttachmentBuilder(Buffer.from(textTranscript, 'utf-8'), { name: `transcript-${openerUsername}.txt` });

                            const htmlString = await discordTranscripts.generateFromMessages(filteredMessages, channel, {
                                returnType: 'string', saveImages: true, poweredBy: false, footerText: 'Secure Support Transcript'
                            });
                            
                            const fileName = `transcript-${channel.id}.html`;
                            const dir = path.join(process.cwd(), 'transcripts');
                            if (!fs.existsSync(dir)) fs.mkdirSync(dir);
                            fs.writeFileSync(path.join(dir, fileName), htmlString);

                            const webUrl = `http://sg.hostmc.in:25568/transcripts/${fileName}`;
                            const logChannel = guild.channels.cache.get(ticket.transcriptChannelId);
                            
                            if (logChannel) {
                                await logChannel.send({ 
                                    content: `⏱️ **Auto-Closed** transcript for ticket opened by **${openerTag}**`,
                                    files: [textFile],
                                    components: [new ActionRowBuilder().addComponents(
                                        new ButtonBuilder().setLabel('See in Web').setStyle(ButtonStyle.Link).setURL(webUrl)
                                    )]
                                });
                            }
                        }

                        // 2. Closure Logic
                        db.run(`UPDATE tickets SET status = 'closed' WHERE channelId = ?`, [channel.id]);

                        if (ticket.deleteOnClose) {
                            const parentCategory = channel.parent;
                            await channel.delete().catch(() => {});
                            if (parentCategory && parentCategory.children.cache.size <= 0) {
                                await parentCategory.delete().catch(() => {});
                            }
                        } else {
                            await channel.permissionOverwrites.edit(ticket.userId, { ViewChannel: false }).catch(() => {});
                            await channel.send('⏱️ *Ticket has been automatically archived due to inactivity.*');
                        }
                    } catch (err) {
                        console.error(`Failed to auto-close ticket ${ticket.channelId}:`, err);
                    }
                }
            }
        });
    }, 60 * 1000); // Loop checks every 60 seconds
});

client.login(process.env.DISCORD_TOKEN);

// =======================================
// WEB VIEWER SERVER FOR TRANSCRIPTS
// =======================================
const app = express();
const PORT = process.env.PORT || 25568; 

if (!fs.existsSync('./transcripts')) fs.mkdirSync('./transcripts');
app.use('/transcripts', express.static('transcripts'));

app.listen(PORT, () => console.log(`🌐 Web viewer active on port ${PORT}`));