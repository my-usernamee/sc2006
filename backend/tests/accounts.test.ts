jest.mock('../src/lib/prisma', () => ({ prisma: require('./helpers').db }));
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, account } from './helpers';
import * as service from '../src/services/auth.service';

beforeEach(() => { jest.resetAllMocks(); });

describe('accounts REQ-4 to REQ-7', () => {
  it('registers with a hashed password and signs the user ID', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockImplementation(async ({ data }: any) => ({ ...account, ...data }));
    const result = await service.register({ ...account, password: 'password123' });
    expect(result.user.passwordHash).not.toBe('password123');
    expect(await bcrypt.compare('password123', result.user.passwordHash)).toBe(true);
    expect(jwt.verify(result.token, process.env.JWT_SECRET!)).toMatchObject({ sub: account.id });
  });
  it('rejects duplicate emails', async () => {
    db.user.findUnique.mockResolvedValue(account);
    await expect(service.register({ ...account, password: 'password123' })).rejects.toMatchObject({ status: 409 });
    expect(db.user.create).not.toHaveBeenCalled();
  });
  it('logs in with valid credentials', async () => {
    db.user.findUnique.mockResolvedValue({ ...account, passwordHash: await bcrypt.hash('password123', 4) });
    const result = await service.login(account.email, 'password123');
    expect(jwt.verify(result.token, process.env.JWT_SECRET!)).toMatchObject({ sub: account.id });
  });
  it.each(['unknown user', 'wrong password'])('rejects invalid login with %s', async scenario => {
    db.user.findUnique.mockResolvedValue(scenario === 'unknown user' ? null
      : { ...account, passwordHash: await bcrypt.hash('correct-password', 4) });
    await expect(service.login(account.email, 'wrong-password')).rejects.toMatchObject({ status: 401 });
  });
  it('updates only the allowed account fields', async () => {
    await service.updateAccount('owner', { displayName: 'New Name', telegramUsername: 'new_handle' });
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'owner' }, data: {
      displayName: 'New Name', telegramUsername: 'new_handle',
    } });
  });
});
