// [LOCAL-FORK] Summary proxy — routes to bot-manager directly (not through API gateway)
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BOT_MANAGER_URL = process.env.BOT_MANAGER_URL || "http://bot-manager:8080";

async function proxyToBotManager(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string,
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vexa-token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { path } = await params;
  const pathString = path.join("/");
  const url = `${BOT_MANAGER_URL}/${pathString}`;

  const headers: Record<string, string> = {
    "X-API-Key": token,
  };

  try {
    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (method !== "GET" && method !== "HEAD") {
      const contentType = request.headers.get("content-type");
      if (contentType) headers["Content-Type"] = contentType;
      const body = await request.text();
      if (body) fetchOptions.body = body;
    }

    const response = await fetch(url, { ...fetchOptions, signal: AbortSignal.timeout(120000) });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`Summary proxy error for ${method} ${url}:`, error);
    return NextResponse.json(
      { error: "Failed to connect to bot-manager", details: (error as Error).message },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyToBotManager(req, params, "GET");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyToBotManager(req, params, "POST");
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyToBotManager(req, params, "PUT");
}
