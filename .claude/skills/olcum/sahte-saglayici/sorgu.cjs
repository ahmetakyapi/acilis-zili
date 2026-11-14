/* Neon HTTP sahtesi: Drizzle'ın ürettiği SELECT'i ayrıştırır ve
   `tablolar.cjs`teki satırlara WHERE, ORDER BY, LIMIT uygular.

   NEDEN GENEL AYRIŞTIRICI (14 Kasım): eski sürüm tablo başına elle süzüyordu
   ve yeni her sorgu sessizce BÜTÜN tabloyu döndürüyordu: arama sekiz yerine
   beş yüz sembol, ZETA sayfası başka şirketin analizleri, takvim aralığı
   yalnız bugün. Yedi ajan yedi ayrı yama yazdı. Artık koşul sorgudan okunur.

   Desteklenen: `=, <>, <, <=, >, >=, in, like, ilike, is [not] null, @>`
   (jsonb dizi), `and/or/not`, parantez, `lower/upper/translate(...)`,
   `order by` (sütun ya da `case when`), `limit/offset`, `count(...)`,
   `select distinct`, `group by`. TANINMAYAN koşul (ilişkili alt sorgu,
   `exists`) "bilinmiyor" sayılır ve satırı ELEMEZ; `MOCK_SQL_LOG` günlüğünde
   `[?]` ile işaretlenir. Bilinmeyen tablo boş döner. Yazma sorguları yutulur. */
const fs = require("fs");
const { veri } = require("./tablolar.cjs");

const TOKEN = /\s+|"((?:[^"]|"")*)"|'((?:[^']|'')*)'|\$(\d+)|::(?:double precision|timestamp with(?:out)? time zone|[a-z_0-9]+)(?:\[\])?|<=|>=|<>|!=|@>|->>|->|\|\||[=<>(),.*+\-\/;]|[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?|./gy;
function tokenize(sql) {
  const out = []; TOKEN.lastIndex = 0; let m;
  while ((m = TOKEN.exec(sql))) {
    const t = m[0];
    if (/^\s/.test(t)) continue;
    if (m[1] !== undefined) out.push({ k: "id", v: m[1] });
    else if (m[2] !== undefined) out.push({ k: "str", v: m[2].replace(/''/g, "'") });
    else if (m[3] !== undefined) out.push({ k: "par", v: Number(m[3]) });
    else if (t.startsWith("::")) out.push({ k: "cast" });
    else if (/^[A-Za-z_]/.test(t)) out.push({ k: "w", v: t.toLowerCase() });
    else if (/^\d/.test(t)) out.push({ k: "num", v: Number(t) });
    else out.push({ k: "p", v: t });
  }
  return out;
}
const is = (t, k, v) => t !== undefined && t.k === k && (v === undefined || t.v === v);
const TR_FOLD = { ı: "i", İ: "I", ş: "s", Ş: "S", ğ: "g", Ğ: "G", ü: "u", Ü: "U", ö: "o", Ö: "O", ç: "c", Ç: "C", â: "a", Â: "A", î: "i", Î: "I", û: "u", Û: "U" };
const FN = { lower: (v) => v.toLowerCase(), upper: (v) => v.toUpperCase(), translate: (v) => v.replace(/[ıİşŞğĞüÜöÖçÇâÂîÎûÛ]/g, (c) => TR_FOLD[c]), coalesce: (v) => v, trim: (v) => v.trim() };
const UNKNOWN = Symbol("bilinmiyor");
const numeric = (v) => typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(v));
function compare(a, b) { if (numeric(a) && numeric(b)) return Number(a) - Number(b); const x = String(a), y = String(b); return x < y ? -1 : x > y ? 1 : 0; }
function like(value, pattern, insensitive) {
  const re = new RegExp("^" + String(pattern).replace(/\\([%_\\])|[.*+?^${}()|[\]\\]|[%_]/g, (m0, esc) => (esc ? "\\" + esc : m0 === "%" ? "[\\s\\S]*" : m0 === "_" ? "[\\s\\S]" : "\\" + m0)) + "$", insensitive ? "i" : "");
  return re.test(String(value));
}

