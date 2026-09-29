/**
 * Demo data, so the live demo does not start from an empty screen.
 * Run with:  npm run seed
 *
 * Creates five students, ten lost item reports and fourteen found item
 * reports, all with photographs. Most lost reports have a found report that is
 * a deliberate strong match, so the matching algorithm has something to find
 * as soon as the app opens.
 *
 * Photographs are downloaded once, when the seed runs, and saved into
 * backend/uploads exactly as if a user had uploaded them.
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { UPLOAD_DIR } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { matchFoundReport } from '../src/services/matching.service';

const PASSWORD = 'password123';

// --- Places around NTU, so the distances between reports are realistic ------
const AT = {
  hive: { locationName: 'The Hive', latitude: 1.34639, longitude: 103.68194 },
  northSpine: { locationName: 'North Spine Plaza', latitude: 1.34452, longitude: 103.6805 },
  hall9: { locationName: 'Hall 9', latitude: 1.35216, longitude: 103.68579 },
  library: { locationName: 'Lee Wee Nam Library', latitude: 1.3479, longitude: 103.6803 },
  scse: { locationName: 'School of Computer Science and Engineering', latitude: 1.3429, longitude: 103.6849 },
  canteen2: { locationName: 'Canteen 2', latitude: 1.3487, longitude: 103.6854 },
  sportsRec: { locationName: 'Sports and Recreation Centre', latitude: 1.3544, longitude: 103.6836 },
  southSpine: { locationName: 'South Spine, LT19', latitude: 1.3416, longitude: 103.681 },
  pioneerMrt: { locationName: 'Pioneer MRT Station', latitude: 1.3375, longitude: 103.6972 },
  auditorium: { locationName: 'Nanyang Auditorium', latitude: 1.3464, longitude: 103.6874 },
};

const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * Downloads one photograph and saves it into the uploads folder, returning the
 * filename to store on the report. If the download fails (no internet, for
 * example) a simple placeholder image is written instead, so seeding never
 * breaks and every report still has a picture.
 */
async function fetchPhoto(subject: string, seed: number): Promise<string> {
  const filename = `${crypto.randomBytes(12).toString('hex')}.jpg`;
  const target = path.join(UPLOAD_DIR, filename);

  try {
    const response = await fetch(
      `https://loremflickr.com/640/480/${encodeURIComponent(subject)}?lock=${seed}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1000) throw new Error('image too small');

    fs.writeFileSync(target, bytes);
    return filename;
  } catch {
    // Fall back to a plain labelled square so the layout still looks right.
    const svgName = filename.replace('.jpg', '.svg');
    fs.writeFileSync(
      path.join(UPLOAD_DIR, svgName),
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
         <rect width="640" height="480" fill="#e5e5ea"/>
         <text x="320" y="248" font-family="system-ui" font-size="30"
               fill="#8e8e93" text-anchor="middle">${subject}</text>
       </svg>`,
    );
    return svgName;
  }
}

// --- The data --------------------------------------------------------------

type Lost = {
  owner: string;
  itemName: string;
  category: string;
  colour: string;
  brand: string | null;
  dateLost: string;
  place: keyof typeof AT;
  threshold: number;
  photo: string;
  description?: string;
};

type Found = {
  finder: string;
  itemName: string;
  category: string;
  colour: string;
  brand: string | null;
  dateFound: string;
  place: keyof typeof AT;
  photo: string;
  description?: string;
};

const LOST: Lost[] = [
  { owner: 'alice', itemName: 'Black backpack', category: 'BAGS', colour: 'BLACK', brand: 'Herschel', dateLost: '2026-09-01', place: 'hive', threshold: 60, photo: 'backpack', description: 'Small NTU Computing Club sticker on the front pocket.' },
  { owner: 'alice', itemName: 'Blue water bottle', category: 'BOTTLES_CONTAINERS', colour: 'BLUE', brand: null, dateLost: '2026-09-03', place: 'canteen2', threshold: 50, photo: 'waterbottle', description: 'Dented near the base, and my initials AT are on the cap.' },
  { owner: 'alice', itemName: 'Scientific calculator', category: 'ELECTRONICS', colour: 'BLACK', brand: 'Casio', dateLost: '2026-08-30', place: 'southSpine', threshold: 65, photo: 'calculator', description: 'Matric number written in silver marker on the back.' },
  { owner: 'chloe', itemName: 'AirPods case', category: 'ELECTRONICS', colour: 'WHITE', brand: 'Apple', dateLost: '2026-09-02', place: 'library', threshold: 70, photo: 'earphones', description: 'Deep scratch across the hinge.' },
  { owner: 'chloe', itemName: 'Folding umbrella', category: 'UMBRELLAS', colour: 'NAVY', brand: null, dateLost: '2026-09-04', place: 'northSpine', threshold: 40, photo: 'umbrella' },
  { owner: 'darren', itemName: 'Matriculation card', category: 'CARDS_DOCUMENTS', colour: 'WHITE', brand: null, dateLost: '2026-09-05', place: 'scse', threshold: 30, photo: 'idcard', description: 'Name reads Darren Ng, and the corner is bent.' },
  { owner: 'darren', itemName: 'Grey hoodie', category: 'CLOTHING', colour: 'GREY', brand: 'Uniqlo', dateLost: '2026-09-02', place: 'sportsRec', threshold: 55, photo: 'hoodie', description: 'Small ink stain on the left cuff.' },
  { owner: 'emily', itemName: 'MacBook Air', category: 'ELECTRONICS', colour: 'GREY', brand: 'Apple', dateLost: '2026-09-06', place: 'hive', threshold: 80, photo: 'laptop', description: 'Purple cat sticker beside the trackpad.' },
  { owner: 'emily', itemName: 'Red vacuum flask', category: 'BOTTLES_CONTAINERS', colour: 'RED', brand: 'Thermos', dateLost: '2026-09-01', place: 'hall9', threshold: 45, photo: 'thermos' },
  { owner: 'ben', itemName: 'Keys on a blue lanyard', category: 'KEYS', colour: 'BLACK', brand: null, dateLost: '2026-09-04', place: 'pioneerMrt', threshold: 50, photo: 'keys', description: 'Three keys and a small bottle-opener charm.' },
];

