import { ChannelType, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { CommandModule } from '../../types/modules.js';
import { replyError } from '../../services/interaction-response.js';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display information about the current server'),
  dmEnabled: false,
  meta: { category: 'utility' },
  async execute(interaction) {
    if (!interaction.guild) {
      await replyError(interaction, 'Guild only', 'This command can only be used in a server.');
      return;
    }
    const guild = interaction.guild;
    await guild.fetch();
    const owner = await guild.fetchOwner().catch(() => null);
    const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
    const roles = guild.roles.cache.size;
    const createdAt = guild.createdAt;
    const createdUnix = Math.floor(createdAt.getTime() / 1000);

    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle(`📊 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
      .addFields(
        { name: 'Server ID', value: guild.id, inline: true },
        { name: 'Owner', value: owner ? `<@${owner.id}>` : 'Unknown', inline: true },
        { name: 'Members', value: `${guild.memberCount ?? 0}`, inline: true },
        { name: 'Text channels', value: `${textChannels}`, inline: true },
        { name: 'Voice channels', value: `${voiceChannels}`, inline: true },
        { name: 'Roles', value: `${roles}`, inline: true },
        { name: 'Created', value: `<t:${createdUnix}:R>`, inline: true },
        { name: 'Verification', value: `${guild.verificationLevel}`, inline: true },
        { name: 'Boost tier', value: `${guild.premiumTier}`, inline: true },
      )
      .setTimestamp(new Date());

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
    // Avoid double reply helper import; replyInfo not needed for embeds with
    // extra fields.  We use editReply directly above.
  },
};

export default command;
