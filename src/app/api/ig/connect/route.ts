import { IGBroker } from "@/lib/orb/broker";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/ig/connect  — read-only: verifies login and reports balance + the
// instrument's real minimum-trade economics. Credentials are used in-memory for
// this request only and never stored or logged.
export async function POST(request: Request) {
  try {
    const b = await request.json();
    const broker = new IGBroker({
      apiKey: b.apiKey,
      username: b.username,
      password: b.password,
      live: !!b.live,
      epic: b.epic || "IX.D.ASX.IFD.IP",
      currency: b.currency || "AUD",
      liveConfirmed: true, // connect is read-only; no orders are placed here
      placeRealOrders: false,
    });
    const account = await broker.getAccount();
    let market = null;
    try {
      market = await broker.marketInfo();
    } catch {
      /* market info is best-effort */
    }
    return Response.json({ ok: true, account, market });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "connect failed" }, { status: 400 });
  }
}
