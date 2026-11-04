jest.mock('../src/lib/prisma', () => ({ prisma: require('./helpers').db }));
import { db, lost, found } from './helpers';
import * as service from '../src/services/matching.service';

beforeEach(() => {
  jest.resetAllMocks();
  db.lostItemReport.findUnique.mockResolvedValue(lost);
  db.foundItemReport.findUnique.mockResolvedValue(found);
  db.foundItemReport.findMany.mockResolvedValue([found]);
  db.lostItemReport.findMany.mockResolvedValue([lost]);
  db.matchResult.upsert.mockResolvedValue({ id: 'match', notified: false });
});

describe('automatic matching REQ-41 to REQ-55 and NFR-16', () => {
  it.each(['lost', 'found'])('scores a new %s report and notifies the owner', async kind => {
    await (kind === 'lost' ? service.matchLostReport('lost') : service.matchFoundReport('found'));
    expect(db.matchResult.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { lostReportId: 'lost', foundReportId: 'found', matchScore: 100 },
    }));
    expect(db.notification.create).toHaveBeenCalledWith({ data: {
      recipientId: 'owner', type: 'MATCH_FOUND', matchResultId: 'match',
    } });
  });
  it('queries only Open counterpart reports', async () => {
    await service.matchLostReport('lost');
    expect(db.foundItemReport.findMany).toHaveBeenCalledWith({ where: { status: 'OPEN' } });
  });
  it('queries only Active counterpart reports', async () => {
    await service.matchFoundReport('found');
    expect(db.lostItemReport.findMany).toHaveBeenCalledWith({ where: { status: 'ACTIVE' } });
  });
  it.each(['lost', 'found'])('skips a closed %s report', async kind => {
    if (kind === 'lost') {
      db.lostItemReport.findUnique.mockResolvedValue({ ...lost, status: 'RESOLVED' });
      await service.matchLostReport('lost');
    } else {
      db.foundItemReport.findUnique.mockResolvedValue({ ...found, status: 'CLOSED' });
      await service.matchFoundReport('found');
    }
    expect(db.matchResult.upsert).not.toHaveBeenCalled();
  });
  it.each([[87, true], [88, true], [89, false]])('score 88 with threshold %i notifies %s', async (threshold, expected) => {
    db.lostItemReport.findUnique.mockResolvedValue({ ...lost, colour: 'BLUE', notificationThreshold: threshold });
    db.foundItemReport.findMany.mockResolvedValue([{ ...found, colour: 'NAVY' }]);
    await service.matchLostReport('lost');
    expect(db.notification.create).toHaveBeenCalledTimes(expected ? 1 : 0);
  });
  it.each([
    { category: 'KEYS' },
    { dateFound: new Date('2026-10-24T00:00:00Z') },
  ])('ineligible pair never notifies even at zero threshold %j', async change => {
    db.lostItemReport.findUnique.mockResolvedValue({ ...lost, notificationThreshold: 0 });
    db.foundItemReport.findMany.mockResolvedValue([{ ...found, ...change }]);
    await service.matchLostReport('lost');
    expect(db.matchResult.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { matchScore: 0 } }));
    expect(db.notification.create).not.toHaveBeenCalled();
  });
  it('repeated matching sends only one notification per pair', async () => {
    let notified = false;
    db.matchResult.upsert.mockImplementation(async () => ({ id: 'match', notified }));
    db.matchResult.update.mockImplementation(async () => { notified = true; });
    await service.matchLostReport('lost');
    await service.matchLostReport('lost');
    expect(db.matchResult.upsert).toHaveBeenCalledTimes(2);
    expect(db.notification.create).toHaveBeenCalledTimes(1);
  });
  it('threshold edits notify only previously unnotified qualifying pairs', async () => {
    db.lostItemReport.findUnique.mockResolvedValue({ ...lost, notificationThreshold: 88 });
    db.matchResult.findMany.mockResolvedValue([
      { id: 'qualifies', matchScore: 88 }, { id: 'below', matchScore: 87 }, { id: 'zero', matchScore: 0 },
    ]);
    await service.reEvaluateThreshold('lost');
    expect(db.matchResult.findMany).toHaveBeenCalledWith({ where: { lostReportId: 'lost', notified: false } });
    expect(db.notification.create).toHaveBeenCalledTimes(1);
    expect(db.notification.create).toHaveBeenCalledWith({ data: {
      recipientId: 'owner', type: 'MATCH_FOUND', matchResultId: 'qualifies',
    } });
  });
  it('match list is ordered by score and includes the found report', async () => {
    db.matchResult.findMany.mockResolvedValue([{ matchScore: 100, foundReport: found }]);
    const results = await service.listMatchesForLostReport('lost');
    expect(results[0]).toMatchObject({ matchScore: 100, foundReport: found });
    expect(db.matchResult.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { lostReportId: 'lost', matchScore: { gte: 90, gt: 0 } }, orderBy: { matchScore: 'desc' },
    }));
  });
  it.each(['category', 'colour', 'brand', 'dateLost', 'dateFound', 'latitude', 'longitude'])
    ('recalculates when %s changes', field => {
      expect(service.affectsMatching([field])).toBe(true);
    });
  it('does not recalculate for descriptive text only', () => {
    expect(service.affectsMatching(['itemName', 'privateDescription'])).toBe(false);
  });
});
