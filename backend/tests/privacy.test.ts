import { toAccountDto, toPublicFoundDto, toOwnFoundDto, toOwnLostDto, toClaimDto } from '../src/dto';
import { account, found, lost, claim } from './helpers';

describe('DTO privacy REQ-19 REQ-35 REQ-57 REQ-60 REQ-66 REQ-67 REQ-71', () => {
  it('never returns the password hash in account data', () => {
    expect(toAccountDto(account)).not.toHaveProperty('passwordHash');
  });
  it('browsing and match report data exclude private details and Telegram', () => {
    const result = toPublicFoundDto(found);
    expect(result).toMatchObject({ itemName: 'Bag', category: 'BAGS', colour: 'BLACK', brand: 'Nike',
      dateFound: found.dateFound, locationName: 'NTU', photoUrl: '/uploads/bag.png' });
    expect(result).not.toHaveProperty('privateDescription');
    expect(result).not.toHaveProperty('telegramUsername');
    expect(JSON.stringify(result)).not.toContain('finder_handle');
  });
  it('owners can see their own private descriptions', () => {
    expect(toOwnFoundDto(found).privateDescription).toBe(found.privateDescription);
    expect(toOwnLostDto(lost).privateDescription).toBe(lost.privateDescription);
  });
  it.each(['PENDING', 'REJECTED'])('hides contacts while %s', status => {
    const value = toClaimDto({ ...claim, status }, { viewerIsFinder: true });
    expect(value.finder.telegramUsername).toBeUndefined();
    expect(value.claimant.telegramUsername).toBeUndefined();
  });
  it('reveals contacts on approved claims', () => {
    const value = toClaimDto({ ...claim, status: 'APPROVED' }, { viewerIsFinder: false });
    expect(value.finder.telegramUsername).toBe('finder_handle');
    expect(value.claimant.telegramUsername).toBe('owner_handle');
  });
  it('finder sees both descriptions for review', () => {
    const value = toClaimDto(claim, { viewerIsFinder: true });
    expect(value.lostReport.privateDescription).toBe(lost.privateDescription);
    expect(value.foundReport.privateDescription).toBe(found.privateDescription);
  });
  it('claimant cannot see the finder private description', () => {
    expect(toClaimDto(claim, { viewerIsFinder: false }).foundReport.privateDescription).toBeUndefined();
  });
});
