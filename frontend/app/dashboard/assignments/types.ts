export type AssignmentStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED";

export type AssignmentSite = {
  id: string;
  clientId: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string | null;
  city: string;
  countryCode: string;
  latitude: string | null;
  longitude: string | null;
  estimatedDurationMinutes: number | null;
  requiredEquipment: string[];
  notes: string | null;
  active: boolean;
  client: {
    id: string;
    companyName: string;
    active: boolean;
  };
};

export type AssignedEmployee = {
  assignmentId: string;
  employeeId: string;
  assignedAt: string;
  agreedHourlyRate: string | null;
  rateOverridden: boolean;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    hourlyRate: string | null;
    isStudent: boolean;
    active: boolean;
    user: {
      id: string;
      email: string;
      status: "INVITED" | "ACTIVE" | "INACTIVE";
    };
  };
};

export type WorkAssignment = {
  id: string;
  siteId: string;
  recurringTemplateId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  status: AssignmentStatus;
  notes: string | null;
  cancellationReason: string | null;
  departureAddress: string | null;
  departureLatitude: string | null;
  departureLongitude: string | null;
  travelDistanceMeters: number | null;
  estimatedTravelMinutes: number | null;
  clientCharge: string | null;
  routeCalculatedAt: string | null;
  createdById: string;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  recurringTemplate: {
    id: string;
    frequency: "DAILY" | "WEEKLY" | "MONTHLY";
    interval: number;
    daysOfWeek: number[];
    untilAt: string | null;
    active: boolean;
  } | null;
  site: AssignmentSite;
  employees: AssignedEmployee[];
};

export type AssignmentListResponse = {
  items: WorkAssignment[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export type AssignmentEmployeeInput = {
  employeeId: string;
  hourlyRate?: number;
};

export type TravelSnapshotInput = {
  departureAddress?: string;
  departureLatitude?: number;
  departureLongitude?: number;
  travelDistanceMeters?: number;
  estimatedTravelMinutes?: number;
};

export type CreateAssignmentInput = TravelSnapshotInput & {
  siteId: string;
  title: string;
  startAt: string;
  endAt: string;
  status?: AssignmentStatus;
  notes?: string;
  employees: AssignmentEmployeeInput[];
  clientCharge: number;
};

export type CreateRecurringAssignmentInput = TravelSnapshotInput & {
  siteId: string;
  title: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  daysOfWeek: number[];
  firstStartAt: string;
  durationMinutes: number;
  untilAt?: string;
  occurrenceCount?: number;
  notes?: string;
  employees: AssignmentEmployeeInput[];
  clientCharge: number;
};

export type StudentHourWarning = {
  employeeId: string;
  employeeName: string;
  month: string;
  plannedMinutes: number;
  limitMinutes: number;
  exceededByMinutes: number;
  assignmentAllowed: boolean;
};

export type CreateAssignmentResponse = {
  assignment: WorkAssignment;
  studentWarnings: StudentHourWarning[];
};

export type UpdateAssignmentResponse = CreateAssignmentResponse;

export type RecurringAssignmentResponse = {
  id: string;
  generatedAssignmentCount: number;
  assignments: Array<{
    id: string;
    startAt: string;
    endAt: string;
  }>;
};

export type RoutePreview = {
  originAddress: string;
  originLatitude: number;
  originLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  travelDistanceMeters: number;
  estimatedTravelMinutes: number;
  routeGeometry: Array<{
    latitude: number;
    longitude: number;
  }>;
  calculatedAt: string;
};

export type MapLocation = {
  latitude: number;
  longitude: number;
  displayName: string;
  siteName: string;
  addressLine1: string;
  city: string;
  countryCode: string;
};
