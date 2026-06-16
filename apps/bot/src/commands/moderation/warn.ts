import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { DiscordPermission } from '@bot/shared';
import type { CommandModule } from '../../types/modules.js';
import { moderationService } from '../../services/moderation.service.js';
import { replyError, replySuccess } from '../../services/interaction-response.js';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a formal warning to a user')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('The user to warn').setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true)
        .setMaxLength(512),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('severity')
        .setDescription('Severity (0-5)')
        .setMinValue(0)
        .setMaxValue(5)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  dmEnabled: false,
  requiredPermissions: [DiscordPermission.MODERATE_MEMBERS],
  meta: { category: 'moderation' },
  async execute(interaction) {
    if (!interaction.guildId) {
      await replyError(interaction, 'Guild only', 'This command can only be used in a server.');
      return;
    }
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const severity = interaction.options.getInteger('severity') ?? 0;
    const issuerPerms = (interaction.member as { permissions?: { bitfield?: bigint | string | number } })
      .permissions;

    const warning = await moderationService.warn(
      {
        guildId: interaction.guildId,
        userId: target.id,
        issuerId: interaction.user.id,
        reason,
        severity,
      },
      { issuerPermissions: BigInt(issuerPerms?.bitfield ?? 0) },
    );
    const count = await moderationService.countWarnings(interaction.guildId, target.id);
    await replySuccess(
      interaction,
      'Warning issued',
      `Warned **${target.tag}** (id: \`${warning.id}\`). They now have **${count}** active warning(s).`,
    );
  },
};

export default command;
