import { NextResponse } from "next/server";
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  const authUser = await getAuthUser(new Request(''));
  if (!authUser || authUser.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ message: "Hello, world!" });
}