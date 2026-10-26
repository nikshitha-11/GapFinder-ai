import { wrap } from "@/lib/server";
import { ingest, textToPages } from "@/lib/ingest";
import { extractText, getDocumentProxy } from "unpdf";
export const maxDuration = 60;

export const POST = wrap(async (req, { sb, user }) => {
  const f = await req.formData();
  const file = f.get("file") as File | null;
  const kind = String(f.get("kind") || "notes");
  if (!file) throw new Error("Choose a file to upload.");
  let pages: string[];
  if (file.name.toLowerCase().endsWith(".pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    pages = (await extractText(pdf, { mergePages: false })).text;
  } else pages = textToPages(await file.text());
  return ingest(sb, user.id, file.name, kind, pages);
});
