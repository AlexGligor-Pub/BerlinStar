# Backfill `receipt_items.item_id` și `receipt_items.item_type`

Mapează rândurile din `receipt_items` la rândurile din `items` folosind perechea
`(account_id, name)` și completează coloanele `item_id` și `item_type`. Acest
backfill este deja inclus în migrarea Alembic `mr01reports001`; query-urile de
mai jos sunt utile pentru a-l re-rula manual sau pentru a depana itemii
nemapați.

> ATENȚIE: query-urile sunt scrise pentru PostgreSQL.

---

## 1. Backfill standard (match simplu pe nume)

Funcționează când există un singur `item` activ per `(account_id, name)`.
Itemii catalog cu name duplicat vor primi unul dintre ID-uri (non-determinist).

```sql
UPDATE receipt_items AS ri
SET
    item_id   = i.id,
    item_type = i.type
FROM items AS i
WHERE i.account_id = ri.account_id
  AND i.name       = ri.name
  AND i.is_deleted = false
  AND (ri.item_id IS NULL OR ri.item_type IS NULL);
```

---

## 2. Backfill determinist (preferă itemi neșterși, apoi cel mai recent)

Variantă mai sigură care alege explicit `MAX(id)` când există mai mulți itemi
cu același nume (preferință pentru itemul cel mai recent).

```sql
WITH best_item AS (
    SELECT DISTINCT ON (account_id, name)
        account_id,
        name,
        id    AS item_id,
        type  AS item_type
    FROM items
    WHERE is_deleted = false
    ORDER BY account_id, name, id DESC
)
UPDATE receipt_items AS ri
SET
    item_id   = b.item_id,
    item_type = b.item_type
FROM best_item AS b
WHERE b.account_id = ri.account_id
  AND b.name       = ri.name
  AND (ri.item_id IS NULL OR ri.item_type IS NULL);
```

---

## 3. Backfill „fallback" pentru receipt_items cu itemi șterși

Dacă itemul activ nu mai există, încearcă match și pe itemii cu `is_deleted = true`
(util pentru istoricul vechi).

```sql
WITH any_item AS (
    SELECT DISTINCT ON (account_id, name)
        account_id,
        name,
        id    AS item_id,
        type  AS item_type
    FROM items
    ORDER BY account_id, name, is_deleted ASC, id DESC
)
UPDATE receipt_items AS ri
SET
    item_id   = COALESCE(ri.item_id,   a.item_id),
    item_type = COALESCE(ri.item_type, a.item_type)
FROM any_item AS a
WHERE a.account_id = ri.account_id
  AND a.name       = ri.name
  AND (ri.item_id IS NULL OR ri.item_type IS NULL);
```

---

## 4. Verificare: câte rânduri rămân nemapate

```sql
SELECT
    COUNT(*) FILTER (WHERE item_id   IS NULL) AS missing_item_id,
    COUNT(*) FILTER (WHERE item_type IS NULL) AS missing_item_type,
    COUNT(*)                                   AS total
FROM receipt_items;
```

---

## 5. Inspecție: ce nume din `receipt_items` nu au match în `items`

Util pentru a vedea ce itemi sunt adăugări manuale (nu există în catalog).

```sql
SELECT
    ri.account_id,
    ri.name,
    COUNT(*) AS uses
FROM receipt_items AS ri
LEFT JOIN items AS i
    ON  i.account_id = ri.account_id
    AND i.name       = ri.name
WHERE i.id IS NULL
GROUP BY ri.account_id, ri.name
ORDER BY uses DESC, ri.name;
```

---

## 6. Reset (rollback backfill)

Dacă vrei să cureți coloanele și să rulezi backfill-ul din nou:

```sql
UPDATE receipt_items SET item_id = NULL, item_type = NULL;
```
