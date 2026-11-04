jest.mock('../src/lib/prisma', () => ({ prisma: require('./helpers').db }));
import { db, found, lost, claim } from './helpers';
import * as service from '../src/services/claim.service';

beforeEach(() => {
  jest.resetAllMocks();
  db.foundItemReport.findUnique.mockResolvedValue(found);
  db.lostItemReport.findUnique.mockResolvedValue(lost);
  db.ownershipClaim.findFirst.mockResolvedValue(null);
  db.ownershipClaim.findUnique.mockResolvedValue(claim);
  db.ownershipClaim.create.mockResolvedValue(claim);
  db.$transaction.mockImplementation((operations: unknown[]) => Promise.all(operations));
});

describe('ownership claim submission REQ-61 to REQ-65', () => {
  it('links both reports in a Pending claim and notifies the Finder', async () => {
    expect(await service.submitClaim('owner', 'found', 'lost')).toEqual(claim);
    expect(db.ownershipClaim.create).toHaveBeenCalledWith({ data: {
      claimantId: 'owner', foundReportId: 'found', lostReportId: 'lost',
    } });
    expect(db.notification.create).toHaveBeenCalledWith({ data: {
      recipientId: 'finder', type: 'CLAIM_SUBMITTED', claimId: 'claim',
    } });
  });
  it.each([
    ['foundItemReport', null, 404],
    ['foundItemReport', { ...found, status: 'CLOSED' }, 409],
    ['foundItemReport', { ...found, userId: 'owner' }, 400],
    ['lostItemReport', null, 404],
    ['lostItemReport', { ...lost, userId: 'other' }, 403],
    ['lostItemReport', { ...lost, status: 'RESOLVED' }, 409],
  ])('rejects unavailable or unauthorised reports %s %j', async (model, value, status) => {
    db[model as string].findUnique.mockResolvedValue(value);
    await expect(service.submitClaim('owner', 'found', 'lost')).rejects.toMatchObject({ status });
    expect(db.ownershipClaim.create).not.toHaveBeenCalled();
  });
  it('rejects a second pending claim', async () => {
    db.ownershipClaim.findFirst.mockResolvedValue(claim);
    await expect(service.submitClaim('owner', 'found', 'lost')).rejects.toMatchObject({ status: 409 });
    expect(db.ownershipClaim.create).not.toHaveBeenCalled();
  });
});

describe('claim review REQ-66 to REQ-72', () => {
  it.each(['finder', 'owner'])('allows participant %s to view the linked reports', async id => {
    expect((await service.getClaim('claim', id)).claim).toEqual(claim);
  });
  it('blocks unrelated viewers', async () => {
    await expect(service.getClaim('claim', 'intruder')).rejects.toMatchObject({ status: 403 });
  });
  it.each(['approve', 'reject'])('blocks non-Finder %s decisions', async action => {
    await expect((action === 'approve' ? service.approveClaim : service.rejectClaim)('claim', 'owner'))
      .rejects.toMatchObject({ status: 403 });
    expect(db.ownershipClaim.update).not.toHaveBeenCalled();
  });
  it.each(['APPROVED', 'REJECTED'])('blocks a repeated decision after %s', async status => {
    db.ownershipClaim.findUnique.mockResolvedValue({ ...claim, status });
    await expect(service.approveClaim('claim', 'finder')).rejects.toMatchObject({ status: 409 });
    await expect(service.rejectClaim('claim', 'finder')).rejects.toMatchObject({ status: 409 });
  });
  it('approval writes Approved, Resolved and Closed statuses and notifies claimant', async () => {
    await service.approveClaim('claim', 'finder');
    expect(db.ownershipClaim.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) }));
    expect(db.lostItemReport.update).toHaveBeenCalledWith({ where: { id: 'lost' }, data: { status: 'RESOLVED' } });
    expect(db.foundItemReport.update).toHaveBeenCalledWith({ where: { id: 'found' }, data: { status: 'CLOSED' } });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.notification.create).toHaveBeenCalledWith({ data: {
      recipientId: 'owner', type: 'CLAIM_APPROVED', claimId: 'claim',
    } });
  });
  it('rejection retains report statuses, releases the lock and notifies claimant', async () => {
    await service.rejectClaim('claim', 'finder');
    expect(db.ownershipClaim.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) }));
    expect(db.lostItemReport.update).not.toHaveBeenCalled();
    expect(db.foundItemReport.update).not.toHaveBeenCalled();
    await expect(service.assertNoPendingClaim({ lostReportId: 'lost' })).resolves.toBeUndefined();
    expect(db.ownershipClaim.findFirst).toHaveBeenCalledWith({ where: { status: 'PENDING', lostReportId: 'lost' } });
    expect(db.notification.create).toHaveBeenCalledWith({ data: {
      recipientId: 'owner', type: 'CLAIM_REJECTED', claimId: 'claim',
    } });
  });
});
