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

async function requireMerchant(result) {
  if (result.user.role === 'MERCHANT') return result;
  await auth.logout(result.refreshToken);
  throw new AppError('Merchant account required', 403, 'MERCHANT_ACCOUNT_REQUIRED');
}

export const login = async (request, response) => {
  const result = await auth.login(request.body, {
    ip: request.ip,
    userAgent: request.get('user-agent'),
  });
  return successResponse(response, await requireMerchant(result), { message: 'Merchant login successful' });
};

export const refresh = async (request, response) => {
  const result = await auth.refresh(request.body.refreshToken, {
    ip: request.ip,
    userAgent: request.get('user-agent'),
  });
  return successResponse(response, await requireMerchant(result));
};

export const logout = async (request, response) => {
  await auth.logout(request.body.refreshToken);
  return successResponse(response, null, { message: 'Logged out' });
};

export const forgotCredentials = async (request, response) =>
  successResponse(response, await auth.requestCredentialReset(request.body), {
    statusCode: 202,
    message: 'If the account exists, reset delivery has been queued',
  });

export const resetCredentials = async (request, response) =>
  successResponse(response, await auth.resetCredential({
    otpId: request.body.otpId,
    code: request.body.code,
    credential: request.body.password,
  }), { message: 'Password changed' });
