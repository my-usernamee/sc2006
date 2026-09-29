/**
 * Registration, login and account editing (SRS 4.1, REQ-1 to REQ-8).
 * Passwords are hashed with bcrypt and never stored or returned in plain text.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { badRequest, conflict, notFound, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';

const BCRYPT_ROUNDS = 10;
const TOKEN_LIFETIME = '7d';

/** Creates the JWT the frontend sends back on every request. */
function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: TOKEN_LIFETIME });
}

/** REQ-1 to REQ-4: create a new account. */
export async function register(input: {
  email: string;
  password: string;
  displayName: string;
  telegramUsername: string;
}) {
  // REQ-4: one account per email address.
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw conflict('An account with that email already exists.');
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      displayName: input.displayName,
      telegramUsername: input.telegramUsername,
    },
  });

  return { user, token: signToken(user.id) };
}

/** REQ-5 / REQ-6: log in, or reject invalid credentials. */
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // The same message is used whether the email or the password was wrong, so
  // an attacker cannot use this endpoint to discover which emails exist.
  const invalid = unauthorized('Incorrect email or password.');
  if (!user) throw invalid;

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) throw invalid;

  return { user, token: signToken(user.id) };
}

export async function getUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('Account not found.');
  return user;
}

/** REQ-7: a user may change their display name and Telegram username only. */
export async function updateAccount(
  userId: string,
  input: { displayName: string; telegramUsername: string },
) {
  if (!input.displayName || !input.telegramUsername) {
    throw badRequest('Display name and Telegram username are both required.');
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      displayName: input.displayName,
      telegramUsername: input.telegramUsername,
    },
  });
}
