import type { EcoVadisSupplier, EcoVadisSupplierScore } from "../oauth";

export const mockSuppliers: EcoVadisSupplier[] = [
  {
    id: "ecovadis-1",
    businessName: "Acme Manufacturing",
    email: "sourcing@acme.com",
    externalId: "acme-ext-123",
    assessmentDate: "2024-01-15",
  },
  {
    id: "ecovadis-2",
    businessName: "Beta Logistics",
    email: "contact@beta.com",
    externalId: "beta-ext-456",
    assessmentDate: "2024-01-10",
  },
  {
    id: "ecovadis-3",
    businessName: "Gamma Chemicals",
    email: "sales@gamma.com",
    assessmentDate: "2023-12-20",
  },
  {
    id: "ecovadis-4",
    businessName: "Delta Electronics",
    email: "purchasing@delta.com",
    externalId: "delta-ext-789",
    assessmentDate: "2024-01-05",
  },
];

export const mockSupplierScores: Record<string, EcoVadisSupplierScore> = {
  "ecovadis-1": {
    supplierId: "ecovadis-1",
    score: 78,
    assessmentDate: "2024-01-15",
    trend: "improving",
    categories: {
      environment: 85,
      labor: 72,
      ethics: 80,
      procurement: 75,
    },
  },
  "ecovadis-2": {
    supplierId: "ecovadis-2",
    score: 52,
    assessmentDate: "2024-01-10",
    trend: "stable",
    categories: {
      environment: 48,
      labor: 55,
      ethics: 50,
      procurement: 52,
    },
  },
  "ecovadis-3": {
    supplierId: "ecovadis-3",
    score: 35,
    assessmentDate: "2023-12-20",
    trend: "declining",
    categories: {
      environment: 30,
      labor: 38,
      ethics: 32,
      procurement: 38,
    },
  },
  "ecovadis-4": {
    supplierId: "ecovadis-4",
    score: 88,
    assessmentDate: "2024-01-05",
    trend: "improving",
    categories: {
      environment: 90,
      labor: 85,
      ethics: 88,
      procurement: 87,
    },
  },
};

export const mockOAuthToken = {
  accessToken: "mock-access-token-123",
  refreshToken: "mock-refresh-token-456",
  expiresAt: new Date(Date.now() + 3600 * 1000),
};

export const mockOAuthResponse = {
  access_token: "mock-access-token-123",
  refresh_token: "mock-refresh-token-456",
  expires_in: 3600,
};

export const mockSuppliersResponse = {
  suppliers: mockSuppliers,
  total: mockSuppliers.length,
  page: 0,
};
