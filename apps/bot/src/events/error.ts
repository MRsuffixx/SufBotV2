import { Events } from 'discord.js';
import type { EventModule } from '../types/modules.js';

export const event: EventModule = {
  name: Events.Error,
  execute(err: unknown) {
    // eslint-disable-next-line no-console
    console.error('[discord error]', err);
  },
};

export default event;
