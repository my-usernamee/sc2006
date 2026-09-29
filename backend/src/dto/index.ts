/**
 * "Who is allowed to see what" lives in this one file.
 *
 * Database rows contain private fields (Telegram usernames, the unique
 * identifying descriptions). Routes never return a raw database row - they
 * always pass it through one of the functions below first.
 *
 * SRS privacy rules covered here:
 *   REQ-19 / REQ-35  unique identifying description stays private
 *   REQ-59           browsing shows no Telegram username, no description
 *   REQ-66           the Finder sees BOTH descriptions during claim review
 *   REQ-70           both users see each other's Telegram after approval
 */
import { FoundItemReport, LostItemReport, User } from '@prisma/client';
import { photoUrl } from '../middleware/upload';

/** The logged-in user's own account details. */
export function toAccountDto(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    telegramUsername: user.telegramUsername,
  };
}

/**
 * A Found Item Report as shown when browsing (REQ-56).
 * Deliberately has NO telegramUsername and NO privateDescription (REQ-59).
 */
export function toPublicFoundDto(
  report: FoundItemReport & { user?: Pick<User, 'displayName'> },
) {
  return {
    id: report.id,
    itemName: report.itemName,
    category: report.category,
    colour: report.colour,
    brand: report.brand, // null means "Unknown"
    dateFound: report.dateFound,
    locationName: report.locationName,
    latitude: report.latitude,
    longitude: report.longitude,
    photoUrl: photoUrl(report.photoPath),
    status: report.status,
    finderDisplayName: report.user?.displayName,
  };
}

/** A Lost Item Report shown to the user who owns it (so it may show privates). */
export function toOwnLostDto(report: LostItemReport) {
  return {
    id: report.id,
    itemName: report.itemName,
    category: report.category,
    colour: report.colour,
    brand: report.brand,
    dateLost: report.dateLost,
    locationName: report.locationName,
    latitude: report.latitude,
    longitude: report.longitude,
    notificationThreshold: report.notificationThreshold,
    photoUrl: photoUrl(report.photoPath),
    privateDescription: report.privateDescription, // owner only
    status: report.status,
  };
}

/** A Found Item Report shown to the Finder who owns it. */
export function toOwnFoundDto(report: FoundItemReport) {
  return {
    ...toPublicFoundDto(report),
    privateDescription: report.privateDescription, // owner only
  };
}

/**
 * The claim review screen (REQ-65, REQ-66).
 * `viewerIsFinder` decides whether the two private descriptions are included.
 * `revealContacts` is true only once the claim is APPROVED (REQ-70).
 */
export function toClaimDto(
  claim: {
    id: string;
    status: string;
    createdAt: Date;
    decidedAt: Date | null;
    lostReport: LostItemReport & { user: User };
    foundReport: FoundItemReport & { user: User };
  },
  options: { viewerIsFinder: boolean },
) {
  const revealContacts = claim.status === 'APPROVED'; // REQ-70
  const showDescriptions = options.viewerIsFinder; // REQ-66

  return {
    id: claim.id,
    status: claim.status,
    createdAt: claim.createdAt,
    decidedAt: claim.decidedAt,

    lostReport: {
      id: claim.lostReport.id,
      itemName: claim.lostReport.itemName,
      category: claim.lostReport.category,
      colour: claim.lostReport.colour,
      brand: claim.lostReport.brand,
      dateLost: claim.lostReport.dateLost,
      locationName: claim.lostReport.locationName,
      photoUrl: photoUrl(claim.lostReport.photoPath),
      privateDescription: showDescriptions ? claim.lostReport.privateDescription : undefined,
    },

    foundReport: {
      id: claim.foundReport.id,
      itemName: claim.foundReport.itemName,
      category: claim.foundReport.category,
      colour: claim.foundReport.colour,
      brand: claim.foundReport.brand,
      dateFound: claim.foundReport.dateFound,
      locationName: claim.foundReport.locationName,
      photoUrl: photoUrl(claim.foundReport.photoPath),
      privateDescription: showDescriptions ? claim.foundReport.privateDescription : undefined,
    },

    // Contact details appear only after the Finder approves the claim.
    claimant: {
      displayName: claim.lostReport.user.displayName,
      telegramUsername: revealContacts ? claim.lostReport.user.telegramUsername : undefined,
    },
    finder: {
      displayName: claim.foundReport.user.displayName,
      telegramUsername: revealContacts ? claim.foundReport.user.telegramUsername : undefined,
    },
  };
}
