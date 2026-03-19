// [LOCAL-FORK] Proxies the user's avatar image from MinIO (internal) to the browser
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const BOT_MANAGER_URL = process.env.BOT_MANAGER_URL || "http://bot-manager:8080";
  const cookieStore = await cookies();
  const token = cookieStore.get("vexa-token")?.value;

  if (!token) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    // Get the avatar URL from bot-manager
    const resp = await fetch(`${BOT_MANAGER_URL}/user/avatar`, {
      headers: { "X-API-Key": token },
    });
    const data = await resp.json();
    const avatarUrl = data.avatar_url;
    if (!avatarUrl) {
      return new NextResponse(null, { status: 404 });
    }

    // Fetch the image from MinIO (internal network)
    const imageResp = await fetch(avatarUrl);
    if (!imageResp.ok) {
      return new NextResponse(null, { status: 404 });
    }

    const imageBuffer = await imageResp.arrayBuffer();
    const contentType = imageResp.headers.get("content-type") || "image/png";

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
