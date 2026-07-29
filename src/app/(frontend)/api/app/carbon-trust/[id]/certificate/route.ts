import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import {
  generateCertificatePDF,
  generateCertificateNumber,
  calculateExpirationDate,
} from "@/lib/carbon-trust/certificateGenerator";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentContext();
  const { id } = await params;

  if (!auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await getPayload({ config });

  try {
    // Verify certification belongs to user's org
    const cert = await payload.findByID({
      collection: "carbon-trust-certifications",
      id,
    });

    if (!cert || (cert.organisation as { id: string }).id !== auth.activeOrg.id) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 });
    }

    // Check if certification is approved
    if (cert.status !== "approved" && cert.status !== "certified") {
      return NextResponse.json(
        { error: "Certification must be approved before generating certificate" },
        { status: 400 },
      );
    }

    // Check if certificate already exists
    const existingCert = await payload.find({
      collection: "carbon-trust-certificates",
      where: {
        certification: { equals: id },
      },
      limit: 1,
    });

    if (existingCert.docs.length > 0) {
      // Return existing certificate
      return NextResponse.json({
        certificate: existingCert.docs[0],
        message: "Certificate already generated",
      });
    }

    // Get organisation name
    const org = await payload.findByID({
      collection: "organisations",
      id: auth.activeOrg.id,
    });

    const orgName = (org.name as string) || "Unknown Organization";

    // Get auditor info
    const auditorName = cert.auditor?.name || "Carbon Trust Auditor";

    // Generate certificate
    const issuedDate = new Date();
    const expiresDate = calculateExpirationDate(issuedDate);
    const certificateNumber = generateCertificateNumber(auth.activeOrg.id, issuedDate);

    const { verificationToken } = await generateCertificatePDF({
      certificationId: id,
      organisationName: orgName,
      certificateNumber,
      issuedDate,
      expiresDate,
      scope: cert.scope || "all",
      auditorName,
      baselineYear: cert.scope || 2024,
      verifiedEmissions: 0, // Would be calculated from actual data
    });

    // In production, upload to S3
    // For now, create certificate record without file upload
    const certificate = await payload.create({
      collection: "carbon-trust-certificates",
      data: {
        organisation: auth.activeOrg.id,
        certification: id,
        certificateNumber,
        pdfUrl: `/api/app/carbon-trust/${id}/certificate/pdf/${certificateNumber}`,
        pdfS3Key: `certificates/${certificateNumber}.pdf`,
        issuedAt: issuedDate.toISOString(),
        expiresAt: expiresDate.toISOString(),
        status: "active",
        verificationToken,
        verificationUrl: `/verify/${verificationToken}`,
        scope: cert.scope || "all",
        emissionBaselineYear: cert.scope || 2024,
        baselineEmissions: 0,
        verifiedEmissions: 0,
        publiclyListed: true,
        createdBy: auth.user?.id,
      },
    });

    // Update certification status to certified
    await payload.update({
      collection: "carbon-trust-certifications",
      id,
      data: { status: "certified" },
    });

    return NextResponse.json(
      {
        certificate,
        message: "Certificate generated successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error generating certificate:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate certificate",
      },
      { status: 500 },
    );
  }
}