/** `tokens[pos]`ten başlayan ifadeleri okuyan küçük özyinelemeli ayrıştırıcı. */
function parser(tokens, params, note) {
  let pos = 0;
  const peek = (o = 0) => tokens[pos + o];
  const skipBalanced = () => { let depth = 0; do { if (is(peek(), "p", "(")) depth++; else if (is(peek(), "p", ")")) depth--; pos++; } while (depth > 0 && pos < tokens.length); };
  const unknown = (why) => { note(why); return () => UNKNOWN; };

  function operand() {
    let fn;
    const t = peek();
    if (t === undefined) return unknown("eksik işlenen");
    if (t.k === "id") { pos++; let name = t.v; if (is(peek(), "p", ".") && is(peek(1), "id")) { name = peek(1).v; pos += 2; } fn = (row) => (row[name] === undefined ? null : row[name]); }
    else if (t.k === "par") { pos++; const v = params[t.v - 1]; fn = () => (v === undefined ? null : v); }
    else if (t.k === "str" || t.k === "num") { pos++; fn = () => t.v; }
    else if (t.k === "w" && ["true", "false", "null"].includes(t.v)) { pos++; const v = t.v === "null" ? null : t.v === "true"; fn = () => v; }
    else if (t.k === "w" && t.v === "case") fn = caseExpr();
    else if (t.k === "w" && is(peek(1), "p", "(")) {
      const apply = FN[t.v]; pos += 2;
      if (!apply || is(peek(), "w", "select")) { pos -= 1; skipBalanced(); fn = unknown(`${t.v}(...)`); }
      else { const inner = operand(); let depth = 1; while (pos < tokens.length && depth > 0) { if (is(peek(), "p", "(")) depth++; else if (is(peek(), "p", ")")) depth--; pos++; } fn = (row) => { const v = inner(row); return v === UNKNOWN || v === null ? v : apply(String(v)); }; }
    } else if (is(t, "p", "(")) {
      if (is(peek(1), "w", "select")) { skipBalanced(); fn = unknown("alt sorgu"); }
      else { pos++; const items = []; while (pos < tokens.length && !is(peek(), "p", ")")) { items.push(operand()); if (is(peek(), "p", ",")) pos++; } pos++; fn = (row) => items.map((f) => f(row)); }
    } else { pos++; fn = unknown(`belirteç ${t.v ?? t.k}`); }
    while (is(peek(), "cast")) pos++;
    /* Birleştirme ve aritmetik hesaplanmaz: ifade bilinmiyor sayılır. */
    while (is(peek(), "p") && ["||", "+", "-", "*", "/", "->", "->>"].includes(peek().v)) { pos++; operand(); fn = unknown("aritmetik/birleştirme"); }
    return fn;
  }
  function caseExpr() {
    pos++; const arms = []; let otherwise = () => null;
    while (is(peek(), "w", "when")) { pos++; const cond = orExpr(); if (is(peek(), "w", "then")) pos++; arms.push([cond, operand()]); }
    if (is(peek(), "w", "else")) { pos++; otherwise = operand(); }
    if (is(peek(), "w", "end")) pos++;
    return (row) => { for (const [cond, value] of arms) if (cond(row) === true) return value(row); return otherwise(row); };
  }
  function predicate() {
    if (is(peek(), "w", "exists")) { pos++; skipBalanced(); return unknown("exists"); }
    const left = operand();
    let negate = false;
    if (is(peek(), "w", "is")) { pos++; if (is(peek(), "w", "not")) { negate = true; pos++; } pos++; return (row) => { const v = left(row); return v === UNKNOWN ? UNKNOWN : (v === null) !== negate; }; }
    if (is(peek(), "w", "not")) { negate = true; pos++; }
    const t = peek();
    const flip = (v) => (v === UNKNOWN ? v : v !== negate);
    if (is(t, "w", "in")) { pos++; const right = operand(); return (row) => { const v = left(row), list = right(row); if (v === UNKNOWN || list === UNKNOWN || !Array.isArray(list)) return UNKNOWN; return flip(v !== null && list.some((x) => String(x) === String(v))); }; }
    if (is(t, "w", "like") || is(t, "w", "ilike")) { pos++; const right = operand(); return (row) => { const v = left(row), p = right(row); if (v === UNKNOWN || p === UNKNOWN) return UNKNOWN; return flip(v !== null && p !== null && like(v, p, t.v === "ilike")); }; }
    if (is(t, "w", "between")) { pos++; const lo = operand(); if (is(peek(), "w", "and")) pos++; const hi = operand(); return (row) => { const v = left(row), a = lo(row), b = hi(row); if ([v, a, b].includes(UNKNOWN)) return UNKNOWN; return flip(v !== null && compare(v, a) >= 0 && compare(v, b) <= 0); }; }
    if (is(t, "p") && ["=", "<>", "!=", "<", "<=", ">", ">=", "@>"].includes(t.v)) {
      pos++; const right = operand(); const op = t.v;
      return (row) => {
        const a = left(row), b = right(row);
        if (a === UNKNOWN || b === UNKNOWN) return UNKNOWN;
        if (a === null || b === null) return false;
        if (op === "@>") { try { const have = JSON.parse(a), want = JSON.parse(b); return Array.isArray(have) && [].concat(want).every((x) => have.includes(x)); } catch { return UNKNOWN; } }
        const c = compare(a, b);
        return op === "=" ? c === 0 : op === "<" ? c < 0 : op === "<=" ? c <= 0 : op === ">" ? c > 0 : op === ">=" ? c >= 0 : c !== 0;
      };
    }
    return (row) => { const v = left(row); return v === UNKNOWN ? UNKNOWN : flip(Boolean(v)); };
  }
  function primary() {
    if (is(peek(), "w", "not")) { pos++; const inner = primary(); return (row) => { const v = inner(row); return v === UNKNOWN ? v : !v; }; }
    if (is(peek(), "p", "(") && !is(peek(1), "w", "select")) { pos++; const inner = orExpr(); if (is(peek(), "p", ")")) pos++; return inner; }
    return predicate();
  }
  function andExpr() { const parts = [primary()]; while (is(peek(), "w", "and")) { pos++; parts.push(primary()); } return parts.length === 1 ? parts[0] : (row) => { let unk = false; for (const p of parts) { const v = p(row); if (v === false) return false; if (v === UNKNOWN) unk = true; } return unk ? UNKNOWN : true; }; }
  function orExpr() { const parts = [andExpr()]; while (is(peek(), "w", "or")) { pos++; parts.push(andExpr()); } return parts.length === 1 ? parts[0] : (row) => { let unk = false; for (const p of parts) { const v = p(row); if (v === true) return true; if (v === UNKNOWN) unk = true; } return unk ? UNKNOWN : false; }; }
  return { operand, orExpr, peek, advance: () => pos++, done: () => pos >= tokens.length };
}

