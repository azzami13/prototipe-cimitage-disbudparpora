import { NextRequest, NextResponse } from 'next/server';
import { dispatch } from '@/demo/handlers';
import { HttpError } from '@/demo/engine';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handle(req: NextRequest, ctx: { params: { path: string[] } }) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
    return NextResponse.json({ message: 'Mode demo tidak aktif (NEXT_PUBLIC_DEMO_MODE != true)' }, { status: 404 });
  }
  const pathname = '/' + ctx.params.path.join('/');
  try {
    const out: any = await dispatch(req.method, pathname, req.nextUrl.searchParams, req.headers.get('authorization'), req);
    if (out?.__csv) return new NextResponse(out.__csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="laporan-operasional.csv"' } });
    if (out?.__file) {
      const url: string = out.__file;
      if (url.startsWith('data:')) {
        const [meta, b64] = url.split(',');
        return new NextResponse(Buffer.from(b64, 'base64'), { headers: { 'content-type': meta.slice(5).replace(';base64', '') } });
      }
      const file = path.join(process.cwd(), 'public', url);
      return new NextResponse(fs.readFileSync(file), { headers: { 'content-type': url.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' } });
    }
    return NextResponse.json(out ?? null, { headers: { 'cache-control': 'no-store' } });
  } catch (e: any) {
    if (e instanceof HttpError) return NextResponse.json({ message: e.message, code: e.code, statusCode: e.status }, { status: e.status });
    console.error('[demo-api]', pathname, e);
    return NextResponse.json({ message: 'Kesalahan internal demo: ' + (e?.message ?? e) }, { status: 500 });
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
