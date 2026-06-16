import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { DiscordPermission } from '@bot/shared';
import type { CommandModule } from '../../types/modules.js';
import { moderationService } from '../../services/moderation.service.js';
import { replyError, replySuccess } from '../../services/interaction-response.js';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('The user to ban').setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription('Reason for the ban (recorded in the audit log)')
        .setRequired(true)
        .setMaxLength(512),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('delete_days')
        .setDescription('How many days of the user’s messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  dmEnabled: false,
  requiredPermissions: [DiscordPermission.BAN_MEMBERS],
  meta: { category: 'moderation' },
  async execute(interaction) {
    if (!interaction.guildId || !interaction.guild) {
      await replyError(interaction, 'Guild only', 'This command can only be used in a server.');
      return;
    }
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

    const issuerPerms = (interaction.member as { permissions?: { bitfield?: bigint | string | number } })
      .permissions;
    const botPerms = interaction.guild.members.me?.permissions;

    try {
      const { reason: cleanReason, deleteMessageSeconds } = moderationService.authorizeBan(
        {
          guildId: interaction.guildId,
          userId: target.id,
          issuerId: interaction.user.id,
          reason,
          deleteMessageSeconds: deleteDays * 24 * 60 * 60,
        },
        {
          issuerPermissions: BigInt(issuerPerms?.bitfield ?? 0),
          botPermissions: BigInt(botPerms?.bitfield ?? 0),
        },
      );

      if (!botPerms?.has(PermissionFlagsBits.BanMembers)) {
        await replyError(
          interaction,
          'Missing permission',
          'I do not have the Ban Members permission in this server.',
        );
        return;
      }

      await interaction.guild.members.ban(target.id, {
        reason: cleanReason,
        deleteMessageSeconds,
      });
      await moderationService.recordBan({
        guildId: interaction.guildId,
        userId: target.id,
        issuerId: interaction.user.id,
        reason: cleanReason,
        deleteMessageSeconds,
      });
      await replySuccess(
        interaction,
        'User banned',
        `Banned **${target.tag}** — ${cleanReason}`,
      );
    } catch (err) {
      throw err;
    }
  },
};

export default command;
