import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authEnabled, verifySessionToken } from "@/lib/session";

// Plaid calls the webhook without a session; it is verified by its own signature instead.
const PUBLIC_PATHS = ["/login", "/api/login", "/api/plaid/webhook", "/api/health"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p)) return NextResponse.next();

  // AUTH_MODE=proxy: the Home Cloud sign-in (Authelia forward auth in Traefik) sits in front
  // and sets Remote-User on every request it lets through. Traefik overwrites any client-sent
  // Remote-User, so its absence means the request didn't come through the sign-in.
  if (process.env.AUTH_MODE === "proxy") {
    if (req.headers.get("remote-user")) return NextResponse.next();
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Not signed in" }, { status: 401 })
      : new NextResponse("Sign in through the Home Cloud sign-in.", { status: 401 });
  }

  if (!authEnabled()) {
    // Refuse to serve financial data publicly without a password in production.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("APP_PASSWORD is not set.", { status: 503 });
    }
    return NextResponse.next();
  }

  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
