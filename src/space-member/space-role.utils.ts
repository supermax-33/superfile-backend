import { SpaceRole } from '@prisma/client';

const ROLE_PRIORITY: Record<SpaceRole, number> = {
  [SpaceRole.VIEWER]: 0,
  [SpaceRole.EDITOR]: 1,
  [SpaceRole.MANAGER]: 2,
  [SpaceRole.OWNER]: 3,
};

export const hasSufficientRole = (
  current: SpaceRole,
  required: SpaceRole,
): boolean => ROLE_PRIORITY[current] >= ROLE_PRIORITY[required];