/** Üst düzey (parantez dışı) parçalar: select listesi, from, where, group, order, limit, offset. */
function clauses(tokens) {
  const out = {}; let depth = 0; let current = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (is(t, "p", "(")) depth++; else if (is(t, "p", ")")) depth--;
    if (depth === 0 && t.k === "w") {
      const two = (a, b) => t.v === a && is(tokens[i + 1], "w", b);
      const key = ["select", "from", "where", "limit", "offset", "having"].includes(t.v) && !(t.v === "from" && current !== "select") ? t.v : two("group", "by") ? "group" : two("order", "by") ? "order" : null;
      if (key && (out[key] === undefined)) { current = key; out[key] = []; if (key === "group" || key === "order") i++; continue; }
    }
    if (current) out[current].push(t);
  }
  return out;
}
function splitTop(tokens) { const out = [[]]; let depth = 0; for (const t of tokens) { if (is(t, "p", "(")) depth++; else if (is(t, "p", ")")) depth--; if (depth === 0 && is(t, "p", ",")) out.push([]); else out[out.length - 1].push(t); } return out.filter((x) => x.length); }

function select(sql, params, note) {
  const c = clauses(tokenize(sql));
  if (!c.select || !c.from || !is(c.from[0], "id")) return null;
  const table = c.from[0].v;
  const all = veri()[table];
  let list = c.select; const distinct = is(list[0], "w", "distinct"); if (distinct) list = list.slice(1);
  const items = splitTop(list).map((toks) => {
    const plain = toks.filter((t) => t.k !== "cast");
    if (plain.length === 1 && plain[0].k === "id") return { col: plain[0].v };
    if (plain.length === 3 && plain[0].k === "id" && is(plain[1], "p", ".") && plain[2].k === "id") return { col: plain[2].v };
    if (is(plain[0], "w", "count")) return { count: true };
    /* Alt sorgulu sütun (ör. makro serinin son 24 gözlemi): satır aynı adı taşıyorsa o okunur. */
    const named = plain.find((t) => t.k === "w" && all && all[0] && t.v in all[0]);
    return named ? { col: named.v, json: true } : { nil: true };
  });
  const fields = items.map((it, i) => ({ name: it.col ?? (it.count ? "count" : `c${i}`), dataTypeID: it.count ? 23 : it.json ? 3802 : it.col && it.col.startsWith("is_") ? 16 : 25 }));
  if (!all) { note(`tablo yok: ${table}`); return { fields, rows: [] }; }
  let rows = all;
  if (c.where) { const test = parser(c.where, params, note).orExpr(); rows = rows.filter((row) => test(row) !== false); }
  if (c.order) {
    const keys = splitTop(c.order).map((toks) => { const p = parser(toks, params, note); const value = p.operand(); let desc = false, nullsLast = null; while (!p.done()) { const t = p.peek(); if (is(t, "w", "desc")) desc = true; else if (is(t, "w", "last")) nullsLast = true; else if (is(t, "w", "first")) nullsLast = false; p.advance(); } return { value, desc, nullsLast: nullsLast ?? !desc }; });
    rows = [...rows].sort((a, b) => { for (const k of keys) { let x = k.value(a), y = k.value(b); if (x === UNKNOWN) x = null; if (y === UNKNOWN) y = null; if (x === null && y === null) continue; if (x === null) return k.nullsLast ? 1 : -1; if (y === null) return k.nullsLast ? -1 : 1; const d = compare(x, y); if (d) return k.desc ? -d : d; } return 0; });
  }
  let out;
  const cell = (row, it) => (it.col ? (row[it.col] === undefined ? null : row[it.col]) : null);
  if (items.some((it) => it.count)) {
    const groups = new Map();
    for (const row of c.group ? rows : [null]) { const key = row ? JSON.stringify(items.map((it) => cell(row, it))) : ""; if (!groups.has(key)) groups.set(key, { row, n: 0 }); groups.get(key).n += row ? 1 : rows.length; }
    out = [...groups.values()].map((g) => items.map((it) => (it.count ? g.n : g.row ? cell(g.row, it) : null)));
  } else out = rows.map((row) => items.map((it) => cell(row, it)));
  if (distinct) { const seen = new Set(); out = out.filter((r) => { const k = JSON.stringify(r); return seen.has(k) ? false : (seen.add(k), true); }); }
  const amount = (toks) => { if (!toks || !toks[0]) return null; const n = Number(toks[0].k === "par" ? params[toks[0].v - 1] : toks[0].v); return Number.isFinite(n) ? n : null; };
  const offset = amount(c.offset) ?? 0; const limit = amount(c.limit);
  if (offset || limit !== null) out = out.slice(offset, limit === null ? undefined : offset + limit);
  return { fields, rows: out };
}

function neon(body) {
  const one = (q) => {
    const sql = q.query || ""; const params = q.params || [];
    const isSelect = /^\s*select\b/i.test(sql);
    const notes = [];
    let result = null;
    if (isSelect) { try { result = select(sql, params, (why) => notes.push(why)); } catch (error) { notes.push(`ayrıştırılamadı: ${error.message}`); } }
    // MOCK_SQL_LOG=<dosya>: gelen sorgular, dönen satır sayısı ve tanınmayan parçalar ([?]).
    if (process.env.MOCK_SQL_LOG) fs.appendFileSync(process.env.MOCK_SQL_LOG, `${sql}\n  ${JSON.stringify(params).slice(0, 400)}\n  -> ${result ? result.rows.length : "-"} satır${notes.length ? `  [?] ${[...new Set(notes)].join("; ")}` : ""}\n`);
    if (!result) return { fields: [], command: isSelect ? "SELECT" : "INSERT", rowCount: 0, rows: [], rowAsArray: true };
    return { fields: result.fields, command: "SELECT", rowCount: result.rows.length, rows: result.rows, rowAsArray: true };
  };
  return Array.isArray(body.queries) ? { results: body.queries.map(one) } : one(body);
}

module.exports = { neon, select };
