import crypto from 'node:crypto';

function toBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function verifyVkLaunch(params, secret) {
  const safeParams = Object.fromEntries(Object.entries(params).map(([key, value]) => [String(key), String(value)]));
  const signedPayload = Object.keys(safeParams)
    .filter((key) => key.startsWith('vk_'))
    .sort()
    .map((key) => `${key}=${safeParams[key]}`)
    .join('&');
  const expected = secret && signedPayload
    ? toBase64Url(crypto.createHmac('sha256', secret).update(signedPayload).digest())
    : '';
  const verified = Boolean(secret && safeParams.sign && expected === safeParams.sign);
  return {
    ok: true,
    verified,
    mode: secret ? 'signature' : 'no_secret',
    vk: {
      appId: safeParams.vk_app_id || '',
      userId: safeParams.vk_user_id || '',
      platform: safeParams.vk_platform || '',
      language: safeParams.vk_language || '',
    },
  };
}
