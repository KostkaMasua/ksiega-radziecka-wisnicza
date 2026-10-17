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
for r in oit:
    rid = cell(r, 0)
    if not rid:
        continue  # wiersz-kontynuacja (dodatkowa osoba)
    rok, mie, dzien = cell(r, 3), cell(r, 2), cell(r, 1)
    try:
        data = f"{int(rok):04d}-{int(mie):02d}-{int(dzien):02d}"
    except ValueError:
        data = rok
    orig_entries.append({
        "data": data,
        "skan": cell(r, 5),
        "temat": cell(r, 12),
        "slowa": cell(r, 14),
        "okol": cell(r, 15),
    })
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
