import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

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

    // Get all checklist items for this certification
    const items = await payload.find({
      collection: "carbon-trust-checklist-items",
      where: {
        certification: { equals: id },
      },
      limit: 100,
    });

    // Calculate statistics
    const stats = {
      total: items.totalDocs,
      approved: items.docs.filter((item) => item.status === "approved").length,
      notApplicable: items.docs.filter((item) => item.status === "not_applicable").length,
      inProgress: items.docs.filter((item) => item.status === "in_progress").length,
      submitted: items.docs.filter((item) => item.status === "submitted").length,
      additionalInfoRequested: items.docs.filter(
        (item) => item.status === "additional_info_requested",
      ).length,
      notStarted: items.docs.filter((item) => item.status === "not_started").length,
    };

    return NextResponse.json({
      certificationId: id,
      items: items.docs,
      stats,
    });
  } catch (error) {
    console.error("Error fetching checklist:", error);
    return NextResponse.json({ error: "Failed to fetch checklist" }, { status: 500 });
  }
}
