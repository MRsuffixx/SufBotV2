import type { User } from '@prisma/client';
import { prisma } from '../client.js';

export interface UpsertUserInput {
  id: string;
  username: string;
  discriminator?: string | null;
  globalName?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}

export const userRepository = {
  async upsert(input: UpsertUserInput): Promise<User> {
    return prisma.user.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        username: input.username,
        discriminator: input.discriminator ?? null,
        globalName: input.globalName ?? null,
        avatarUrl: input.avatarUrl ?? null,
        email: input.email ?? null,
      },
      update: {
        username: input.username,
        discriminator: input.discriminator ?? null,
        globalName: input.globalName ?? null,
        avatarUrl: input.avatarUrl ?? null,
        // Email is intentionally not updated on every refresh — it would be
        // unusual for it to change and could be used as a re-identification
        // vector.  Update it explicitly via a dedicated method if needed.
      },
    });
  },

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  async deleteById(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  },
};
