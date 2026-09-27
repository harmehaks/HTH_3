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

export function authErrorPage({ clientID, exchangeDenied }) {
  const explanation = exchangeDenied
    ? 'Auth0 rejected the application while exchanging the login code. A mismatched application client secret is a likely cause. Your account password and the application client secret are different credentials.'
    : 'Auth0 could not complete this sign-in. Check the latest failure in Auth0 Monitoring → Logs for the specific cause.';
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
<p>${explanation}</p>
<ol>
<li>In Auth0, open the Regular Web Application with client ID <code>${escapeHTML(clientID)}</code>.</li>
<li>Copy that application's client secret into <code>AUTH0_CLIENT_SECRET</code> in your local <code>.env</code>. Keep it private.</li>
<li>Confirm its token endpoint authentication method is <strong>Post</strong> and the <strong>Authorization Code</strong> grant is enabled.</li>
<li>Restart the project, then begin a fresh sign-in. If it still fails, inspect Auth0 <strong>Monitoring → Logs</strong> for the latest failure description.</li>
</ol>
<div class="actions"><a class="primary" href="/login">Try sign-in again</a><a href="/">Back to the app</a></div>
<p class="note">No authenticated session was granted by this failed callback. Never share your password, client secret, login code or full callback URL.</p>
</main></body></html>`;
}
