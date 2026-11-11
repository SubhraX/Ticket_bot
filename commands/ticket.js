const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Deploys the public ticket creation panel in the current channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${interaction.guild.name} Support Center`, iconURL: interaction.guild.iconURL({ dynamic: true }) })
            .setTitle('How can we help you today?')
            .setDescription('Please select the appropriate category from the dropdown menu below to open a private ticket. \n\n>>> 💬 **General Support**\nGeneral questions and inquiries\n\n💳 **Billing Support**\nPayment and subscription issues\n\n🔧 **Technical Report**\nBug reports and technical help')
            .setColor('#F58727')
            .setFooter({ text: 'Abuse of the ticket system may result in a ban.', iconURL: interaction.client.user.displayAvatarURL() });

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('open_ticket_category')
                .setPlaceholder('Select a support category...')
                .addOptions([
                    { label: 'General Support', value: 'general', emoji: '💬', description: 'General questions and inquiries' },
                    { label: 'Billing Support', value: 'billing', emoji: '💳', description: 'Payment and subscription issues' },
                    { label: 'Technical Report', value: 'technical', emoji: '🔧', description: 'Bug reports and technical help' }
                ])
        );

        await interaction.channel.send({ embeds: [embed], components: [selectMenu] });
        
        await interaction.editReply({ content: '✅ Professional ticket panel successfully deployed!' });
    }
};