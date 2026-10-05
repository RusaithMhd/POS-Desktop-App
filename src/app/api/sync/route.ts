import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET() {
  return NextResponse.json({ status: 'ok', mockServer: 'offline-first' });
}

// In-memory server transaction deduplication registry for server mock idempotency
const processedClientTransactions = new Set<string>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientTransactionId, entityType, entityId, operation, payload } = body;

    if (!clientTransactionId) {
      return NextResponse.json({ success: false, error: 'Missing clientTransactionId idempotency key' }, { status: 400 });
    }

    // IDEMPOTENCY CHECK: If transaction has already been committed to cloud, acknowledge without duplicating!
    if (processedClientTransactions.has(clientTransactionId)) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: `Transaction ${clientTransactionId} already synchronized and committed on server.`,
      });
    }

    // Process & store server side
    processedClientTransactions.add(clientTransactionId);

    return NextResponse.json({
      success: true,
      idempotent: false,
      serverTimestamp: new Date().toISOString(),
      clientTransactionId,
      message: `Entity ${entityType} (${entityId}) committed to PostgreSQL successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
