import { SlashCommandBuilder, type Client } from 'discord.js';
import { TOKENS } from '../../core/symbols.js';
import type { CommandModule } from '../../types/modules.js';
import { botStatsService } from '../../services/bot-stats.service.js';
import { replyInfo } from '../../services/interaction-response.js';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot latency and uptime'),
  cooldown: 5,
  meta: { category: 'utility' },
  async execute(interaction, ctx) {
    const client = ctx.container.get<Client>(TOKENS.Client);
    const stats = botStatsService.collect(
      client,
      ctx.container.config().NODE_ENV === 'production' ? 'prod' : 'dev',
    );
    await interaction.editReply({ content: 'Pong!' });
    const roundtrip = Date.now() - interaction.createdTimestamp;
    await replyInfo(
      interaction,
      'Pong!',
      `Roundtrip: **${roundtrip}ms** • WebSocket: **${stats.latencyMs}ms** • Uptime: **${stats.uptimeSeconds}s**`,
    );
  },
};

export default command;
