import type { Warning } from '@prisma/client';
import { prisma } from '../client.js';

export interface CreateWarningInput {
  guildId: string;
  userId: string;
  issuerId: string;
  reason: string;
  severity?: number;
}

export const warningRepository = {
  async create(input: CreateWarningInput): Promise<Warning> {
    return prisma.warning.create({
      data: {
        guildId: input.guildId,
        userId: input.userId,
        issuerId: input.issuerId,
        reason: input.reason,
        severity: input.severity ?? 0,
      },
    });
  },

  async listForUser(guildId: string, userId: string): Promise<Warning[]> {
    return prisma.warning.findMany({
      where: { guildId, userId, rescindedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  },

  async listForGuild(guildId: string, limit = 50): Promise<Warning[]> {
    return prisma.warning.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async countForUser(guildId: string, userId: string): Promise<number> {
    return prisma.warning.count({
      where: { guildId, userId, rescindedAt: null },
    });
  },

  async rescind(id: string, by: string): Promise<Warning> {
    return prisma.warning.update({
      where: { id },
      data: { rescindedAt: new Date(), rescindedBy: by },
    });
  },
};
