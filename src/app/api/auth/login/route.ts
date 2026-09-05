import { NextResponse } from "next/server";
import { dkLogin } from "@/lib/dk-auth";
import { writeSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const result = await dkLogin(email, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const session = await writeSession({ token: result.token, user: result.user });
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
