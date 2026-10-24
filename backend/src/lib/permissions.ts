import { prisma } from "./prisma";
export async function reportPermissions(
  report: {
    id: string;
    userId: string;
    status: string;
    deletedAt: Date | null;
  },
  userId: string,
  kind: "lost" | "found",
) {
  const pending = await prisma.ownershipClaim.count({
    where: {
      status: "PENDING",
      ...(kind === "lost"
        ? { lostReportId: report.id }
        : { foundReportId: report.id }),
    },
  });
  const own = report.userId === userId;
  const available =
    !report.deletedAt &&
    (kind === "lost" ? report.status === "ACTIVE" : report.status === "OPEN");
  return {
    isOwner: own,
    locked: pending > 0,
    canEdit: own && available && !pending,
    canDelete: own && available && !pending,
    canClaim: !own && available && !pending,
  };
}
