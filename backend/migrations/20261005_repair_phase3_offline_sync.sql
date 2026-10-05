-- Repair Phase 3. Apply AFTER Security Phase 2; do not deploy automatically.
BEGIN;
CREATE TABLE IF NOT EXISTS public.learning_sync_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  epoch TEXT NOT NULL DEFAULT 'initial', revision BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.learning_sync_entities (
  user_id UUID NOT NULL REFERENCES public.learning_sync_accounts(user_id) ON DELETE CASCADE,
  entity_key TEXT NOT NULL, payload JSONB NOT NULL, revision BIGINT NOT NULL,
  device TEXT NOT NULL, sequence BIGINT NOT NULL,
  PRIMARY KEY(user_id,entity_key)
);
CREATE TABLE IF NOT EXISTS public.learning_sync_receipts (
  user_id UUID NOT NULL REFERENCES public.learning_sync_accounts(user_id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL, operation JSONB NOT NULL,
  PRIMARY KEY(user_id,operation_id)
);
CREATE TABLE IF NOT EXISTS public.learning_sync_versions (
  user_id UUID NOT NULL REFERENCES public.learning_sync_accounts(user_id) ON DELETE CASCADE,
  entity_key TEXT NOT NULL, device TEXT NOT NULL, sequence BIGINT NOT NULL,
  PRIMARY KEY(user_id,entity_key,device)
);
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['learning_sync_accounts','learning_sync_entities','learning_sync_receipts','learning_sync_versions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',t);
    EXECUTE format('DROP POLICY IF EXISTS own_learning_read ON public.%I',t);
    EXECUTE format('CREATE POLICY own_learning_read ON public.%I FOR SELECT TO authenticated USING (user_id=auth.uid() AND ingly_private.active_account())',t);
  END LOOP;
END $$;
-- Clients mutate through the bounded, idempotent RPC only.
GRANT SELECT ON public.learning_sync_accounts, public.learning_sync_entities TO authenticated;

CREATE OR REPLACE FUNCTION ingly_private.merge_learning_state(a JSONB,b JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE result JSONB := a || b; k TEXT; item RECORD; merged JSONB;
BEGIN
  FOREACH k IN ARRAY ARRAY['totalWordsLearned','reviewedWordsCount','hardWordsCount'] LOOP
    result := jsonb_set(result,ARRAY[k],to_jsonb(GREATEST(COALESCE((a->>k)::BIGINT,0),COALESCE((b->>k)::BIGINT,0))));
  END LOOP;
  FOREACH k IN ARRAY ARRAY['bookProgress','bookLearnedCounts'] LOOP
    merged := COALESCE(a->k,'{}'::JSONB);
    FOR item IN SELECT * FROM jsonb_each(COALESCE(b->k,'{}'::JSONB)) LOOP
      merged := jsonb_set(merged,ARRAY[item.key],to_jsonb(GREATEST(COALESCE((merged->>item.key)::NUMERIC,0),(item.value#>>'{}')::NUMERIC)));
    END LOOP;
    result := jsonb_set(result,ARRAY[k],merged);
  END LOOP;
  result := jsonb_set(result,ARRAY['completedUnits'],COALESCE(a->'completedUnits','{}'::JSONB)||COALESCE(b->'completedUnits','{}'::JSONB));
  IF COALESCE(a->>'lastActiveDate','') > COALESCE(b->>'lastActiveDate','') THEN
    result := result || jsonb_build_object('lastActiveDate',a->'lastActiveDate','wordsLearnedToday',a->'wordsLearnedToday','streakDays',a->'streakDays');
  ELSIF a->>'lastActiveDate'=b->>'lastActiveDate' THEN
    result := result || jsonb_build_object('wordsLearnedToday',GREATEST(COALESCE((a->>'wordsLearnedToday')::INT,0),COALESCE((b->>'wordsLearnedToday')::INT,0)),
      'streakDays',GREATEST(COALESCE((a->>'streakDays')::INT,0),COALESCE((b->>'streakDays')::INT,0)));
  END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION ingly_private.merge_learning_state(JSONB,JSONB) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.read_learning_sync(p_after_revision BIGINT DEFAULT 0)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor UUID := auth.uid(); account public.learning_sync_accounts%ROWTYPE; items JSONB;
BEGIN
  IF actor IS NULL OR NOT ingly_private.active_account() THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_after_revision IS NULL OR p_after_revision < 0 THEN RAISE EXCEPTION 'Invalid cursor' USING ERRCODE='22023'; END IF;
  INSERT INTO public.learning_sync_accounts(user_id) VALUES(actor) ON CONFLICT DO NOTHING;
  SELECT * INTO account FROM public.learning_sync_accounts WHERE user_id=actor FOR UPDATE;
  -- Bootstrap pre-Phase-3 server word state without replaying activity increments.
  IF account.revision=0 THEN
    INSERT INTO public.learning_sync_entities(user_id,entity_key,payload,revision,device,sequence)
      SELECT actor,'word:'||p.word_id,jsonb_build_object('word_id',p.word_id,'status',p.status,'completed',p.status='mastered',
        'review_count',p.review_count,'is_favorite',p.is_favorite,'last_reviewed_at',p.last_reviewed_at,
        'next_review_date',p.next_review_date,'book',((p.word_id-1)/600)+1,'unit',((p.word_id-1)%600)/20+1),1,'legacy',0
      FROM public.user_progress p WHERE p.user_id=actor ON CONFLICT DO NOTHING;
    INSERT INTO public.learning_sync_entities(user_id,entity_key,payload,revision,device,sequence)
      VALUES(actor,'learning',jsonb_build_object(
        'totalWordsLearned',(SELECT count(*) FROM public.user_progress WHERE user_id=actor AND status='mastered'),
        'streakDays',COALESCE((SELECT current_streak FROM public.user_streaks WHERE user_id=actor),0),
        'wordsLearnedToday',COALESCE((SELECT words_learned_today FROM public.user_streaks WHERE user_id=actor),0),
        'lastActiveDate',(SELECT last_activity_date FROM public.user_streaks WHERE user_id=actor),
        'reviewedWordsCount',0,'hardWordsCount',0,'bookProgress','{}'::JSONB,'bookLearnedCounts','{}'::JSONB,'completedUnits','{}'::JSONB),
        1,'legacy',0) ON CONFLICT DO NOTHING;
    UPDATE public.learning_sync_accounts SET revision=1 WHERE user_id=actor RETURNING * INTO account;
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('entity_key',e.entity_key,'payload',e.payload,'revision',e.revision)),'[]'::JSONB)
    INTO items FROM public.learning_sync_entities e WHERE e.user_id=actor AND e.revision>p_after_revision;
  RETURN jsonb_build_object('epoch',account.epoch,'revision',account.revision,'entities',items);
END $$;

CREATE OR REPLACE FUNCTION public.sync_learning_operations(p_operations JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor UUID := auth.uid(); account public.learning_sync_accounts%ROWTYPE;
  op JSONB; canonical JSONB; receipt JSONB; change RECORD; existing public.learning_sync_entities%ROWTYPE;
  merged JSONB; ack JSONB := '[]'::JSONB; seq BIGINT; word BIGINT; known_sequence BIGINT;
BEGIN
  IF actor IS NULL OR NOT ingly_private.active_account() THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_operations) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid operations' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(p_operations)>32 OR octet_length(p_operations::TEXT)>524288 THEN
    RAISE EXCEPTION 'Batch too large' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.learning_sync_accounts(user_id) VALUES(actor) ON CONFLICT DO NOTHING;
  SELECT * INTO account FROM public.learning_sync_accounts WHERE user_id=actor FOR UPDATE;
  FOR op IN SELECT value FROM jsonb_array_elements(p_operations) LOOP
    seq := (op->>'sequence')::BIGINT;
    IF op->>'owner' IS DISTINCT FROM actor::TEXT OR seq IS NULL OR seq<=0 OR
      length(COALESCE(op->>'id','')) NOT BETWEEN 3 AND 250 OR length(COALESCE(op->>'device','')) NOT BETWEEN 3 AND 200 OR
      op->>'id' IS DISTINCT FROM (op->>'device')||':'||seq OR
      COALESCE(op->>'action','') NOT IN ('patch','reset') OR jsonb_typeof(op->'changes') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invalid operation' USING ERRCODE='22023';
    END IF;
    canonical := op - 'attempts' - 'last_attempt_at';
    SELECT r.operation INTO receipt FROM public.learning_sync_receipts r WHERE r.user_id=actor AND r.operation_id=op->>'id';
    IF FOUND THEN
      IF receipt IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'Operation ID reused' USING ERRCODE='22023'; END IF;
      ack := ack || jsonb_build_array(jsonb_build_object('id',op->>'id','sequence',seq)); CONTINUE;
    END IF;
    IF op->>'epoch' IS DISTINCT FROM account.epoch THEN RAISE EXCEPTION 'EPOCH_CONFLICT: pending changes retained' USING ERRCODE='P0001'; END IF;
    IF op->>'action'='reset' THEN
      IF length(COALESCE(op->>'next_epoch','')) NOT BETWEEN 3 AND 200 OR op->>'next_epoch'=account.epoch THEN
        RAISE EXCEPTION 'Invalid reset epoch' USING ERRCODE='22023';
      END IF;
      DELETE FROM public.learning_sync_entities WHERE user_id=actor AND (entity_key LIKE 'word:%' OR entity_key IN ('learning','lesson'));
      DELETE FROM public.user_progress WHERE user_id=actor;
      DELETE FROM public.user_streaks WHERE user_id=actor;
      account.epoch := op->>'next_epoch';
    END IF;
    account.revision := account.revision+1;
    FOR change IN SELECT * FROM jsonb_each(op->'changes') LOOP
      IF change.key NOT IN ('learning','lesson','preferences') AND change.key !~ '^word:[1-9][0-9]*$' AND change.key !~ '^custom:[A-Za-z0-9_-]{1,200}$' THEN
        RAISE EXCEPTION 'Unknown learning entity' USING ERRCODE='22023';
      END IF;
      IF jsonb_typeof(change.value) IS DISTINCT FROM 'object' OR octet_length(change.value::TEXT)>32768 THEN
        RAISE EXCEPTION 'Invalid entity payload' USING ERRCODE='22023';
      END IF;
      -- Profile entitlements/roles/contact cannot enter this path.
      IF change.key='preferences' AND EXISTS (SELECT 1 FROM jsonb_object_keys(change.value) k WHERE k NOT IN
        ('name','avatar','dailyGoal','reminderTime','notificationsEnabled','soundEnabled')) THEN
        RAISE EXCEPTION 'Protected preference' USING ERRCODE='22023';
      END IF;
      IF change.key='lesson' AND EXISTS (SELECT 1 FROM jsonb_object_keys(change.value) k WHERE k NOT IN ('activeBook','activeUnit')) THEN
        RAISE EXCEPTION 'Invalid lesson fields' USING ERRCODE='22023';
      END IF;
      IF change.key='learning' AND EXISTS (SELECT 1 FROM jsonb_object_keys(change.value) k WHERE k NOT IN
        ('totalWordsLearned','wordsLearnedToday','streakDays','lastActiveDate','reviewedWordsCount','hardWordsCount','accuracy','bookProgress','bookLearnedCounts','completedUnits')) THEN
        RAISE EXCEPTION 'Invalid learning fields' USING ERRCODE='22023';
      END IF;
      SELECT * INTO existing FROM public.learning_sync_entities WHERE user_id=actor AND entity_key=change.key;
      SELECT v.sequence INTO known_sequence FROM public.learning_sync_versions v
        WHERE v.user_id=actor AND v.entity_key=change.key AND v.device=op->>'device';
      IF known_sequence>=seq THEN CONTINUE; END IF;
      merged := change.value;
      IF existing.user_id IS NOT NULL AND change.key LIKE 'word:%' THEN
        merged := existing.payload || merged || jsonb_build_object('completed',COALESCE((existing.payload->>'completed')::BOOLEAN,false) OR COALESCE((merged->>'completed')::BOOLEAN,false),
          'review_count',GREATEST(COALESCE((existing.payload->>'review_count')::INT,0),COALESCE((merged->>'review_count')::INT,0)));
      ELSIF existing.user_id IS NOT NULL AND change.key='learning' THEN
        merged := ingly_private.merge_learning_state(existing.payload,merged);
      END IF;
      INSERT INTO public.learning_sync_entities(user_id,entity_key,payload,revision,device,sequence)
        VALUES(actor,change.key,merged,account.revision,op->>'device',seq)
        ON CONFLICT(user_id,entity_key) DO UPDATE SET payload=EXCLUDED.payload,revision=EXCLUDED.revision,device=EXCLUDED.device,sequence=EXCLUDED.sequence;
      INSERT INTO public.learning_sync_versions(user_id,entity_key,device,sequence) VALUES(actor,change.key,op->>'device',seq)
        ON CONFLICT(user_id,entity_key,device) DO UPDATE SET sequence=EXCLUDED.sequence;
      IF change.key='preferences' THEN
        UPDATE public.users SET full_name=COALESCE(merged->>'name',full_name),avatar_url=COALESCE(merged->>'avatar',avatar_url),
          daily_goal=GREATEST(1,LEAST(500,COALESCE((merged->>'dailyGoal')::INT,daily_goal))) WHERE id=actor AND auth_user_id=actor;
      ELSIF change.key LIKE 'word:%' THEN
        word := substring(change.key FROM 6)::BIGINT;
        -- Bundled IDs can exist before DB content import. Keep their sync entity;
        -- mirror only known FK words for existing admin statistics.
        IF EXISTS(SELECT 1 FROM public.words WHERE id=word) THEN
          INSERT INTO public.user_progress(user_id,word_id,status,review_count,is_favorite,last_reviewed_at,next_review_date)
            VALUES(actor,word,COALESCE(merged->>'status','review'),COALESCE((merged->>'review_count')::INT,0),
              COALESCE((merged->>'is_favorite')::BOOLEAN,false),(merged->>'last_reviewed_at')::TIMESTAMPTZ,(merged->>'next_review_date')::TIMESTAMPTZ)
            ON CONFLICT(user_id,word_id) DO UPDATE SET status=EXCLUDED.status,review_count=EXCLUDED.review_count,
              is_favorite=EXCLUDED.is_favorite,last_reviewed_at=EXCLUDED.last_reviewed_at,next_review_date=EXCLUDED.next_review_date;
        END IF;
      ELSIF change.key='learning' THEN
        INSERT INTO public.user_streaks(user_id,current_streak,max_streak,last_activity_date,words_learned_today)
          VALUES(actor,COALESCE((merged->>'streakDays')::INT,0),COALESCE((merged->>'streakDays')::INT,0),
            (merged->>'lastActiveDate')::DATE,COALESCE((merged->>'wordsLearnedToday')::INT,0))
          ON CONFLICT(user_id) DO UPDATE SET current_streak=EXCLUDED.current_streak,
            max_streak=GREATEST(public.user_streaks.max_streak,EXCLUDED.max_streak),last_activity_date=EXCLUDED.last_activity_date,words_learned_today=EXCLUDED.words_learned_today;
      END IF;
    END LOOP;
    INSERT INTO public.learning_sync_receipts(user_id,operation_id,operation) VALUES(actor,op->>'id',canonical);
    ack := ack || jsonb_build_array(jsonb_build_object('id',op->>'id','sequence',seq));
  END LOOP;
  UPDATE public.learning_sync_accounts SET epoch=account.epoch,revision=account.revision WHERE user_id=actor;
  RETURN jsonb_build_object('success',true,'acknowledged',ack,'epoch',account.epoch,'revision',account.revision);
END $$;
REVOKE ALL ON FUNCTION public.read_learning_sync(BIGINT), public.sync_learning_operations(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_learning_sync(BIGINT), public.sync_learning_operations(JSONB) TO authenticated;
-- Non-idempotent Phase 2 entrypoints are retired for clients once Phase 3 is applied.
REVOKE EXECUTE ON FUNCTION public.sync_user_offline_progress(JSONB), public.record_user_activity(INT) FROM PUBLIC, anon, authenticated;
COMMIT;
