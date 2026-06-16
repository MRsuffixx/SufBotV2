import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
  MessageFlags,
} from 'discord.js';

type ColourByTone = 'info' | 'success' | 'warning' | 'error';

const COLOURS: Record<ColourByTone, number> = {
  info: 0x3b82f6,
  success: 0x22c55e,
  warning: 0xf59e0b,
  error: 0xef4444,
};

const EMOJI: Record<ColourByTone, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '⛔',
};

/**
 * Standardised embed builder used by every command for consistent UX.
 */
export function buildEmbed(
  tone: ColourByTone,
  title: string,
  description?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(COLOURS[tone]).setTitle(`${EMOJI[tone]} ${title}`);
  if (description) embed.setDescription(description);
  embed.setTimestamp(new Date());
  return embed;
}

/**
 * Reply to a slash command interaction with an embed.  Handles the
 * "already replied" case gracefully.
 */
export async function replyEmbed(
  interaction: ChatInputCommandInteraction,
  tone: ColourByTone,
  title: string,
  description?: string,
): Promise<void> {
  const embed = buildEmbed(tone, title, description);
  const payload: InteractionReplyOptions = { embeds: [embed], flags: MessageFlags.Ephemeral };
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}

export async function replySuccess(
  interaction: ChatInputCommandInteraction,
  title: string,
  description?: string,
): Promise<void> {
  await replyEmbed(interaction, 'success', title, description);
}

export async function replyError(
  interaction: ChatInputCommandInteraction,
  title: string,
  description?: string,
): Promise<void> {
  await replyEmbed(interaction, 'error', title, description);
}

export async function replyWarning(
  interaction: ChatInputCommandInteraction,
  title: string,
  description?: string,
): Promise<void> {
  await replyEmbed(interaction, 'warning', title, description);
}

export async function replyInfo(
  interaction: ChatInputCommandInteraction,
  title: string,
  description?: string,
): Promise<void> {
  await replyEmbed(interaction, 'info', title, description);
}
