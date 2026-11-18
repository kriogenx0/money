import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authEnabled, verifySessionToken } from "@/lib/session";

// Plaid calls the webhook without a session; it is verified by its own signature instead.
const PUBLIC_PATHS = ["/login", "/api/login", "/api/plaid/webhook", "/api/health"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p)) return NextResponse.next();

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
