import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export function GET() { return NextResponse.json({ url: process.env.SUPABASE_URL || '', anonKey: process.env.SUPABASE_ANON_KEY || '', vapidPublicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '' }); }
