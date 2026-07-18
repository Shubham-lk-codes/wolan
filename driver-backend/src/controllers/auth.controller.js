import { AuthService } from '@wolan/shared/services';
import { AppError, successResponse } from '@wolan/shared/utils';
import { env } from '../config/env.js';

const auth = new AuthService({
  accessSecret: env.jwtAccessSecret,
  refreshSecret: env.jwtRefreshSecret,
  accessExpiresIn: env.jwtAccessExpiresIn,
  refreshExpiresIn: env.jwtRefreshExpiresIn,
  issuer: env.jwtIssuer,
  audience: env.jwtAudience,
});

const credentials = (body) => body.phone
  ? { identifier: body.phone, password: body.pin }
  : body;

async function requireDriver(result) {
  if (result.user.role === 'DRIVER') return result;
  await auth.logout(result.refreshToken);
  throw new AppError('Driver account required', 403, 'DRIVER_ACCOUNT_REQUIRED');
}

export const login = async (request, response) => {
  const result = await auth.login(credentials(request.body), {
    ip: request.ip,
    userAgent: request.get('user-agent'),
  });
  return successResponse(response, await requireDriver(result), { message: 'Driver login successful' });
};

export const refresh = async (request, response) => {
  const result = await auth.refresh(request.body.refreshToken, {
    ip: request.ip,
    userAgent: request.get('user-agent'),
  });
  return successResponse(response, await requireDriver(result));
};

export const logout = async (request, response) => {
  await auth.logout(request.body.refreshToken);
  return successResponse(response, null, { message: 'Logged out' });
};

export const forgotPin = async (request, response) =>
  successResponse(response, await auth.requestCredentialReset(request.body), {
    statusCode: 202,
    message: 'If the account exists, PIN reset delivery has been queued',
  });

export const resetPin = async (request, response) =>
  successResponse(response, await auth.resetCredential({
    otpId: request.body.otpId,
    code: request.body.code,
    credential: request.body.pin,
    pin: true,
  }), { message: 'PIN changed' });

export const changePin = async (request, response) =>
  successResponse(response, await auth.changePin(request.user._id, request.body.currentPin, request.body.newPin), {
    message: 'PIN changed; sign in again',
  });
