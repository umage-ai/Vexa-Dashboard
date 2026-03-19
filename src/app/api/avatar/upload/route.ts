// [LOCAL-FORK] Avatar proxy — routes to bot-manager directly (not through API gateway)
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

function getBotManagerUrl() {
  return process.env.BOT_MANAGER_URL || "http://bot-manager:8080";
}

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("vexa-token")?.value;
}

export async function GET() {
  const token = await getToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const resp = await fetch(`${getBotManagerUrl()}/user/avatar`, {
      headers: { "X-API-Key": token },
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    return NextResponse.json({ avatar_url: null });
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const contentType = request.headers.get("content-type") || "";
    let backendResponse: Response;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      const backendFormData = new FormData();
      backendFormData.append("file", file);

      backendResponse = await fetch(`${getBotManagerUrl()}/user/avatar`, {
        method: "POST",
        headers: { "X-API-Key": token },
        body: backendFormData,
      });
    } else {
      // JSON body with image_url (for preset avatars)
      const body = await request.json();
      const imageUrl = body.image_url;
      if (!imageUrl) {
        return NextResponse.json({ error: "No image_url provided" }, { status: 400 });
      }

      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        return NextResponse.json({ error: "Failed to fetch preset image" }, { status: 400 });
      }
      const imageBlob = await imageResponse.blob();
      const fileName = imageUrl.split("/").pop() || "avatar.png";

      const backendFormData = new FormData();
      backendFormData.append("file", new File([imageBlob], fileName, { type: imageBlob.type }));

      backendResponse = await fetch(`${getBotManagerUrl()}/user/avatar`, {
        method: "POST",
        headers: { "X-API-Key": token },
        body: backendFormData,
      });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { status: backendResponse.status });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar", details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const token = await getToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const resp = await fetch(`${getBotManagerUrl()}/user/avatar`, {
      method: "DELETE",
      headers: { "X-API-Key": token },
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete avatar" }, { status: 500 });
  }
}
