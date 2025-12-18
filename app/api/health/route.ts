import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  const timestamp = new Date().toISOString();
  console.log(`[HEALTH] Health check at ${timestamp}`);
  console.error(`[HEALTH] Health check at ${timestamp}`); // Also to stderr
  
  return NextResponse.json({
    status: 'ok',
    timestamp,
    runtime: 'nodejs',
  });
}

