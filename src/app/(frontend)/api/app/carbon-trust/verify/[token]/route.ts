import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@/payload.config";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const payload = await getPayload({ config });

  try {
    const certificates = await payload.find({
      collection: "carbon-trust-certificates",
      where: { verificationToken: { equals: token } },
      limit: 1,
    });

    if (certificates.totalDocs === 0) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    }

    const cert = certificates.docs[0];

    if (cert.status === "revoked") {
      return NextResponse.json(
        {
          verified: false,
          status: "revoked",
          revokedAt: cert.revokedAt,
          revocationReason: cert.revocationReason,
          message: "This certificate has been revoked",
        },
        { status: 403 },
      );
    }

    const isExpired = new Date() > new Date(cert.expiresAt);

    return NextResponse.json({
      verified: !isExpired && cert.status === "active",
      certificateNumber: cert.certificateNumber,
      organisationName: (cert.organisation as { name?: string }).name || "Unknown",
      issuedAt: cert.issuedAt,
      expiresAt: cert.expiresAt,
      status: cert.status,
      scope: cert.scope,
      baselineYear: cert.emissionBaselineYear,
      verifiedEmissions: cert.verifiedEmissions,
      expired: isExpired,
      expiringIn: isExpired
        ? null
        : Math.ceil(
            (new Date(cert.expiresAt).getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24),
          ),
    });
  } catch (error) {
    console.error("Error verifying certificate:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
