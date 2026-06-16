import type { Guild, Prisma } from '@prisma/client';
import { prisma } from '../client.js';

export interface UpsertGuildInput {
  id: string;
  name: string;
  iconUrl?: string | null;
  memberCount?: number;
}

export const guildRepository = {
  async upsert(input: UpsertGuildInput): Promise<Guild> {
    return prisma.guild.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        name: input.name,
        iconUrl: input.iconUrl ?? null,
        memberCount: input.memberCount ?? 0,
      },
      update: {
        name: input.name,
        iconUrl: input.iconUrl ?? null,
        memberCount: input.memberCount ?? undefined,
      },
    });
  },

  async findById(id: string): Promise<Guild | null> {
    return prisma.guild.findUnique({ where: { id } });
  },

  async listActive(): Promise<Guild[]> {
    return prisma.guild.findMany({
      where: { leftAt: null },
      orderBy: { name: 'asc' },
    });
  },

  async listByIds(ids: string[]): Promise<Guild[]> {
    if (ids.length === 0) return [];
    return prisma.guild.findMany({ where: { id: { in: ids } } });
  },

  async markLeft(id: string): Promise<void> {
    await prisma.guild.update({
      where: { id },
      data: { leftAt: new Date() },
    });
  },

  async update(
    id: string,
    data: Prisma.GuildUpdateInput,
  ): Promise<Guild> {
    return prisma.guild.update({ where: { id }, data });
  },
};
