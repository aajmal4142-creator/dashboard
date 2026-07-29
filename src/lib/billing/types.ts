export type PlanName = "starter" | "professional" | "enterprise" | "trial";
export type BillingCycle = "monthly" | "annual";
export type SubscriptionStatus =
  "active" | "trialing" | "past_due" | "canceled" | "suspended";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "failed" | "refunded";
export type PaymentStatus = "success" | "pending" | "failed" | "refunded";
export type PaymentMethod = "stripe" | "wire" | "check" | "other";

export interface Plan {
  id: string;
  name: PlanName;
  displayName: string;
  monthlyPrice: number;
  annualPrice: number;
  dataPointsPerMonth: number;
  reportsPerMonth: number;
  storageGB: number;
  activeUsersLimit: number;
  features: Array<{ name: string }>;
  overageRatePerUnit: number;
  trialDays?: number;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  organisation: string;
  plan: string | Plan;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date;
  cancelledAt?: Date;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  seats: number;
  autoRenew: boolean;
  sendInvoices?: boolean;
  contactEmail?: string;
  sendUsageAlerts?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageMetric {
  id: string;
  subscription: string;
  organisation: string;
  date: Date;
  dataPointsCreated: number;
  dataPointsCumulative: number;
  reportsPublished: number;
  reportsCumulative: number;
  apiCallsCount: number;
  storageUsedGB: number;
  activeUsersCount: number;
  createdAt: Date;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface OverageCharge {
  metric: string;
  units: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  subscription: string;
  organisation: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  periodStart: Date;
  periodEnd: Date;
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date;
  amount: number;
  currency: "USD";
  lineItems: LineItem[];
  overageCharges?: OverageCharge[];
  taxes?: number;
  discount?: number;
  notes?: string;
  stripeInvoiceId?: string;
  pdfUrl?: string;
  createdAt: Date;
}

export interface PaymentRecord {
  id: string;
  subscription: string;
  organisation: string;
  invoice?: string;
  amount: number;
  currency: "USD";
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  stripeChargeId?: string;
  paidAt: Date;
  failureReason?: string;
  refundReason?: string;
  createdAt: Date;
}

export interface QuotaStatus {
  organisation: string;
  subscription: string;
  plan: Plan;
  limits: {
    dataPoints: number;
    reports: number;
    storage: number;
    activeUsers: number;
  };
  usage: {
    dataPoints: number;
    reports: number;
    storage: number;
    activeUsers: number;
  };
  remaining: {
    dataPoints: number;
    reports: number;
    storage: number;
    activeUsers: number;
  };
  percentageUsed: {
    dataPoints: number;
    reports: number;
    storage: number;
    activeUsers: number;
  };
}

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  resetDate: Date;
  suggestion?: "upgrade" | "wait";
}

export interface OverageInfo {
  metric: string;
  excess: number;
  charge: number;
}
