import { chunkPages } from "./chunk";
import { embed, gen } from "./ai";

// Convert text into pages for processing.
export function textToPages(t: string): string[] {
  const byFF = t.split("\f");

  if (byFF.length > 1) {
    return byFF;
  }

  const pages: string[] = [];
  let cur = "";

  for (const para of t.split(/\n\s*\n/)) {
    if (cur.length + para.length > 2500 && cur) {
      pages.push(cur);
      cur = "";
    }

    cur += para + "\n\n";
  }

  if (cur.trim()) {
    pages.push(cur);
  }

  return pages;
}

// Upload -> chunk -> embed -> store.
// A syllabus additionally produces the topic map.
export async function ingest(
  sb: any,
  uid: string,
  name: string,
  kind: string,
  pages: string[]
) {
  const chunks = chunkPages(pages);

  if (!chunks.length) {
    throw new Error(
      "No readable text found. Scanned PDFs are not supported; upload a text-based PDF or .txt file."
    );
  }

  // Save the document with the authenticated user's ID.
  const { data: doc, error } = await sb
    .from("documents")
    .insert({
      user_id: uid,
      name,
      kind,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Generate embeddings for document chunks.
  const emb = await embed(chunks.map((c) => c.content));

  // Associate every chunk with its owner and document.
  const rows = chunks.map((c, i) => ({
    user_id: uid,
    document_id: doc.id,
    content: c.content,
    page: c.page,
    embedding: emb[i],
  }));

  // Insert chunks in batches.
  for (let i = 0; i < rows.length; i += 100) {
    const { error: chunkError } = await sb
      .from("chunks")
      .insert(rows.slice(i, i + 100));

    if (chunkError) {
      throw chunkError;
    }
  }

  let topics = 0;

  // Extract and save topics when the uploaded file is a syllabus.
  if (kind === "syllabus") {
    const text = pages.join("\n").slice(0, 30000);

    const out = await gen<{
      topics: {
        name: string;
        description: string;
      }[];
    }>(
      `Extract the topic structure from this syllabus. Return JSON {"topics":[{"name":"short topic name","description":"one sentence on what it covers"}]}. ` +
        `Between 4 and 12 topics, only topics actually present in the text.\n\nSYLLABUS:\n${text}`
    );

    const list = (out.topics || [])
      .filter((t) => t?.name)
      .slice(0, 12);

    if (!list.length) {
      throw new Error(
        "Could not find topics in this syllabus. Try a text-based file with a clear list of topics."
      );
    }

    // Replace only this user's topic list.
    const { error: deleteError } = await sb
      .from("topics")
      .delete()
      .eq("user_id", uid);

    if (deleteError) {
      throw deleteError;
    }

    const { error: insertError } = await sb
      .from("topics")
      .insert(
        list.map((t) => ({
          user_id: uid,
          name: t.name,
          description: t.description || "",
        }))
      );

    if (insertError) {
      throw insertError;
    }

    topics = list.length;
  }

  return {
    document: doc.id,
    chunks: chunks.length,
    topics,
  };
}