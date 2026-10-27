import { UserRole } from '../../generated/prisma/client';

export type AuthenticatedUser = Readonly<{
  id: string;
  email: string | null;
  role: UserRole;
}>;
