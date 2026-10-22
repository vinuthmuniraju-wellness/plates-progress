/* Plate & Progress — site settings. Edit these, then commit. */
window.PP_CONFIG = {
  /* Google Cloud → APIs & Services → Credentials → OAuth 2.0 Client ID (type: Web application).
     Looks like 1234567890-abc123.apps.googleusercontent.com */
  GOOGLE_CLIENT_ID: "1072802695588-e9f0hoh6qdenjss662ffibaq5lhirefv.apps.googleusercontent.com",

  /* The admin's Google account. This person always has the Workout tab and sees the admin panel for access codes. */
  ADMIN_EMAIL: "vinuthmuniraju@gmail.com",

  /* Optional: the address of your AI helper (the Cloudflare Worker in /worker).
     Leave empty to switch off the AI features (reading PDFs/photos, recipe ideas, nutrition lookup). */
  AI_ENDPOINT: "",

  /* Optional: link to edit access-codes.json on GitHub, shown in the admin panel.
     e.g. https://github.com/YOUR-NAME/plate-progress/edit/main/access-codes.json */
  ACCESS_FILE_EDIT_URL: "https://github.com/vinuthmuniraju-wellness/plate-progress/edit/main/access-codes.json"
};
