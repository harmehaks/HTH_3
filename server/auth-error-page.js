const escapeHTML = (value) =>
  String(value || '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  );

export function diagnoseAuthError(error, { code, providerError } = {}) {
  const message = String(error.message || '');
  const known = [
    'access_denied',
    'invalid_client',
    'unauthorized_client',
    'invalid_grant',
    'invalid_request',
    'server_error',
    'temporarily_unavailable',
    'login_required',
    'consent_required',
  ];
  const providerCode = known.includes(error.error) ? error.error : undefined;
  const result = (diagnostic, explanation, recovery) => ({
    code: diagnostic,
    explanation,
    recovery,
    providerCode,
  });
  if (/cookie not found|checks\.state argument is missing|missing.*state.*cookie/i.test(message))
    return result(
      'AUTH0_TRANSACTION_MISSING',
      'The temporary sign-in cookie is missing or no longer valid. This can happen after refreshing a callback, switching between localhost and 127.0.0.1, or starting overlapping sign-ins.',
      'fresh',
    );
  if (/state mismatch|state.*does not match/i.test(message))
    return result(
      'AUTH0_STATE_MISMATCH',
      'This callback does not match the latest sign-in attempt. Start a fresh sign-in in one browser tab.',
      'fresh',
    );
  if (/nonce mismatch|nonce.*does not match/i.test(message))
    return result(
      'AUTH0_NONCE_MISMATCH',
      'The returned identity token does not match this sign-in attempt. Start a fresh sign-in in one browser tab.',
      'fresh',
    );
  if (providerError)
    return result(
      'AUTH0_PROVIDER_DENIED',
      'Auth0 declined the sign-in before a login code was exchanged. Check the latest Auth0 log and any Login Actions for the reason.',
      'logs',
    );
  if (code && ['access_denied', 'invalid_client', 'unauthorized_client'].includes(providerCode))
    return result(
      'AUTH0_CLIENT_REJECTED',
      'Auth0 rejected the application while exchanging the login code. A mismatched application client secret is a likely cause. Your account password and the application client secret are different credentials.',
      'credentials',
    );
  if (providerCode === 'invalid_grant')
    return result(
      'AUTH0_CODE_REJECTED',
      'Auth0 rejected the login code. It may have expired, already been used, or failed verification. Start a fresh sign-in rather than refreshing this callback.',
      'fresh',
    );
  if (/signature|jwt|issuer|audience|id.token/i.test(message))
    return result(
      'AUTH0_TOKEN_INVALID',
      'The SDK could not validate the returned identity token. Check the tenant and application settings and the latest Auth0 log.',
      'logs',
    );
  if (/timeout|timed out|ENOTFOUND|ECONN|ETIMEDOUT|EACCES|fetch failed/i.test(message))
    return result(
      'AUTH0_NETWORK_FAILURE',
      'The server could not reach Auth0 to complete sign-in. Check network access, then start a fresh sign-in.',
      'fresh',
    );
  return result(
    'AUTH0_CALLBACK_FAILED',
    'Auth0 could not complete this sign-in. Check the latest failure in Auth0 Monitoring → Logs for the specific cause.',
    'logs',
  );
}

export function authErrorPage({ clientID, baseURL, diagnostic }) {
  const origin = new URL(baseURL).origin;
  const steps =
    diagnostic.recovery === 'credentials'
      ? `<li>In Auth0, open the Regular Web Application with client ID <code>${escapeHTML(clientID)}</code>.</li>
<li>Copy that application's client secret into <code>AUTH0_CLIENT_SECRET</code> in your local <code>.env</code>. Keep it private.</li>
<li>In the application's <strong>Credentials</strong> tab, select <strong>Client Secret (Post)</strong> and save. In Settings → Advanced Settings → Grant Types, confirm <strong>Authorization Code</strong> is enabled.</li>
<li>Restart the project, then begin a fresh sign-in.</li>`
      : diagnostic.recovery === 'fresh'
        ? `<li>Open <code>${escapeHTML(origin)}</code> and start sign-in from there.</li>
<li>Use one browser tab and allow cookies for that address.</li>
<li>Choose <strong>Try sign-in again</strong>. Avoid refreshing or going back to an earlier callback.</li>`
        : `<li>Start a fresh sign-in from <code>${escapeHTML(origin)}</code>.</li>
<li>If it fails again, inspect Auth0 <strong>Monitoring → Logs</strong> for the latest event type and Description.</li>
<li>Share the diagnostic code below and the log description to identify the failing step.</li>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign-in needs attention · Mr. Redactor</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f6f3eb;color:#23332c;font:16px/1.6 system-ui,sans-serif;padding:40px 20px}
main{max-width:680px;margin:6vh auto;background:#fffdf7;border:1px solid #dcded4;border-radius:20px;padding:clamp(24px,5vw,48px);box-shadow:0 16px 64px #22332c0c}
.brand{font-weight:700;letter-spacing:-.03em}h1{font-size:clamp(28px,5vw,38px);line-height:1.2;letter-spacing:-.04em}p,li{color:#4a574e}li{margin:12px 0}code{overflow-wrap:anywhere;background:#edf0e8;padding:3px 5px;border-radius:4px}ol{padding-left:22px}
.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}a{display:inline-block;text-decoration:none;border:1px solid #ccd3c6;border-radius:9px;padding:11px 18px;color:#23332c;font-weight:600}a.primary{background:#25392d;color:white;border-color:#25392d}.note{font-size:14px;margin-top:24px}
</style></head><body><main>
<div class="brand">Mr. Redactor.</div><h1>Sign-in needs attention.</h1>
<p>${diagnostic.explanation}</p>
<ol>
${steps}
</ol>
<p class="note">Diagnostic: <code>${diagnostic.code}</code></p>
<div class="actions"><a class="primary" href="${escapeHTML(origin)}/login">Try sign-in again</a><a href="${escapeHTML(origin)}/">Back to the app</a></div>
<p class="note">No authenticated session was granted by this failed callback. Never share your password, client secret, login code or full callback URL.</p>
</main></body></html>`;
}
