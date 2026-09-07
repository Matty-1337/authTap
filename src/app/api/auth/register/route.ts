import { NextResponse } from "next/server";
import { clientContextFrom, dkRegister } from "@/lib/dk-auth";
import { writeSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    turnstileToken?: string;
  };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Use at least 8 characters." }, { status: 400 });
  }

  const result = await dkRegister(email, password, clientContextFrom(request, body.turnstileToken ?? ""));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const session = await writeSession({ token: result.token, user: result.user });
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
