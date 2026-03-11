// src/app/api/invite/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, invitedBy } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

    const res = await fetch(`${baseUrl}/api/auth/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'invite', email, invitedBy }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data?.error ?? 'Error al invitar.' }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 });
  }
}
