import type { TrustAttestation, SecurityControl } from "./types";

/**
 * Public security practices — editorial, factual, no certification theatre.
 */
export const SECURITY_CONTROLS: SecurityControl[] = [
  {
    id: "authz",
    title: "Authorisation via Membership",
    summary:
      "Clerk provides identity. Every read and write resolves through Payload Membership server-side. Login alone does not grant organisation access.",
  },
  {
    id: "tenant",
    title: "Organisation tenancy",
    summary:
      "Data queries and mutations are scoped to organisations the actor belongs to. The active-org cookie is revalidated against Membership on each request.",
  },
  {
    id: "roles",
    title: "Role gates",
    summary:
      "Owner, admin, contributor, and viewer roles constrain writes. Sensitive actions require the minimum role on the target organisation.",
  },
  {
    id: "audit",
    title: "Append-only audit log",
    summary:
      "Significant mutations can emit AuditLogs entries. Update and delete are denied on that collection, including for admins.",
  },
  {
    id: "tls",
    title: "Encryption in transit",
    summary:
      "Application traffic is served over TLS. Database and third-party API calls use encrypted channels provided by those vendors.",
  },
  {
    id: "rest",
    title: "Encryption at rest",
    summary:
      "Primary datastore (MongoDB Atlas) encrypts data at rest. Secrets such as integration tokens are encrypted application-side before persistence where implemented.",
  },
  {
    id: "secrets",
    title: "Secrets handling",
    summary:
      "API keys and webhook URLs are not returned after save where encryption helpers are used. Environment secrets stay off the client bundle.",
  },
];

/**
 * Formal attestations — honest status only. Do not invent SOC 2 / ISO claims.
 */
export const ATTESTATIONS: TrustAttestation[] = [
  {
    id: "soc2",
    name: "SOC 2 Type II",
    status: "in_progress",
    note: "Control design and evidence collection are underway. ClearESG is not SOC 2 attested. Do not treat this page as a report.",
  },
  {
    id: "iso27001",
    name: "ISO/IEC 27001",
    status: "not_attested",
    note: "No ISO 27001 certificate is claimed. Practices below describe the product as operated today.",
  },
  {
    id: "gdpr",
    name: "GDPR / DPDP readiness",
    status: "in_progress",
    note: "Processing roles, subprocessors, and residency notes are published here. Formal DPIA / DPDP region decisions remain open where noted in the product plan.",
  },
];

export const AUTH_MODEL = {
  identity: "Clerk",
  authorisation: "Payload Membership",
  principle: "Login ≠ access",
  summary:
    "Users authenticate with Clerk. Organisation access, roles, and tenancy are enforced exclusively through Membership records resolved on the server via getCurrentContext(). UI gates are never the sole control.",
} as const;

export const ENCRYPTION_NOTES = {
  transit:
    "HTTPS/TLS terminates at the hosting edge. Connections to MongoDB Atlas, Clerk, and other subprocessors use their TLS endpoints.",
  rest: "MongoDB Atlas provides volume encryption at rest. Application-level AES-GCM is used for selected secrets (for example integration webhooks) before they are stored.",
  keys: "Payload and Clerk secrets live in environment configuration. They are not embedded in client JavaScript.",
} as const;

export const DATA_RESIDENCY = {
  primaryStore: "MongoDB Atlas",
  note: "Cluster region is chosen at provisioning time (see your Atlas project). ClearESG does not silently move customer documents between cloud regions. Confirm the live region with your operator if you have contractual residency requirements.",
  openDecision:
    "DPDP / Atlas region selection is an open product decision — ask the ClearESG team rather than assuming a jurisdiction from this page.",
} as const;
