jest.mock('../src/lib/prisma', () => ({ prisma: require('./helpers').db }));
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { db, account, found, lost } from './helpers';

const app = createApp();
const token = () => jwt.sign({ sub: 'owner' }, process.env.JWT_SECRET!);

beforeEach(() => { jest.resetAllMocks(); });

describe('HTTP authentication NFR-7', () => {
  it.each(['/api/users/me', '/api/auth/me', '/api/lost-reports/mine', '/api/found-reports',
    '/api/claims/incoming', '/api/notifications', '/api/onemap/search?q=NTU'])
    ('rejects anonymous access to %s', async path => {
      expect((await request(app).get(path)).status).toBe(401);
    });
  it.each(['bad-token', jwt.sign({ sub: 'owner' }, 'wrong-secret'),
    jwt.sign({ sub: 'owner' }, process.env.JWT_SECRET!, { expiresIn: -1 })])
    ('rejects malformed, wrong-signature and expired tokens %s', async invalid => {
      expect((await request(app).get('/api/users/me').set('Authorization', 'Bearer ' + invalid)).status).toBe(401);
    });
  it('allows authenticated account access without leaking a password', async () => {
    db.user.findUnique.mockResolvedValue(account);
    const response = await request(app).get('/api/users/me').set('Authorization', 'Bearer ' + token());
    expect(response.status).toBe(200);
    expect(response.body.id).toBe('owner');
    expect(response.body).not.toHaveProperty('passwordHash');
  });
  it('accepts the authenticated logout action REQ-8', async () => {
    expect((await request(app).post('/api/auth/logout').set('Authorization', 'Bearer ' + token())).body).toEqual({ ok: true });
  });
  it('registration returns validation errors for invalid input', async () => {
    expect((await request(app).post('/api/auth/register').send({ email: 'bad' })).status).toBe(400);
    expect(db.user.create).not.toHaveBeenCalled();
  });
});

describe('HTTP browsing and match privacy REQ-54 REQ-56 to REQ-60', () => {
  it('returns filtered found items without hidden fields', async () => {
    db.foundItemReport.findMany.mockResolvedValue([found]); db.foundItemReport.count.mockResolvedValue(1);
    const result = await request(app).get('/api/found-reports?q=bag&category=BAGS&colour=BLACK')
      .set('Authorization', 'Bearer ' + token());
    expect(result.status).toBe(200);
    expect(result.body.reports[0]).toMatchObject({ itemName: 'Bag', photoUrl: '/uploads/bag.png' });
    expect(JSON.stringify(result.body)).not.toContain(found.privateDescription);
    expect(JSON.stringify(result.body)).not.toContain('finder_handle');
  });
  it('returns an owned report match score with a public found-item DTO', async () => {
    db.lostItemReport.findUnique.mockResolvedValue(lost);
    db.matchResult.findMany.mockResolvedValue([{ matchScore: 100, foundReport: found }]);
    const result = await request(app).get('/api/lost-reports/lost/matches').set('Authorization', 'Bearer ' + token());
    expect(result.status).toBe(200);
    expect(result.body[0].matchScore).toBe(100);
    expect(JSON.stringify(result.body)).not.toContain(found.privateDescription);
    expect(JSON.stringify(result.body)).not.toContain('finder_handle');
  });
  it('blocks access to someone else match list', async () => {
    db.lostItemReport.findUnique.mockResolvedValue({ ...lost, userId: 'other' });
    expect((await request(app).get('/api/lost-reports/lost/matches').set('Authorization', 'Bearer ' + token())).status).toBe(403);
    expect(db.matchResult.findMany).not.toHaveBeenCalled();
  });
});
