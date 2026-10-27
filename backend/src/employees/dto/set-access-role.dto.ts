import { IsIn } from 'class-validator';
import { UserRole } from '../../generated/prisma/client';

export class SetAccessRoleDto {
  @IsIn([UserRole.EMPLOYEE, UserRole.MANAGER])
  role!: 'EMPLOYEE' | 'MANAGER';
}