const FOUND: Found[] = [
  // These first ten are deliberate matches for the lost reports above.
  { finder: 'ben', itemName: 'Black Herschel bag', category: 'BAGS', colour: 'BLACK', brand: 'Herschel', dateFound: '2026-09-02', place: 'northSpine', photo: 'backpack', description: 'There is a club sticker on the front pocket.' },
  { finder: 'ben', itemName: 'Blue drink bottle', category: 'BOTTLES_CONTAINERS', colour: 'BLUE', brand: null, dateFound: '2026-09-03', place: 'canteen2', photo: 'waterbottle', description: 'Two letters written on the cap.' },
  { finder: 'ben', itemName: 'Casio calculator', category: 'ELECTRONICS', colour: 'BLACK', brand: 'Casio', dateFound: '2026-08-31', place: 'southSpine', photo: 'calculator', description: 'Numbers written on the back in silver.' },
  { finder: 'darren', itemName: 'White earphone case', category: 'ELECTRONICS', colour: 'WHITE', brand: 'Apple', dateFound: '2026-09-02', place: 'library', photo: 'earphones', description: 'Scratched along the hinge.' },
  { finder: 'emily', itemName: 'Dark blue umbrella', category: 'UMBRELLAS', colour: 'NAVY', brand: null, dateFound: '2026-09-05', place: 'northSpine', photo: 'umbrella' },
  { finder: 'ben', itemName: 'Student card', category: 'CARDS_DOCUMENTS', colour: 'WHITE', brand: null, dateFound: '2026-09-05', place: 'scse', photo: 'idcard', description: 'Card belongs to a D. Ng, one corner is bent.' },
  { finder: 'chloe', itemName: 'Grey Uniqlo hoodie', category: 'CLOTHING', colour: 'GREY', brand: 'Uniqlo', dateFound: '2026-09-03', place: 'sportsRec', photo: 'hoodie', description: 'Ink mark on one sleeve.' },
  { finder: 'alice', itemName: 'Silver laptop', category: 'ELECTRONICS', colour: 'GREY', brand: 'Apple', dateFound: '2026-09-06', place: 'hive', photo: 'laptop', description: 'Cat sticker next to the trackpad.' },
  // Maroon against a lost Red item: this pair shows the "similar colour"
  // rule from the SRS scoring 50 instead of 0.
  { finder: 'chloe', itemName: 'Maroon flask', category: 'BOTTLES_CONTAINERS', colour: 'MAROON', brand: 'Thermos', dateFound: '2026-09-02', place: 'hall9', photo: 'thermos' },
  { finder: 'darren', itemName: 'Bunch of keys', category: 'KEYS', colour: 'BLACK', brand: null, dateFound: '2026-09-05', place: 'pioneerMrt', photo: 'keys', description: 'On a lanyard, with a bottle opener attached.' },

  // The rest fill out the browse page so searching and filtering do something.
  { finder: 'ben', itemName: 'Green golf umbrella', category: 'UMBRELLAS', colour: 'GREEN', brand: null, dateFound: '2026-09-06', place: 'hall9', photo: 'umbrella' },
  { finder: 'chloe', itemName: 'Pink pencil case', category: 'STATIONERY', colour: 'PINK', brand: null, dateFound: '2026-09-04', place: 'northSpine', photo: 'pencilcase' },
  { finder: 'darren', itemName: 'Orange football', category: 'SPORTS_EQUIPMENT', colour: 'ORANGE', brand: 'Nike', dateFound: '2026-09-05', place: 'sportsRec', photo: 'football' },
  { finder: 'emily', itemName: 'Brown leather wallet', category: 'ACCESSORIES', colour: 'BROWN', brand: null, dateFound: '2026-09-07', place: 'auditorium', photo: 'wallet', description: 'Contains a library card but no cash.' },
];

