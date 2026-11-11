const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-tickets')
        .setDescription('Interactive dashboard to configure the ticket system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        db.get(`SELECT * FROM guild_config WHERE guildId = ?`, [interaction.guild.id], (err, config) => {
            if (!config) {
                db.run(`INSERT INTO guild_config (guildId) VALUES (?)`, [interaction.guild.id]);
                config = { staffRoleId: null, transcriptChannelId: null, deleteOnClose: 1, transcriptEnabled: 1, autoCloseTimer: 0 };
            }

            db.all(`SELECT status FROM tickets WHERE guildId = ?`, [interaction.guild.id], async (err, tickets = []) => {
                const openTickets = tickets.filter(t => t.status === 'open').length;
                const closedTickets = tickets.filter(t => t.status === 'closed').length;
                const totalTickets = tickets.length;

                const embed = new EmbedBuilder()
                    .setAuthor({ name: 'Ticket System Setup', iconURL: interaction.client.user.displayAvatarURL() })
                    .setTitle('⚙️ Dashboard Configuration')
                    .setDescription(`Welcome to the interactive setup panel.\nUse the dropdowns below to configure your preferences. **Changes are saved automatically.**\n\n📊 **Real-Time Statistics**\n> **Total Tickets:** \`${totalTickets}\`\n> **Open Tickets:** \`${openTickets}\`\n> **Closed Tickets:** \`${closedTickets}\`\n\n*Use \`/ticket\` in a public channel to deploy the menu.*`)
                    .setColor('#5865F2')
                    .setFooter({ text: `Guild ID: ${interaction.guild.id}` })
                    .setTimestamp();

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

                await interaction.reply({ 
                    embeds: [embed], 
                    components: [
                        new ActionRowBuilder().addComponents(roleMenu), 
                        new ActionRowBuilder().addComponents(timerMenu), 
                        new ActionRowBuilder().addComponents(channelMenu), 
                        buttonsRow
                    ], 
                    ephemeral: true 
                });
            });
        });
    }
};