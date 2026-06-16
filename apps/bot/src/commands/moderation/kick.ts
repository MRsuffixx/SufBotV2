import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { DiscordPermission } from '@bot/shared';
import type { CommandModule } from '../../types/modules.js';
import { moderationService } from '../../services/moderation.service.js';
import { replyError, replySuccess } from '../../services/interaction-response.js';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('The user to kick').setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription('Reason for the kick (recorded in the audit log)')
        .setRequired(true)
        .setMaxLength(512),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  dmEnabled: false,
  requiredPermissions: [DiscordPermission.KICK_MEMBERS],
  meta: { category: 'moderation' },
  async execute(interaction, ctx) {
    if (!interaction.guildId || !interaction.guild) {
      await replyError(interaction, 'Guild only', 'This command can only be used in a server.');
      return;
    }
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);

    const issuerPerms = (interaction.member as { permissions?: { bitfield?: bigint | string | number } })
      .permissions;
    const botPerms = interaction.guild.members.me?.permissions;

    try {
      const { reason: cleanReason } = moderationService.authorizeKick(
        {
          guildId: interaction.guildId,
          userId: target.id,
          issuerId: interaction.user.id,
          reason,
        },
        {
          issuerPermissions: BigInt(issuerPerms?.bitfield ?? 0),
        },
      );

      if (!botPerms?.has(PermissionFlagsBits.KickMembers)) {
        await replyError(
          interaction,
          'Missing permission',
          'I do not have the Kick Members permission in this server.',
        );
        return;
      }

      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        await replyError(interaction, 'Not in server', 'That user is not a member of this server.');
        return;
      }
      if (!member.kickable) {
        await replyError(
          interaction,
          'Cannot kick',
          'I cannot kick this user (role hierarchy or owner).',
        );
        return;
      }

      await member.kick(cleanReason);
      await moderationService.recordKick({
        guildId: interaction.guildId,
        userId: target.id,
        issuerId: interaction.user.id,
        reason: cleanReason,
      });
      await replySuccess(
        interaction,
        'User kicked',
        `Kicked **${target.tag}** — ${cleanReason}`,
      );
    } catch (err) {
      throw err; // handled by the dispatcher error handler
    }
    void ctx;
  },
};

export default command;
