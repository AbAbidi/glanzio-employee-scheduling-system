export type EmployeeStatus =
  | "INVITED"
  | "ACTIVE"
  | "INACTIVE";

export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  hourlyRate: string | null;
  isStudent: boolean;
  active: boolean;
  user: {
    email: string;
    status: EmployeeStatus;
    lastLoginAt: string | null;
  };
};

export type EmployeeListResponse = {
  items: Employee[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};
export type CreateEmployeeInput = {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  hourlyRate?: number;
  isStudent: boolean;
};

export type InvitationDelivery = {
  expiresAt: string;
  developmentInvitationUrl?: string;
};

export type CreateEmployeeResponse = {
  employee: Employee;
  invitation: InvitationDelivery;
};

export type CompletedEmployeeAssignment = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  siteName: string;
  clientName: string;
  durationMinutes: number;
  agreedHourlyRate: string | null;
  cost: number;
};

export type EmployeeAnalytics = {
  employee: Employee;
  metrics: {
    completedAssignments: number;
    completedMinutes: number;
    currentMonthMinutes: number;
    scheduledMinutes: number;
    totalCost: number;
  };
  completedAssignments: CompletedEmployeeAssignment[];
};