async function main() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  console.log('Clearing existing data...');
  await prisma.notification.deleteMany();
  await prisma.ownershipClaim.deleteMany();
  await prisma.matchResult.deleteMany();
  await prisma.foundItemReport.deleteMany();
  await prisma.lostItemReport.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const people = [
    { key: 'alice', email: 'alice001@e.ntu.edu.sg', displayName: 'Alice Tan', telegramUsername: '@alicetan' },
    { key: 'ben', email: 'ben002@e.ntu.edu.sg', displayName: 'Ben Lim', telegramUsername: '@benlim' },
    { key: 'chloe', email: 'chloe003@e.ntu.edu.sg', displayName: 'Chloe Wong', telegramUsername: '@chloewong' },
    { key: 'darren', email: 'darren004@e.ntu.edu.sg', displayName: 'Darren Ng', telegramUsername: '@darrenng' },
    { key: 'emily', email: 'emily005@e.ntu.edu.sg', displayName: 'Emily Koh', telegramUsername: '@emilykoh' },
  ];

  const userIds: Record<string, string> = {};
  for (const person of people) {
    const user = await prisma.user.create({
      data: {
        email: person.email,
        passwordHash,
        displayName: person.displayName,
        telegramUsername: person.telegramUsername,
      },
    });
    userIds[person.key] = user.id;
  }
  console.log(`Created ${people.length} students.`);

  // Photos are downloaded together rather than one after another, which turns
  // roughly half a minute of waiting into a few seconds.
  console.log('Downloading photographs...');
  const lostPhotos = await Promise.all(LOST.map((r, i) => fetchPhoto(r.photo, i + 1)));
  const foundPhotos = await Promise.all(FOUND.map((r, i) => fetchPhoto(r.photo, i + 101)));
  console.log(`Saved ${lostPhotos.length + foundPhotos.length} photographs.`);

  for (const [i, report] of LOST.entries()) {
    await prisma.lostItemReport.create({
      data: {
        userId: userIds[report.owner],
        itemName: report.itemName,
        category: report.category as never,
        colour: report.colour as never,
        brand: report.brand,
        dateLost: date(report.dateLost),
        ...AT[report.place],
        notificationThreshold: report.threshold,
        privateDescription: report.description ?? null,
        photoPath: lostPhotos[i],
      },
    });
  }
  console.log(`Created ${LOST.length} lost item reports.`);

  const foundIds: string[] = [];
  for (const [i, report] of FOUND.entries()) {
    const created = await prisma.foundItemReport.create({
      data: {
        userId: userIds[report.finder],
        itemName: report.itemName,
        category: report.category as never,
        colour: report.colour as never,
        brand: report.brand,
        dateFound: date(report.dateFound),
        ...AT[report.place],
        privateDescription: report.description ?? null,
        photoPath: foundPhotos[i],
      },
    });
    foundIds.push(created.id);
  }
  console.log(`Created ${FOUND.length} found item reports.`);

  // Running matching for each found report fills in every Match Result and
  // sends the notifications, exactly as it would if a user had submitted them.
  console.log('Running the matching algorithm...');
  for (const id of foundIds) {
    await matchFoundReport(id);
  }

  // One claim is left waiting, so the claim review screen has something in it
  // from the very start of the demo.
  const chloeAirpods = await prisma.lostItemReport.findFirst({
    where: { userId: userIds.chloe, itemName: 'AirPods case' },
  });
  const darrenAirpods = await prisma.foundItemReport.findFirst({
    where: { userId: userIds.darren, itemName: 'White earphone case' },
  });
  if (chloeAirpods && darrenAirpods) {
    const claim = await prisma.ownershipClaim.create({
      data: {
        claimantId: userIds.chloe,
        lostReportId: chloeAirpods.id,
        foundReportId: darrenAirpods.id,
      },
    });
    await prisma.notification.create({
      data: { recipientId: userIds.darren, type: 'CLAIM_SUBMITTED', claimId: claim.id },
    });
  }

  // --- Summary -------------------------------------------------------------
  const matches = await prisma.matchResult.findMany({
    where: { matchScore: { gt: 0 } },
    orderBy: { matchScore: 'desc' },
    include: { lostReport: true, foundReport: true },
  });
  const notified = await prisma.notification.count();

  console.log('\n--- Seed complete ---');
  console.log(`Accounts:      ${people.map((p) => p.email).join(', ')}`);
  console.log(`Password:      ${PASSWORD}`);
  console.log(`Notifications: ${notified}`);
  console.log('\nTop match scores:');
  for (const m of matches.slice(0, 8)) {
    console.log(
      `  ${String(m.matchScore).padStart(3)}  ${m.lostReport.itemName}  ->  ${m.foundReport.itemName}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
