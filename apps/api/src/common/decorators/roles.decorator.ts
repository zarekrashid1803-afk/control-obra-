import { SetMetadata } from '@nestjs/common';
import type { Rol } from '@control-obra/shared';

export const ROLES_KEY = 'roles';
export const RequireRoles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
