# -*- coding: utf-8 -*-
"""Eksport bazy radzieckiej xlsx -> data.json dla strony GitHub Pages."""
import openpyxl, json, re
from collections import defaultdict

SRC = r"C:\Users\bartl\.kiro\crew\workspace\Baza_Ksiega_radziecka_Wisnicza_1712-1736.xlsx"
OUT = r"C:\Users\bartl\.kiro\crew\workspace\wisnicz-ksiega\data\data.json"

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)

def rows(sheet):
    ws = wb[sheet]
    it = ws.iter_rows(values_only=True)
    hdr = [("" if c is None else str(c)).strip() for c in next(it)]
    for r in it:
        if all(c is None or str(c).strip() == "" for c in r):
            continue
        yield {hdr[i]: ("" if i >= len(r) or r[i] is None else str(r[i]).strip())
               for i in range(len(hdr))}

# --- WPISY (Tabela A) ---
wpisy = {}
for r in rows("WPISY (Tabela A)"):
    wid = r.get("id_wpisu", "")
    if not wid:
        continue
    wpisy[wid] = {
        "id": wid,
        "skan": r.get("skan", ""),
        "data": r.get("data", ""),
        "typ": r.get("typ", ""),
        "streszczenie": r.get("streszczenie", ""),
        "pewnosc": r.get("pewność", ""),
        "osoby": [],
    }

# --- OSOBY (Tabela B) ---
osoby_all = []
for r in rows("OSOBY (Tabela B)"):
    wid = r.get("id_wpisu", "")
    o = {
        "wid": wid,
        "imie": r.get("imię", ""),
        "nazwisko": r.get("nazwisko", ""),
        "rola": r.get("rola", ""),
        "status": r.get("status", ""),
        "miejscowosc": r.get("miejscowość", ""),
        "uwagi": r.get("uwagi", ""),
    }
    osoby_all.append(o)
    if wid in wpisy:
        wpisy[wid]["osoby"].append({k: o[k] for k in
            ("imie", "nazwisko", "rola", "status", "miejscowosc", "uwagi")})

# --- Indeks osób (z numerami stron) ---
idx_osob = []
for r in rows("Indeks osób"):
    nazwa = r.get("Osoba", "")
    if not nazwa or nazwa in ("?", "-", "—"):
        continue
    idx_osob.append({
        "osoba": nazwa,
        "liczba": r.get("Liczba wystąpień", ""),
        "strony": r.get("Strony (nr strony rękopisu)", ""),
        "statusy": r.get("Statusy", ""),
    })

# --- Indeks miejsc (z numerami stron) ---
idx_miejsc = []
for r in rows("Indeks miejsc"):
    nazwa = r.get("Miejsce / instytucja", "")
    if not nazwa:
        continue
    idx_miejsc.append({
        "miejsce": nazwa,
        "liczba": r.get("Liczba wystąpień", ""),
        "strony": r.get("Strony (nr strony rękopisu)", ""),
    })

wb.close()

# --- Dociągnięcie Słów kluczy / Tematu / Okoliczności z ORYGINALNEGO pliku ---
# Oryginał ma po jednym bloku wierszy na wpis (ID w kol. 'ID', kolejne wiersze z pustym ID
# dokładają osoby). Słowa klucze (kol. 14), Temat sprawy (12), Dodatkowe okoliczności (15)
# są w pierwszym wierszu bloku. Dopasowujemy do mojego id_wpisu po (data, kolejność w dniu).
ORIG = r"C:\Users\bartl\.kiro\crew\uploads\4f9d4fa771b449d8a9c9fc1f4dd74319_Księga_radziecka_Wiśnicza_1712-1736.xlsx"
owb = openpyxl.load_workbook(ORIG, read_only=True, data_only=True)
ows = owb[owb.sheetnames[0]]
oit = ows.iter_rows(values_only=True)
next(oit)  # nagłówek
def cell(r, i):
    return "" if i >= len(r) or r[i] is None else str(r[i]).strip()
orig_entries = []  # w kolejności źródła
cur = None
for r in oit:
    rid = cell(r, 0)
    osoba_row = cell(r, 9)   # 'Osoby powiązane'
    stan_row = cell(r, 8)    # 'Stan społeczny'
    zaw_row = cell(r, 10)    # 'Zawód'
    uw_row = cell(r, 11)     # 'Uwagi'
    if rid:
        rok, mie, dzien = cell(r, 3), cell(r, 2), cell(r, 1)
        try:
            data = f"{int(rok):04d}-{int(mie):02d}-{int(dzien):02d}"
        except ValueError:
            data = rok
        cur = {
            "data": data,
            "skan": cell(r, 5),
            "strona": cell(r, 4),
            "kto": cell(r, 6),
            "zkim": cell(r, 7),
            "temat": cell(r, 12),
            "charakter": cell(r, 13),
            "slowa": cell(r, 14),
            "okol": cell(r, 15),
            "ludzie": [],   # (osoba, stan, zawod, uwagi)
        }
        orig_entries.append(cur)
    if cur is not None and (osoba_row or zaw_row):
        cur["ludzie"].append((osoba_row, stan_row, zaw_row, uw_row))
owb.close()

# indeks oryginału po (data, skan), zachowując kolejność w obrębie grupy
from collections import defaultdict as _dd
orig_by_key = _dd(list)
for e in orig_entries:
    orig_by_key[(e["data"], e["skan"])].append(e)
used = _dd(int)  # ile już zużyto z danej grupy

KW_SEP = re.compile(r"[,;/]+")
def split_kw(s):
    return [t.strip() for t in KW_SEP.split(s or "") if t.strip()]

