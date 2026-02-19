-- Create a table for news daily digest (analysis results)
CREATE TABLE IF NOT EXISTS public.news_daily_digest (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL,              -- 'nacional', 'espanol', 'anglo'
  digest_date date NOT NULL DEFAULT CURRENT_DATE,
  clusters jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_article_count int DEFAULT 0,
  cluster_count int DEFAULT 0,
  processing_status text DEFAULT 'pending', -- 'pending', 'complete', 'error'
  error_message text,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(scope, digest_date)        -- Only 1 digest per scope per day
);

ALTER TABLE public.news_daily_digest ENABLE ROW LEVEL SECURITY;

-- Everyone can read news daily digest (public facing)
CREATE POLICY "Public read access for news_daily_digest"
  ON public.news_daily_digest
  FOR SELECT
  USING (true);

-- Only service role (backend) should insert/update ideally
CREATE POLICY "Service role can insert/update news_daily_digest"
  ON public.news_daily_digest
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
