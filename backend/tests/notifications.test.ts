jest.mock('../src/lib/prisma', () => ({ prisma: require('./helpers').db }));
import { db, found } from './helpers';
import * as service from '../src/services/notification.service';

beforeEach(() => { jest.resetAllMocks(); });

it('lists only recipient notifications with their linked report and score', async () => {
  db.notification.findMany.mockResolvedValue([{
    id: 'notification', type: 'MATCH_FOUND', createdAt: new Date(), readAt: null,
    matchResult: { matchScore: 88, foundReportId: 'found', foundReport: found }, claim: null, claimId: null,
  }]);
  expect((await service.listNotifications('owner'))[0]).toMatchObject({
    id: 'notification', read: false, matchScore: 88, foundReportId: 'found', itemName: 'Bag',
  });
  expect(db.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { recipientId: 'owner' } }));
});
it('marks only the recipients own notification as read', async () => {
  await service.markAsRead('owner', 'notification');
  expect(db.notification.updateMany).toHaveBeenCalledWith({
    where: { id: 'notification', recipientId: 'owner' }, data: { readAt: expect.any(Date) },
  });
});
it('counts unread notifications for the current recipient', async () => {
  await service.countUnread('owner');
  expect(db.notification.count).toHaveBeenCalledWith({ where: { recipientId: 'owner', readAt: null } });
});
