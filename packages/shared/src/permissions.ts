import { DiscordPermission } from './discord.js';

/**
 * Check whether a bitfield of Discord permissions contains the given permission.
 * ADMINISTRATOR always grants every permission.
 */
export function hasPermission(
  permissionBits: string | number | bigint | null | undefined,
  permission: bigint,
): boolean {
  if (permissionBits == null) return false;
  let bits: bigint;
  try {
    bits = BigInt(permissionBits);
  } catch {
    return false;
  }
  if ((bits & DiscordPermission.ADMINISTRATOR) !== 0n) return true;
  return (bits & permission) === permission;
}

export function hasAllPermissions(
  permissionBits: string | number | bigint | null | undefined,
  permissions: bigint[],
): boolean {
  return permissions.every((p) => hasPermission(permissionBits, p));
}

export function hasAnyPermission(
  permissionBits: string | number | bigint | null | undefined,
  permissions: bigint[],
): boolean {
  return permissions.some((p) => hasPermission(permissionBits, p));
}

/**
 * The set of permissions a dashboard user must have on a guild to manage it
 * through the web UI. We require either MANAGE_GUILD or ADMINISTRATOR.
 */
export const DASHBOARD_REQUIRED_PERMISSIONS: bigint[] = [
  DiscordPermission.MANAGE_GUILD,
];

export function canManageGuild(permissionBits: string | number | bigint | null | undefined): boolean {
  return hasAnyPermission(permissionBits, DASHBOARD_REQUIRED_PERMISSIONS);
}
