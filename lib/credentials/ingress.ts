import "server-only";

import { NextResponse } from "next/server";

import { resolveRegistrationCredential } from "@/lib/credentials/repository";
import {
  shouldIssueCredentialSession,
  toSessionPayload,
} from "@/lib/credentials/public-outcome";
import {
  createCredentialSessionValue,
  credentialSessionCookieOptions,
  isCredentialSessionConfigured,
} from "@/lib/credentials/session";
import { applyCredentialSecurityHeaders } from "@/lib/credentials/security-headers";
import {
  CREDENTIAL_UNAVAILABLE_MESSAGE,
  CREDENTIAL_SUPPORT_INSTRUCTIONS,
} from "@/lib/credentials/public-copy";
import { isValidCredentialToken } from "@/lib/credentials/token";
import {
  enforceCredentialIngressRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/rate-limit";
import { safeErrorMessage } from "@/lib/security/redact";

export function buildCleanCredentialUrl(requestUrl: string): URL {
  return new URL("/c", requestUrl);
}

export function isMalformedIngressToken(rawToken: unknown): boolean {
  return typeof rawToken !== "string" || !isValidCredentialToken(rawToken);
}

export async function handleCredentialIngress(
  request: Request,
  rawToken: string,
): Promise<NextResponse> {
  const cleanUrl = buildCleanCredentialUrl(request.url);

  const rate = await enforceCredentialIngressRateLimit(request);
  if (!rate.allowed) {
    return applyCredentialSecurityHeaders(
      new NextResponse("Too many requests. Please try again shortly.", {
        status: 429,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          ...rateLimitResponseHeaders(rate),
        },
      }),
    );
  }

  if (isMalformedIngressToken(rawToken)) {
    return applyCredentialSecurityHeaders(NextResponse.redirect(cleanUrl, 303));
  }

  if (!isCredentialSessionConfigured()) {
    return credentialServiceUnavailableResponse();
  }

  try {
    const resolution = await resolveRegistrationCredential(rawToken);

    if (!shouldIssueCredentialSession(resolution)) {
      return applyCredentialSecurityHeaders(NextResponse.redirect(cleanUrl, 303));
    }

    const sessionValue = createCredentialSessionValue(
      toSessionPayload(resolution),
    );
    const response = NextResponse.redirect(cleanUrl, 303);
    const cookie = credentialSessionCookieOptions();
    response.cookies.set({
      ...cookie,
      value: sessionValue,
    });
    return applyCredentialSecurityHeaders(response);
  } catch (error) {
    console.error("[CREDENTIAL_INGRESS_ERROR]", safeErrorMessage(error));
    return credentialServiceUnavailableResponse();
  }
}

function credentialServiceUnavailableResponse(): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <title>Credential unavailable</title>
</head>
<body style="margin:0;background:#050507;color:#f5f7fb;font-family:system-ui,sans-serif;">
  <main style="max-width:24rem;margin:0 auto;padding:1.5rem 1rem 2rem;line-height:1.5;font-size:18px;">
    <h1 style="font-size:1.5rem;margin:0 0 0.75rem;">Credential unavailable</h1>
    <p style="margin:0 0 1rem;">${CREDENTIAL_UNAVAILABLE_MESSAGE}</p>
    <p style="margin:0;">${CREDENTIAL_SUPPORT_INSTRUCTIONS}</p>
  </main>
</body>
</html>`;

  return applyCredentialSecurityHeaders(
    new NextResponse(html, {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    }),
  );
}
