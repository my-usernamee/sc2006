const methods = ['findUnique', 'findFirst', 'findMany', 'create', 'update', 'updateMany', 'upsert', 'delete', 'count'];
export const db: any = Object.fromEntries(
  ['user', 'lostItemReport', 'foundItemReport', 'ownershipClaim', 'notification', 'matchResult']
    .map(name => [name, Object.fromEntries(methods.map(method => [method, jest.fn()]))]),
);
db.$transaction = jest.fn();

export const account: any = {
  id: 'owner', email: 'owner@e.ntu.edu.sg', displayName: 'Owner',
  telegramUsername: 'owner_handle', passwordHash: 'not-a-plain-password', createdAt: new Date(),
};
export const lost: any = {
  id: 'lost', userId: 'owner', itemName: 'Bag', category: 'BAGS', colour: 'BLACK',
  brand: 'Nike', dateLost: new Date('2026-10-25T00:00:00Z'), locationName: 'NTU',
  latitude: 1.34639, longitude: 103.68194, notificationThreshold: 90,
  privateDescription: 'private lost detail', photoPath: null, status: 'ACTIVE',
  user: account, createdAt: new Date(), updatedAt: new Date(),
};
export const found: any = {
  ...lost, id: 'found', userId: 'finder', dateFound: lost.dateLost, photoPath: 'bag.png',
  status: 'OPEN', privateDescription: 'private found detail',
  user: { ...account, id: 'finder', telegramUsername: 'finder_handle' },
};
export const claim: any = {
  id: 'claim', claimantId: 'owner', lostReportId: 'lost', foundReportId: 'found',
  status: 'PENDING', createdAt: new Date(), decidedAt: null, lostReport: lost, foundReport: found,
};
export const input = {
  itemName: 'Bag', category: 'BAGS', colour: 'BLACK', brand: 'Nike',
  dateLost: '2026-10-25', dateFound: '2026-10-25', locationName: 'NTU',
  latitude: '1.34639', longitude: '103.68194', notificationThreshold: '90',
};
