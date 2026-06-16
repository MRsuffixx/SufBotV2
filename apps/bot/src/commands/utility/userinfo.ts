import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { CommandModule } from '../../types/modules.js';
import { replyError } from '../../services/interaction-response.js';

function formatDate(d: Date | null | undefined): string {
  if (!d) return 'Unknown';
  return `<t:${Math.floor(d.getTime() / 1000)}:R>`;
}

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display information about a user')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('The user to inspect').setRequired(false),
    ),
  meta: { category: 'utility' },
  async execute(interaction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const member = interaction.guild
      ? await interaction.guild.members.fetch(target.id).catch(() => null)
      : null;

    const created = formatDate(target.createdAt);
    const joined = formatDate(member?.joinedAt ?? null);
    const roles = member
      ? member.roles.cache
          .filter((r) => r.id !== interaction.guild?.id)
          .sort((a, b) => b.position - a.position)
          .map((r) => `<@&${r.id}>`)
          .slice(0, 20)
          .join(', ') || 'None'
      : 'N/A';

    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle(`👤 ${target.globalName ?? target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'User ID', value: target.id, inline: true },
        { name: 'Bot?', value: target.bot ? 'Yes' : 'No', inline: true },
        { name: 'Account created', value: created, inline: true },
        ...(member
          ? [
              { name: 'Joined server', value: joined, inline: true },
              { name: 'Nickname', value: member.nickname ?? 'None', inline: true },
              { name: 'Top roles', value: roles, inline: false },
            ]
          : []),
      )
      .setTimestamp(new Date());

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await replyError(interaction, 'Unexpected state', 'Reply was not deferred');
    }
  },
};

export default command;
