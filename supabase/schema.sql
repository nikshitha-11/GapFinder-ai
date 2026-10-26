-- Run in Supabase SQL editor. Embedding size 768 must match EMBED_MODEL output.
create extension if not exists vector;

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kind text not null check (kind in ('syllabus','notes','past_paper')),
  created_at timestamptz default now()
);
create table chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  document_id uuid not null references documents on delete cascade,
  content text not null,
  page int not null default 1,
  embedding vector(768)
);
create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create table topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null, description text default ''
);
create table questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  topic_id uuid not null references topics on delete cascade,
  question text not null, options jsonb not null, correct int not null, explanation text,
  source_chunk_id uuid references chunks on delete set null,
  created_at timestamptz default now()
);
create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  total int not null, score int not null, created_at timestamptz default now()
);
create table answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  attempt_id uuid not null references attempts on delete cascade,
  question_id uuid references questions on delete set null,
  topic_id uuid not null references topics on delete cascade,
  chosen int not null, is_correct boolean not null
);
create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  attempt_id uuid references attempts on delete cascade,
  data jsonb not null, created_at timestamptz default now()
);

-- Row level security: every user only sees their own rows
do $$ declare t text; begin
  foreach t in array array['documents','chunks','topics','questions','attempts','answers','plans'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "own rows" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Retrieval: cosine similarity search over the caller's own chunks
create or replace function match_chunks(query_embedding vector(768), match_count int, only_kinds text[] default null)
returns table (id uuid, content text, page int, doc_name text, kind text, similarity float)
language sql stable as $$
  select c.id, c.content, c.page, d.name, d.kind, 1 - (c.embedding <=> query_embedding) as similarity
  from chunks c join documents d on d.id = c.document_id
  where c.user_id = auth.uid() and (only_kinds is null or d.kind = any(only_kinds))
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
