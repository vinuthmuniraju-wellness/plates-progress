"""Builds index.html for the hosted version from the Claude-hosted app (app-src.html)."""
import re, pathlib
HERE = pathlib.Path(__file__).resolve().parent
src = (HERE/"app-src.html").read_text()
over = (HERE/"hosted-overrides.js").read_text()

cut = src.index("</style>") + len("</style>")
head_src, body_src = src[:cut], src[cut:]
head_src = head_src.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "")

R = [
 # user-facing wording: Google sign-in instead of Claude
 ("Reconnect Google Drive in Claude (Settings → Connectors).", "Your Google session expired. Tap to sign in again."),
 ("Your data lives in your own Google Drive. If Claude asks to allow Google Drive for this app, choose Allow.", "Your data lives in your own Google Drive."),
 ("Your Google sign-in has expired. Reconnect Google Drive in Claude (Settings → Connectors), then try again.", "Your Google sign-in has expired. Continue with Google to sign in again."),
 ("Connect Google Drive in Claude (Settings → Connectors), sign in with your Google account, then try again.", "Continue with Google and allow access to Google Drive when asked."),
 ("Open this page in Claude while signed in to see and update your own data. Nothing personal is shown here without a sign-in.", "Sign in with your Google account to see and update your own data. Everything is saved in your own Google Drive, and nothing personal is shown here without a sign-in."),
 ("Reading files needs this page open in Claude. You can still add exercises by hand below.", "Reading files needs the AI helper, which isn't set up on this site. You can still add exercises by hand below."),
 ('"Asking Claude…":"Fresh ideas from Claude"', '"Thinking…":"Fresh recipe ideas"'),
 (">New from Claude<", ">New idea<"),
 ("Downloads aren't available in this view. Open the page in Claude to export.", "Your browser blocked the download."),
 ("Connect Google Drive in Claude (Settings → Connectors), sign in with your Google account, then try again. The profile was not created.", "Continue with Google and allow Google Drive access, then try again. The profile was not created."),
 ("Reconnect Google Drive in Claude (Settings → Connectors), then try again. The profile was not created.", "Sign in with Google again, then try again. The profile was not created."),
 ("Pick one when Claude asks, then try again.", "Pick one when asked, then try again."),
 ("Open this page inside Claude (web, desktop or mobile app) so it can ask for access to your Google Drive. The profile was not created.", "Sign in with Google first. The profile was not created."),
 ("Open the page in Claude to sync with Google Drive.", "Sign in with Google to sync."),
 ("Reconnect Google Drive in Claude (Settings → Connectors), then tap Sync now.", "Sign in with Google again, then tap Sync now."),
 ("Open this page inside Claude so it can ask for access to your Google Drive.", "Sign in with Google first."),
 ("Claude didn't return any new recipes this time. Try again.", "No new recipes came back this time. Try again."),
 ("Claude is busy for you right now. Try again in a few minutes.", "The AI helper is busy right now. Try again in a few minutes."),
 ("Reading files uses Claude on your account. Allow it when Claude asks, then upload again.", "The AI helper isn't available right now. Fill the fields in by hand."),
 ("Claude isn't available on this account, so files can't be read. Fill the fields in by hand.", "The AI helper isn't set up on this site, so files can't be read. Fill the fields in by hand."),
 ("Claude couldn't read this file. Try a different copy.", "This file couldn't be read. Try a different copy."),
 ("Ask the admin for a one-time access code and enter it here. Each code works for one person.", "Ask the admin for an access code made for your Google account and enter it here."),
 # sign-in / sign-out buttons on the lock screen and header
 ("""${nd||er?`<button class="primary" data-act="retryBoot">Try again</button>`:""}""",
  """${er?`<button class="primary" data-act="retryBoot">Try again</button>`:`<button class="gbtn" data-act="gsignin"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continue with Google</button>`}"""),
 ("""      <span class="store-badge" id="storeBadge">Loading…</span>""",
  """      <button class="ghost signout" id="signOutBtn" data-act="gsignout" hidden>Sign out</button>
    <span class="store-badge" id="storeBadge">Loading…</span>"""),
 ("""    <span class="store-badge" id="storeBadge">Loading…</span>""",
  """    <button class="ghost signout" id="signOutBtn" data-act="gsignout" hidden>Sign out</button>
    <span class="store-badge" id="storeBadge">Loading…</span>"""),
 # events
 ("""  else if(a==="driveRetry"){driveSaveNow()}""",
  """  else if(a==="driveRetry"){if(PP.tokenExpired()){try{await PP.signIn()}catch(e){toast(e.message||"Sign-in didn't finish.");return}}driveSaveNow()}
  else if(a==="gsignin"){try{await PP.signIn()}catch(e){toast(e.message||"Sign-in didn't finish.");return}UI.locked=null;document.body.classList.remove("locked");bootApp()}
  else if(a==="gsignout"){PP.signOut()}
  else if(a==="copyLine"){const t=$("#codeLine");try{await navigator.clipboard.writeText(t.value);toast("Line copied")}catch(e){t.select();toast("Line selected. Copy it with your keyboard.")}}"""),
 ("""  const m=$("#main"); const p=P(); paintSync();""",
  """  const m=$("#main"); const p=P(); paintSync(); const so=$("#signOutBtn"); if(so) so.hidden=!PP.signedIn;"""),
]
out = body_src
for a, b in R:
    n = out.count(a)
    if n == 0:
        print("SKIP (not found):", a[:70]); continue
    out = out.replace(a, b)
mk = "/* ============ Rendering ============ */"
assert out.count(mk) == 1
out = out.replace(mk, over + "\n" + mk, 1)
out = out.replace("@media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important}}\n</style>", "</style>")  # (no-op in body)

extra_css = """<style>
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",sans-serif}
img{max-width:100%}
[hidden]{display:none!important}
.gbtn{display:inline-flex;align-items:center;gap:10px;background:#fff;color:#1f1f1f;border:1px solid #dadce0;border-radius:999px;padding:11px 20px;font:600 .95rem var(--f-body);box-shadow:0 1px 2px rgb(0 0 0 / .08)}
.gbtn:hover{background:#f8f9fa;border-color:#c6c9cc}
.signout{font-size:.8rem;padding:5px 10px}
</style>"""
head = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Food log, diet plans, water and workouts. Your data stays in your own Google Drive.">
<meta name="theme-color" content="#0c8f6a">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Plate &amp; Progress">
{extra_css}
{head_src}
<script src="config.js"></script>
<script src="platform.js"></script>
<script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>"""
html = head + out + "\n</body>\n</html>\n"
(HERE.parent/"index.html").write_text(html)
print("built index.html", len(html)//1024, "KB")
