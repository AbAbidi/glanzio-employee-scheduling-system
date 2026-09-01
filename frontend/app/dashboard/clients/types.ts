export type Client = {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClientListItem = Client & {
  _count: {
    sites: number;
  };
};

export type ClientListResponse = {
  items: ClientListItem[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export type CreateClientInput = {
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

export type ClientSite = {
  id: string;
  name: string;
  addressLine1: string;
  city: string;
  countryCode: string;
  active: boolean;
  _count: { assignments: number };
};

export type ClientAssignment = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: "DRAFT" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
  travelDistanceMeters: number | null;
  clientCharge: string | null;
  site: { id: string; name: string; city: string };
  employees: Array<{
    employee: { id: string; firstName: string; lastName: string };
  }>;
};

export type ClientOverview = {
  client: Client & {
    sites: ClientSite[];
    _count: { sites: number };
  };
  assignments: ClientAssignment[];
};
