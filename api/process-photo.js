// api/process-photo.js
import fetch from "node-fetch";

function dataURLtoBlob(dataUrl) {
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error("Invalid data URL");
  const mime = match[1];
  const b64 = match[2];
  const bytes = Uint8Array.from(Buffer.from(b64, "base64"));
  return new Blob([bytes], { type: mime });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { image, prompt, size } = req.body;
    if (!image) return res.status(400).json({ error: "Missing image (data URL)" });

    const blob = dataURLtoBlob(image);
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", prompt || "Enhance quality, denoise, sharpen, upscale");
    form.append("size", size || "1024x1024");
    form.append("n", "1");
    form.append("image", new File([blob], "input.png", { type: blob.type || "image/png" }));

    const r = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: form,
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(500).json({ error: "Upstream error", detail: text });
    }

    const data = await r.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return res.status(500).json({ error: "No image in response" });

    return res.status(200).json({ processedImage: `data:image/png;base64,${b64}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
