import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncSimpleFin } from "@/lib/server/simplefin-service";

export const runtime = "nodejs";

function matchesSecret(value: string, expected: string) {
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || !authorization?.startsWith("Bearer ") || !matchesSecret(authorization.slice(7), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncSimpleFin();
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false, error: "SimpleFIN sync failed." }, { status: 500 });
  }
}

