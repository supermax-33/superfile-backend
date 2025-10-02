import { SetMetadata } from '@nestjs/common';
import { SpaceRole } from '@prisma/client';

export const SPACE_ROLE_METADATA_KEY = 'space_role_metadata';

export type SpaceRoleContextOptions = {
  spaceIdParam?: string;
  spaceIdQuery?: string;
  spaceIdBodyField?: string;
  fileIdParam?: string;
  conversationIdParam?: string;
  reminderIdParam?: string;
};

export type SpaceRoleMetadata = {
  role: SpaceRole;
  options?: SpaceRoleContextOptions;
};

export const RequireSpaceRole = (
  role: SpaceRole,
  options?: SpaceRoleContextOptions,
): MethodDecorator & ClassDecorator =>
  SetMetadata(SPACE_ROLE_METADATA_KEY, { role, options });
