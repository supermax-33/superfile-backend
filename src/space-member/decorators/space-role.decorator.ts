import { applyDecorators, SetMetadata } from '@nestjs/common';
import { SpaceRole } from '@prisma/client';

export const SPACE_ROLE_METADATA = 'space-role:required';
export const SPACE_ROLE_CONTEXT_METADATA = 'space-role:context';

export type SpaceRoleContext =
  | { source: 'param'; key: string }
  | { source: 'body'; key: string }
  | { source: 'query'; key: string }
  | { source: 'file'; param: string }
  | { source: 'conversation'; param: string }
  | { source: 'reminder'; param: string };

export const RequireSpaceRole = (
  role: SpaceRole,
  context: SpaceRoleContext,
): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(SPACE_ROLE_METADATA, role),
    SetMetadata(SPACE_ROLE_CONTEXT_METADATA, context),
  );
