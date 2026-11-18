const PAGE_SIZE = 16;
const MAX_BODY_BYTES = 220_000;
const MAX_NOTE_LENGTH = 200;
const PNG_PREFIX = "data:image/png;base64,";
const UUID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

const isDrawing = (value) => {
  if (typeof value !== "string" || !value.startsWith(PNG_PREFIX)) return false;
  const png = value.slice(PNG_PREFIX.length);
  if (!/^[\dA-Za-z+/]+={0,2}$/.test(png) || png.length % 4 !== 0) return false;

  const header = atob(png.slice(0, 32));
  return (
    header.startsWith("\x89PNG\r\n\x1a\n\0\0\0\rIHDR") &&
    header.slice(16, 24) === "\0\0\x01\x18\0\0\x01\x18"
  );
};

const readSubmission = async (request) => {
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return undefined;
    }
    body += decoder.decode(value, { stream: true });
  }

  try {
    const { drawing, id, note } = JSON.parse(body + decoder.decode()) || {};
    if (
      typeof id !== "string" ||
      !UUID.test(id) ||
      typeof note !== "string" ||
      note.length > MAX_NOTE_LENGTH ||
      !isDrawing(drawing)
    )
      return undefined;

    return { drawing, id, note: note.trim() };
  } catch {
    return undefined;
  }
};

const publicFlower = ({ drawing, id, note }) => ({ drawing, id, note });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((item) =>
      item.trim()
    );
    const headers = new Headers({
      "Cache-Control": "no-store",
      Vary: "Origin",
    });
    const json = (data, status = 200) =>
      Response.json(data, { headers, status });

    if (url.pathname !== "/flowers") return json({ error: "Not found." }, 404);
    if (origin) {
      if (!allowedOrigins.includes(origin))
        return json({ error: "Origin not allowed." }, 403);
      headers.set("Access-Control-Allow-Origin", origin);
    }

    if (request.method === "OPTIONS") {
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      return new Response(null, { headers, status: 204 });
    }

    try {
      if (request.method === "GET") {
        const before = Number(
          url.searchParams.get("before") ?? Number.MAX_SAFE_INTEGER
        );
        if (!Number.isSafeInteger(before) || before < 1) {
          return json({ error: "Invalid page cursor." }, 400);
        }
        const { results } = await env.FLOWERS.prepare(
          "SELECT sequence, id, drawing, note FROM flowers WHERE sequence < ? ORDER BY sequence DESC LIMIT ?"
        )
          .bind(before, PAGE_SIZE + 1)
          .all();
        return json({
          flowers: results.slice(0, PAGE_SIZE).map(publicFlower),
          nextCursor:
            results.length > PAGE_SIZE ? results[PAGE_SIZE - 1].sequence : null,
        });
      }

      if (request.method !== "POST") {
        headers.set("Allow", "GET, POST, OPTIONS");
        return json({ error: "Method not allowed." }, 405);
      }
      if (!origin) return json({ error: "Origin required." }, 403);
      if (
        request.headers.get("Content-Type")?.split(";")[0] !==
        "application/json"
      ) {
        return json({ error: "Expected a JSON submission." }, 415);
      }

      const { success } = await env.SUBMISSIONS.limit({
        key: request.headers.get("CF-Connecting-IP") || "local",
      });
      if (!success)
        return json(
          { error: "Please wait a minute before adding another flower." },
          429
        );

      const flower = await readSubmission(request);
      if (!flower)
        return json({ error: "Invalid or oversized drawing or note." }, 400);

      const saved = await env.FLOWERS.prepare(
        "INSERT INTO flowers (id, drawing, note) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING id, drawing, note"
      )
        .bind(flower.id, flower.drawing, flower.note)
        .first();
      if (saved) return json(publicFlower(saved), 201);

      // A retry may follow a successful write whose response never reached the visitor.
      const existing = await env.FLOWERS.prepare(
        "SELECT id, drawing, note FROM flowers WHERE id = ?"
      )
        .bind(flower.id)
        .first();
      if (
        existing?.drawing === flower.drawing &&
        existing.note === flower.note
      ) {
        return json(publicFlower(existing));
      }
      return json({ error: "That submission ID is already in use." }, 409);
    } catch (error) {
      console.error(
        "Flower vase request failed",
        error instanceof Error ? error.name : "unknown"
      );
      return json(
        { error: "The shared vase is temporarily unavailable." },
        503
      );
    }
  },
};
