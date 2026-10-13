-- เก็บข้อมูลลูกค้าเฉพาะคนที่พิมพ์ตรง keyword (คอมเมนต์ / DM) หรือกดปุ่มในข้อความของเรา
-- ข้อความเข้าที่ไม่ตรงกฎ: เหลือไว้แค่ว่า "มีข้อความเข้ามา" (นับในภาพรวม) ไม่เก็บว่าใครส่ง ส่งว่าอะไร
-- รูปแบบเดียวกับที่ระบบบันทึกตอนนี้ (lib/automation/handlers.ts): meta = {"via": ..., "matched": false}
-- รันซ้ำได้: แถวที่ล้างแล้วไม่ถูกแก้อีก และ contact ที่เหลือไม่ถูกลบเพิ่ม

-- 1) คอมเมนต์ที่ไม่ได้ทำให้กฎทำงาน → ลบว่าใครคอมเมนต์ / ข้อความ / ชื่อ / comment id
--    คอมเมนต์ที่ตรงกฎจะมี rule_triggered ที่ meta.commentId เดียวกัน หรือ skipped เพราะเคยส่งให้คนนี้แล้ว /
--    ตรง keyword ของกฎ "โพสต์ถัดไป" แต่ถาม Meta ไม่สำเร็จ (กิจกรรม skipped นั้นมีชื่อและข้อความอยู่แล้ว จึงเก็บไว้คู่กัน)
UPDATE "events" AS e
SET "contact_id" = NULL,
  "actor_id" = NULL,
  "text" = NULL,
  "meta" = jsonb_strip_nulls(jsonb_build_object('via', e."meta" -> 'via', 'matched', false))
WHERE e."type" = 'comment_received'
  AND (
    e."contact_id" IS NOT NULL OR e."actor_id" IS NOT NULL OR e."text" IS NOT NULL
    OR e."meta" ?| ARRAY['commentId', 'fromName', 'mid', 'payload']
  )
  AND NOT EXISTS (
    SELECT 1 FROM "events" AS t
    WHERE (
        t."type" = 'rule_triggered'
        OR (t."type" = 'skipped' AND t."meta" ->> 'reason' IN ('once_per_user', 'next_post_lookup_failed'))
      )
      AND t."meta" ->> 'commentId' = e."meta" ->> 'commentId'
  );
--> statement-breakpoint
-- 2) DM ที่ไม่ตรง keyword → ลบว่าใครทัก / ข้อความ / mid (DM ที่ตรงกฎมี rule_triggered ที่ meta.mid เดียวกัน)
UPDATE "events" AS e
SET "contact_id" = NULL,
  "actor_id" = NULL,
  "text" = NULL,
  "meta" = jsonb_strip_nulls(jsonb_build_object('via', e."meta" -> 'via', 'matched', false))
WHERE e."type" = 'dm_received'
  AND (
    e."contact_id" IS NOT NULL OR e."actor_id" IS NOT NULL OR e."text" IS NOT NULL
    OR e."meta" ?| ARRAY['commentId', 'fromName', 'mid', 'payload']
  )
  AND NOT EXISTS (
    SELECT 1 FROM "events" AS t
    WHERE t."type" = 'rule_triggered' AND t."meta" ->> 'mid' = e."meta" ->> 'mid'
  );
--> statement-breakpoint
-- 3) ลบ contact ที่ไม่เคยได้ DM จากกฎ ไม่เคยทำให้กฎทำงาน และไม่เคยกดปุ่ม/ลิงก์ (เช่น คนที่ทักมาเฉยๆ)
--    แล้วล้างกิจกรรมที่ยังชี้ไปที่ contact เหล่านั้น (ปกติไม่เหลือแล้วหลังข้อ 2 — กันไว้เผื่อ)
WITH "removed" AS (
  DELETE FROM "contacts" AS c
  WHERE NOT EXISTS (SELECT 1 FROM "messages" AS m WHERE m."contact_id" = c."id")
    AND NOT EXISTS (SELECT 1 FROM "links" AS l WHERE l."contact_id" = c."id")
    AND NOT EXISTS (
      SELECT 1 FROM "events" AS t
      WHERE t."contact_id" = c."id"
        AND t."type" IN ('rule_triggered', 'button_clicked', 'link_clicked', 'dm_sent')
    )
  RETURNING c."id"
)
UPDATE "events" AS e
SET "contact_id" = NULL,
  "actor_id" = NULL,
  "text" = NULL,
  "meta" = e."meta" - ARRAY['commentId', 'fromName', 'mid', 'payload']
FROM "removed" AS r
WHERE e."contact_id" = r."id";
