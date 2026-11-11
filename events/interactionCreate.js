const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType, EmbedBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, AttachmentBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder } = require('discord.js');
const db = require('../database');
const discordTranscripts = require('discord-html-transcripts');
const fs = require('fs');
const path = require('path');

module.exports = {
    async execute(interaction, client) {
        
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            try { await command.execute(interaction); } 
            catch (error) { console.error(error); }
            return;
        }

        // =======================================
        // 1. SETUP DASHBOARD HELPER FUNCTIONS
        // =======================================
        const refreshDashboard = async (config, guildId, interactionMessage, statusMsg = null) => {
            if (!config) config = { staffRoleId: null, transcriptChannelId: null, deleteOnClose: 1, transcriptEnabled: 1, autoCloseTimer: 0 };

            return new Promise((resolve) => {
                db.all(`SELECT status FROM tickets WHERE guildId = ?`, [guildId], (err, tickets = []) => {
                    const openTickets = tickets.filter(t => t.status === 'open').length;
                    const closedTickets = tickets.filter(t => t.status === 'closed').length;
                    const totalTickets = tickets.length;

                    let description = `Welcome to the interactive setup panel.\nUse the dropdowns below to configure your preferences. **Changes are saved automatically.**\n\n📊 **Real-Time Statistics**\n> **Total Tickets:** \`${totalTickets}\`\n> **Open Tickets:** \`${openTickets}\`\n> **Closed Tickets:** \`${closedTickets}\`\n\n*Use \`/ticket\` in a public channel to deploy the menu.*`;
                    if (statusMsg) description += `\n\n🔔 **System Notice:**\n> ${statusMsg}`;

                    const embed = EmbedBuilder.from(interactionMessage.embeds[0]).setDescription(description);

                    const roleMenu = new RoleSelectMenuBuilder().setCustomId('setup_ping_role').setPlaceholder('Select the Support Staff Role');
                    if (config.staffRoleId) roleMenu.addDefaultRoles(config.staffRoleId);

                    const currentTimer = Number(config.autoCloseTimer) || 0;
                    const timerMenu = new StringSelectMenuBuilder().setCustomId('setup_timer_select').setPlaceholder('Select Auto-Close Timer')
                        .addOptions([
                            { label: 'Timer Disabled', value: '0', emoji: '🛑', default: currentTimer === 0 },
                            { label: '1 Hour', value: '1', emoji: '🕐', default: currentTimer === 1 },
                            { label: '12 Hours', value: '12', emoji: '🕛', default: currentTimer === 12 },
                            { label: '24 Hours', value: '24', emoji: '📆', default: currentTimer === 24 }
                        ]);

                    const channelMenu = new ChannelSelectMenuBuilder().setCustomId('setup_transcript_channel').setPlaceholder('Select Log Channel for Transcripts').setChannelTypes(ChannelType.GuildText);
                    if (config.transcriptChannelId) channelMenu.addDefaultChannels(config.transcriptChannelId);
                    
                    const buttonsRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('setup_toggle_transcript').setLabel(config.transcriptEnabled ? 'Transcript: ON' : 'Transcript: OFF').setEmoji('📝').setStyle(config.transcriptEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('setup_toggle_delete').setLabel(config.deleteOnClose ? 'Category Deletion: ON' : 'Category Deletion: OFF').setEmoji('📂').setStyle(config.deleteOnClose ? ButtonStyle.Success : ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('setup_wipe_db').setLabel('Wipe DB').setEmoji('⚠️').setStyle(ButtonStyle.Danger)
                    );

                    resolve({ embeds: [embed], components: [
                        new ActionRowBuilder().addComponents(roleMenu), 
                        new ActionRowBuilder().addComponents(timerMenu), 
                        new ActionRowBuilder().addComponents(channelMenu), 
                        buttonsRow
                    ]});
                });
            });
        };

        const clearNotice = (interaction) => {
            setTimeout(() => {
                db.get(`SELECT * FROM guild_config WHERE guildId = ?`, [interaction.guild.id], async (err, config) => {
                    try {
                        if (!config) config = { staffRoleId: null, transcriptChannelId: null, deleteOnClose: 1, transcriptEnabled: 1, autoCloseTimer: 0 };
                        const payload = await refreshDashboard(config, interaction.guild.id, interaction.message);
                        await interaction.editReply(payload).catch(() => {});
                    } catch (e) {}
                });
            }, 5000);
        };

        // =======================================
        // 2. DASHBOARD INTERACTION HANDLERS
        // =======================================
        if (interaction.isRoleSelectMenu() && interaction.customId === 'setup_ping_role') {
            const roleId = interaction.values[0];
            db.run(`INSERT OR IGNORE INTO guild_config (guildId) VALUES (?)`, [interaction.guild.id], () => {
                db.run(`UPDATE guild_config SET staffRoleId = ? WHERE guildId = ?`, [roleId, interaction.guild.id], () => {
                    db.get(`SELECT * FROM guild_config WHERE guildId = ?`, [interaction.guild.id], async (err, config) => {
                        await interaction.update(await refreshDashboard(config, interaction.guild.id, interaction.message));
                    });
                });
            });
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'setup_timer_select') {
            const hours = parseInt(interaction.values[0]);
            db.run(`INSERT OR IGNORE INTO guild_config (guildId) VALUES (?)`, [interaction.guild.id], () => {
                db.run(`UPDATE guild_config SET autoCloseTimer = ? WHERE guildId = ?`, [hours, interaction.guild.id], () => {
                    db.get(`SELECT * FROM guild_config WHERE guildId = ?`, [interaction.guild.id], async (err, config) => {
                        await interaction.update(await refreshDashboard(config, interaction.guild.id, interaction.message));
                    });
                });
            });
        }

        if (interaction.isChannelSelectMenu() && interaction.customId === 'setup_transcript_channel') {
            const channelId = interaction.values[0];
            db.run(`INSERT OR IGNORE INTO guild_config (guildId) VALUES (?)`, [interaction.guild.id], () => {
                db.run(`UPDATE guild_config SET transcriptChannelId = ? WHERE guildId = ?`, [channelId, interaction.guild.id], () => {
                    db.get(`SELECT * FROM guild_config WHERE guildId = ?`, [interaction.guild.id], async (err, config) => {
                        await interaction.update(await refreshDashboard(config, interaction.guild.id, interaction.message));
                    });
                });
            });
        }

        if (interaction.isButton() && ['setup_toggle_transcript', 'setup_toggle_delete'].includes(interaction.customId)) {
            const field = interaction.customId === 'setup_toggle_transcript' ? 'transcriptEnabled' : 'deleteOnClose';
            db.run(`INSERT OR IGNORE INTO guild_config (guildId) VALUES (?)`, [interaction.guild.id], () => {
                db.get(`SELECT ${field} FROM guild_config WHERE guildId = ?`, [interaction.guild.id], (err, row) => {
                    const newValue = row[field] ? 0 : 1;
                    db.run(`UPDATE guild_config SET ${field} = ? WHERE guildId = ?`, [newValue, interaction.guild.id], () => {
                        db.get(`SELECT * FROM guild_config WHERE guildId = ?`, [interaction.guild.id], async (err, config) => {
                            await interaction.update(await refreshDashboard(config, interaction.guild.id, interaction.message));
                        });
                    });
                });
            });
        }

        if (interaction.isButton() && interaction.customId === 'setup_wipe_db') {
            await interaction.deferUpdate();
            db.all(`SELECT channelId FROM tickets WHERE guildId = ?`, [interaction.guild.id], async (err, rows) => {
                if (rows && rows.length > 0) {
                    for (const row of rows) {
                        try {
                            const channel = interaction.guild.channels.cache.get(row.channelId) || await interaction.guild.channels.fetch(row.channelId).catch(() => null);
                            if (channel) await channel.delete().catch(() => {});
                        } catch (e) {}
                    }
                }
                db.run(`DELETE FROM tickets WHERE guildId = ?`, [interaction.guild.id], () => {
                    db.run(`DELETE FROM guild_config WHERE guildId = ?`, [interaction.guild.id], async () => {
                        const freshConfig = { staffRoleId: null, transcriptChannelId: null, deleteOnClose: 1, transcriptEnabled: 1, autoCloseTimer: 0 };
                        const payload = await refreshDashboard(freshConfig, interaction.guild.id, interaction.message, '✅ Database, configs, and active tickets wiped.');
                        await interaction.editReply(payload);
                        clearNotice(interaction);
                    });
                });
            });
        }

        // =======================================
        // 3. TICKET CREATION & HANDLING
        // =======================================
        if (interaction.isStringSelectMenu() && interaction.customId === 'open_ticket_category') {
            const selectedCategory = interaction.values[0];
            const modal = new ModalBuilder()
                .setCustomId(`ticket_form_${selectedCategory}`)
                .setTitle('Open a Ticket');
            
            const reasonInput = new TextInputBuilder()
                .setCustomId('ticket_reason')
                .setLabel('Please describe your issue briefly:')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);
            
            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal);

            const resetSelectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('open_ticket_category')
                    .setPlaceholder('Select a support category...')
                    .addOptions([
                        { label: 'General Support', value: 'general', emoji: '💬', description: 'General questions and inquiries' },
                        { label: 'Billing Support', value: 'billing', emoji: '💳', description: 'Payment and subscription issues' },
                        { label: 'Technical Report', value: 'technical', emoji: '🔧', description: 'Bug reports and technical help' }
                    ])
            );
            await interaction.message.edit({ components: [resetSelectMenu] }).catch(() => {});
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_form_')) {
            await interaction.deferReply({ ephemeral: true });

            const rawCategory = interaction.customId.replace('ticket_form_', '');
            const categoryMapping = {
                general: '💬 General Support',
                billing: '💳 Billing Support',
                technical: '🔧 Technical Report'
            };
            const categoryName = categoryMapping[rawCategory] || '🎟️ Support';
            const reason = interaction.fields.getTextInputValue('ticket_reason');
            
            db.get(`SELECT * FROM guild_config WHERE guildId = ?`, [interaction.guild.id], (err, config) => {
                if (!config || !config.staffRoleId) {
                    return interaction.editReply({ content: '⚠️ The ticket system has not been fully configured yet.' });
                }

                db.get(`SELECT * FROM tickets WHERE userId = ? AND status = 'open' AND guildId = ?`, [interaction.user.id, interaction.guild.id], async (err, row) => {
                    if (row) return interaction.editReply({ content: 'You already have an open ticket in this server!' });

                    try {
                        let parentCategory = interaction.guild.channels.cache.find(c => c.name === categoryName && c.type === ChannelType.GuildCategory);
                        
                        if (!parentCategory) {
                            parentCategory = await interaction.guild.channels.create({
                                name: categoryName,
                                type: ChannelType.GuildCategory,
                                permissionOverwrites: [
                                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                                    { id: config.staffRoleId, allow: [PermissionsBitField.Flags.ViewChannel] },
                                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
                                ]
                            });
                        }

                        const channel = await interaction.guild.channels.create({
                            name: `ticket_${interaction.user.username}`, 
                            type: ChannelType.GuildText,
                            parent: parentCategory.id, 
                            permissionOverwrites: [
                                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                                { id: config.staffRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                            ]
                        });

                        db.run(`INSERT INTO tickets (userId, channelId, status, guildId, createdAt) VALUES (?, ?, ?, ?, ?)`, 
                            [interaction.user.id, channel.id, 'open', interaction.guild.id, Date.now()]);

                        const ticketEmbed = new EmbedBuilder()
                            .setAuthor({ name: `${interaction.guild.name} Support`, iconURL: interaction.guild.iconURL() })
                            .setDescription(`Welcome <@${interaction.user.id}>!\n\nThank you for reaching out. A staff member will be with you shortly. Please provide any additional information or screenshots below while you wait.`)
                            .setColor('#FFBB00')
                            .addFields(
                                { name: '👤 Submitted By', value: `<@${interaction.user.id}>`, inline: true },
                                { name: '🏷️ Support Type', value: `\`${categoryName}\``, inline: true },
                                { name: '📄 Issue Description', value: `>>> ${reason}`, inline: false }
                            )
                            .setFooter({ text: `Ticket ID: ${channel.id}`, iconURL: client.user.displayAvatarURL() })
                            .setTimestamp();

                        const closeButton = new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒');

                        await channel.send({ 
                            content: `<@${interaction.user.id}> | <@&${config.staffRoleId}>`, 
                            embeds: [ticketEmbed], 
                            components: [new ActionRowBuilder().addComponents(closeButton)] 
                        });

                        await interaction.editReply({ content: `✅ Ticket created successfully: ${channel}` });
                    } catch (error) {
                        console.error(error);
                        await interaction.editReply({ content: 'Error creating channel or category. Check bot permissions.' });
                    }
                });
            });
        }

        if (interaction.isButton() && interaction.customId === 'close_ticket') {
            // NEW: Fetch the original creator's ID from the database before generating anything
            db.get(`SELECT userId FROM tickets WHERE channelId = ?`, [interaction.channel.id], async (err, ticketRow) => {
                
                // Fetch the Discord user object for the creator (fallback to whoever clicked if DB fails)
                let opener = interaction.user; 
                if (ticketRow && ticketRow.userId) {
                    opener = await client.users.fetch(ticketRow.userId).catch(() => interaction.user);
                }

                db.get(`SELECT * FROM guild_config WHERE guildId = ?`, [interaction.guild.id], async (err, config) => {
                    await interaction.reply('Locking and saving ticket data...');

                    if (config.transcriptEnabled && config.transcriptChannelId) {
                        try {
                            const messages = await interaction.channel.messages.fetch({ limit: 100 });
                            const filteredMessages = messages.filter(msg => msg.author.id !== client.user.id);
                            
                            // 1. Generate text transcript (Now uses opener.tag)
                            let textTranscript = `Opened by ${opener.tag}\n\n`;
                            filteredMessages.reverse().forEach(msg => { 
                                if (!msg.content) return;
                                const timestamp = msg.createdAt.toLocaleString('en-GB', { 
                                    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', 
                                    hour: 'numeric', minute: '2-digit', hour12: true 
                                }).toUpperCase();
                                textTranscript += `[${timestamp}] ${msg.author.tag}: ${msg.content}\n`; 
                            });
                            
                            // File uses opener.username
                            const textFile = new AttachmentBuilder(Buffer.from(textTranscript, 'utf-8'), { name: `transcript-${opener.username}.txt` });

                            // 2. Generate HTML web-viewer as a raw string
                            const htmlString = await discordTranscripts.generateFromMessages(filteredMessages, interaction.channel, {
                                returnType: 'string',
                                saveImages: true, 
                                poweredBy: false, 
                                footerText: 'Secure Support Transcript'
                            });
                            
                            // 3. Save the HTML file to the bot's local folder
                            const dir = path.join(process.cwd(), 'transcripts');
                            if (!fs.existsSync(dir)) fs.mkdirSync(dir);
                            
                            const fileName = `transcript-${interaction.channel.id}.html`;
                            fs.writeFileSync(path.join(dir, fileName), htmlString);

                            // 4. Generate your custom self-hosted URL
                            const hostIp = 'sg.hostmc.in'; 
                            const hostPort = '25568';      
                            const webUrl = `http://${hostIp}:${hostPort}/transcripts/${fileName}`;
                            
                            const logChannel = interaction.guild.channels.cache.get(config.transcriptChannelId);
                            
                            if (logChannel) {
                                // Create the button FIRST
                                const webButton = new ButtonBuilder()
                                    .setLabel('See in Web')
                                    .setStyle(ButtonStyle.Link)
                                    .setURL(webUrl);

                                // Send the text, file, and button all together in one go
                                await logChannel.send({ 
                                    content: `Transcript for ticket opened by **${opener.tag}**`,
                                    files: [textFile],
                                    components: [new ActionRowBuilder().addComponents(webButton)]
                                });
                            }
                        } catch (err) {
                            console.error("Failed to generate transcripts:", err);
                        }
                    }

                    db.run(`UPDATE tickets SET status = 'closed' WHERE channelId = ?`, [interaction.channel.id]);

                    if (config.deleteOnClose) {
                        const parentCategory = interaction.channel.parent;
                        const isLastChannel = parentCategory && parentCategory.children.cache.size <= 1;

                        setTimeout(async () => {
                            await interaction.channel.delete().catch(() => {});
                            if (isLastChannel) await parentCategory.delete().catch(() => {});
                        }, 4000);
                    } else {
                        // NEW: Lock the channel for the original creator, not the staff member
                        await interaction.channel.permissionOverwrites.edit(opener.id, { ViewChannel: false }).catch(() => {});
                        await interaction.followUp('Ticket has been archived and locked.');
                    }
                });
            });
        }
    }
};