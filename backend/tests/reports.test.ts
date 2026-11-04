jest.mock('../src/lib/prisma', () => ({ prisma: require('./helpers').db }));
jest.mock('../src/services/matching.service', () => ({
  affectsMatching: jest.fn((fields: string[]) => fields.length > 0),
  matchLostReport: jest.fn(), matchFoundReport: jest.fn(), reEvaluateThreshold: jest.fn(),
}));
import { db, lost, found } from './helpers';
import * as lostService from '../src/services/lostReport.service';
import * as foundService from '../src/services/foundReport.service';
import * as matching from '../src/services/matching.service';

beforeEach(() => {
  jest.resetAllMocks();
  db.ownershipClaim.findFirst.mockResolvedValue(null);
  db.lostItemReport.findUnique.mockResolvedValue(lost);
  db.foundItemReport.findUnique.mockResolvedValue(found);
  db.lostItemReport.create.mockResolvedValue(lost);
  db.foundItemReport.create.mockResolvedValue(found);
  db.lostItemReport.update.mockResolvedValue(lost);
  db.foundItemReport.update.mockResolvedValue(found);
  jest.mocked(matching.affectsMatching).mockImplementation(fields => fields.length > 0);
});

describe.each([
  ['lost', lostService, lost, 'lostItemReport', 'ACTIVE'],
  ['found', foundService, found, 'foundItemReport', 'OPEN'],
] as const)('%s report lifecycle and ownership', (kind, service, fixture, model, status) => {
  it('creates an owned report with coordinates and triggers matching', async () => {
    const report = await service.createReport(fixture.userId, fixture, kind === 'found' ? 'bag.png' : null);
    expect(report.status).toBe(status);
    expect(db[model].create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: fixture.userId, latitude: fixture.latitude, longitude: fixture.longitude, locationName: 'NTU',
    }) });
    expect(kind === 'lost' ? matching.matchLostReport : matching.matchFoundReport).toHaveBeenCalledWith(fixture.id);
  });
  it('lists only the user reports', async () => {
    await service.listMyReports(fixture.userId);
    expect(db[model].findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: fixture.userId } }));
  });
  it('rejects a missing report', async () => {
    db[model].findUnique.mockResolvedValue(null);
    await expect(service.getOwnedReport('missing', fixture.userId)).rejects.toMatchObject({ status: 404 });
  });
  it.each(['update', 'delete'])('rejects another user attempting %s', async action => {
    const promise = action === 'update'
      ? service.updateReport(fixture.id, 'intruder', fixture, null)
      : service.deleteReport(fixture.id, 'intruder');
    await expect(promise).rejects.toMatchObject({ status: 403 });
    expect(db[model].update).not.toHaveBeenCalled();
    expect(db[model].delete).not.toHaveBeenCalled();
  });
  it.each(['update', 'delete'])('blocks %s while a claim is pending', async action => {
    db.ownershipClaim.findFirst.mockResolvedValue({ id: 'claim', status: 'PENDING' });
    const promise = action === 'update'
      ? service.updateReport(fixture.id, fixture.userId, fixture, null)
      : service.deleteReport(fixture.id, fixture.userId);
    await expect(promise).rejects.toMatchObject({ status: 409 });
    expect(db[model].update).not.toHaveBeenCalled();
    expect(db[model].delete).not.toHaveBeenCalled();
  });
  it.each(['update', 'delete'])('blocks %s after closure', async action => {
    db[model].findUnique.mockResolvedValue({ ...fixture, status: kind === 'lost' ? 'RESOLVED' : 'CLOSED' });
    const promise = action === 'update'
      ? service.updateReport(fixture.id, fixture.userId, fixture, null)
      : service.deleteReport(fixture.id, fixture.userId);
    await expect(promise).rejects.toMatchObject({ status: 403 });
  });
  it('allows an owner to update fields and recalculate changed colour', async () => {
    await service.updateReport(fixture.id, fixture.userId, { ...fixture, colour: 'BLUE' }, null);
    expect(db[model].update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ colour: 'BLUE' }) }));
    expect(kind === 'lost' ? matching.matchLostReport : matching.matchFoundReport).toHaveBeenCalledWith(fixture.id);
  });
  it('allows an owner to delete an available report', async () => {
    await service.deleteReport(fixture.id, fixture.userId);
    expect(db[model].delete).toHaveBeenCalledWith({ where: { id: fixture.id } });
  });
  it('saves a new optional private description and photograph', async () => {
    await service.updateReport(fixture.id, fixture.userId, { ...fixture, privateDescription: 'New mark' }, 'new.png');
    expect(db[model].update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      privateDescription: 'New mark', photoPath: 'new.png',
    }) }));
  });
});

it('found report creation requires a photograph', async () => {
  await expect(foundService.createReport('finder', found, null)).rejects.toMatchObject({ status: 400 });
  expect(db.foundItemReport.create).not.toHaveBeenCalled();
});
it('threshold-only edits re-evaluate saved scores without recalculating', async () => {
  await lostService.updateReport('lost', 'owner', { ...lost, notificationThreshold: 80 }, null);
  expect(matching.reEvaluateThreshold).toHaveBeenCalledWith('lost');
  expect(matching.matchLostReport).not.toHaveBeenCalled();
});
it('browsing filters Open reports by item name, category and colour', async () => {
  db.foundItemReport.findMany.mockResolvedValue([found]);
  db.foundItemReport.count.mockResolvedValue(1);
  expect(await foundService.browse({ q: 'Bag', category: 'BAGS', colour: 'BLACK', page: 1 }))
    .toMatchObject({ reports: [found], total: 1, pageSize: 12 });
  expect(db.foundItemReport.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
    status: 'OPEN', itemName: { contains: 'Bag', mode: 'insensitive' }, category: 'BAGS', colour: 'BLACK',
  } }));
});
it('browsing handles empty results', async () => {
  db.foundItemReport.findMany.mockResolvedValue([]); db.foundItemReport.count.mockResolvedValue(0);
  expect(await foundService.browse({ page: 1 })).toMatchObject({ reports: [], total: 0 });
});
