export type SiteClient = {
  id: string;
  companyName: string;
  active: boolean;
};

export type CleaningSite = {
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
  createdAt: string;
  updatedAt: string;
  client: SiteClient;
};

export type SiteListResponse = {
  items: CleaningSite[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export type CreateSiteInput = {
  clientId: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode?: string;
  city: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
  estimatedDurationMinutes?: number;
  requiredEquipment: string[];
  notes?: string;
};