kw_counter = defaultdict(int)
matched = 0
# iterujemy w tej samej kolejności, w jakiej wpisy były dodawane (= kolejność źródła)
for wid, w in wpisy.items():
    key = (w["data"], str(w["skan"]))
    slowa = temat = okol = ""
    lst = orig_by_key.get(key, [])
    i = used[key]
    if i < len(lst):
        src = lst[i]
        used[key] += 1
        slowa, temat, okol = src["slowa"], src["temat"], src["okol"]
        matched += 1
    w["slowa"] = slowa
    w["temat"] = temat
    w["okol"] = okol
    w["kw"] = split_kw(slowa)
    for t in w["kw"]:
        kw_counter[t.lower()] += 1

# słownik haseł do listy rozwijanej: scal warianty wielkości liter, posortuj po częstości
kw_canon = {}
for w in wpisy.values():
    for t in w["kw"]:
        lk = t.lower()
        if lk not in kw_canon:
            kw_canon[lk] = t  # pierwsza napotkana forma
slowa_klucze = sorted(kw_canon.values(), key=lambda t: (-kw_counter[t.lower()], t.lower()))

print("Dopasowano słowa klucze do", matched, "z", len(wpisy), "wpisów")
print("Różnych haseł:", len(slowa_klucze))

# --- Powiązania i zawody osób (z bloków oryginału) ---
# Normalizacja nazwy do dopasowania osoby z indeksem (indeks ma "Imię Nazwisko").
def pnorm(s):
    s = (s or "").lower()
    s = s.replace("ł", "l")
    import unicodedata
    s = "".join(c for c in unicodedata.normalize("NFD", s)
                if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9 ]", " ", s).strip()
    
# zbierz per osoba: zawody, statusy, uwagi, współwystąpienia
from collections import defaultdict as _dd2
p_zawody = _dd2(set)
p_statusy = _dd2(set)
p_uwagi = _dd2(list)
p_rel = _dd2(dict)      # wspolwystepujacy -> {"ile":n, "sprawy":[...]}
all_zawody = defaultdict(int)

for e in orig_entries:
    ludzie = e["ludzie"]
    nazwy = [l[0] for l in ludzie if l[0]]
    for (osoba, stan, zaw, uw) in ludzie:
        if not osoba:
            continue
        key = pnorm(osoba)
        if not key:
            continue
        if zaw:
            p_zawody[key].add(zaw); all_zawody[zaw]+=1
        if stan:
            p_statusy[key].add(stan)
        if uw:
            p_uwagi[key].append(uw)
        # powiązania: inne osoby z tego samego wpisu
        for inna in nazwy:
            if pnorm(inna)==key:
                continue
            d = p_rel[key].setdefault(inna, {"ile":0, "sprawy":[]})
            d["ile"] += 1
            spr = (e["temat"] or e["charakter"] or "sprawa") + (f" ({e['data']})" if e['data'] else "")
            if spr not in d["sprawy"]:
                d["sprawy"].append(spr)

# dołóż dane do indeksu osób (dopasowanie po znormalizowanej nazwie)
rel_hits = 0
for o in idx_osob:
    key = pnorm(o["osoba"])
    zaw = sorted(p_zawody.get(key, []))
    stat = sorted(p_statusy.get(key, []))
    uw = p_uwagi.get(key, [])
    rel = p_rel.get(key, {})
    # top powiązań po liczbie wspólnych spraw
    rel_list = sorted(rel.items(), key=lambda kv: -kv[1]["ile"])
    o["zawody"] = zaw
    o["uwagi"] = uw[:12]
    # statusy w indeksie mogą już być; uzupełnij jeśli puste
    if not o.get("statusy"):
        o["statusy"] = ", ".join(stat)
    o["powiazania"] = [
        {"osoba": nm, "ile": d["ile"], "sprawy": d["sprawy"][:5]}
        for nm, d in rel_list[:25]
    ]
    if zaw: o["_zaw_norm"] = pnorm(" ".join(zaw))
    else: o["_zaw_norm"] = ""
    if o["powiazania"]:
        rel_hits += 1

zawody_lista = sorted(all_zawody, key=lambda z: (-all_zawody[z], z.lower()))
print("Osób z powiązaniami:", rel_hits, "z", len(idx_osob))
print("Różnych zawodów:", len(zawody_lista))

wpisy_list = list(wpisy.values())
# sort wpisów po dacie, potem po id
wpisy_list.sort(key=lambda w: (w["data"], w["id"]))

lata = sorted({w["data"][:4] for w in wpisy_list if w["data"][:4].isdigit()})
typy = sorted({w["typ"] for w in wpisy_list if w["typ"]})
role = sorted({o["rola"] for o in osoby_all if o["rola"]})

out = {
    "zrodlo": "Księga radziecka Wiśnicza 1712–1736",
    "wpisy": wpisy_list,
    "osoby_indeks": idx_osob,
    "miejsca_indeks": idx_miejsc,
    "meta": {
        "lata": lata,
        "typy": typy,
        "role": role,
        "slowa_klucze": slowa_klucze,
        "slowa_klucze_top": slowa_klucze[:60],
        "zawody": zawody_lista,
        "zawody_top": zawody_lista[:60],
        "liczba_wpisow": len(wpisy_list),
        "liczba_osob_wierszy": len(osoby_all),
        "liczba_osob_indeks": len(idx_osob),
        "liczba_miejsc": len(idx_miejsc),
    },
}

import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

print("WPISY:", len(wpisy_list))
print("OSOBY wierszy:", len(osoby_all))
print("Indeks osob:", len(idx_osob))
print("Indeks miejsc:", len(idx_miejsc))
print("Lata:", lata[0], "-", lata[-1], "(", len(lata), ")")
print("Typy:", len(typy), "->", ", ".join(typy[:12]))
print("Role:", len(role), "->", ", ".join(role))
print("OUT:", OUT)
