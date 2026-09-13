export function getPublicAppUrl() {
  const configuredUrl = process.env.PUBLIC_APP_URL?.trim();

  if (!configuredUrl) {
    throw new Error(
      "PUBLIC_APP_URL must be set before sending public certificate links.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error("PUBLIC_APP_URL must be a valid absolute URL.");
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error("PUBLIC_APP_URL must use HTTP or HTTPS.");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("PUBLIC_APP_URL must not contain URL credentials.");
  }

  return configuredUrl.replace(/\/+$/, "");
}