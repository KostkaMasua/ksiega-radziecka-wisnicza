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
        "zrodlo": "radziecka 1724–1736",
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

# --- Redakcja notatki prawno-opisowej z pola „Dodatkowe okoliczności” ---
# Notatka opisowa czerpie treść WYŁĄCZNIE z pola „Dodatkowe okoliczności”.
# Zdanie wprowadzające składamy z metadanych sprawy (charakter czynności, przedmiot,
# strony Kto/Z kim) — to nie treść z pola Uwagi, lecz nagłówkowy kontekst sprawy.
# Stosujemy poprawną polską deklinację: rodzaj gramatyczny stron (wnoszący/wnosząca,
# pozwany/pozwana) wykrywamy z końcówki nazwy, a liczbę stron odmieniamy.
def zdanie(s):
    s = (s or "").strip()
    if not s:
        return ""
    if s[-1] not in ".!?":
        s += "."
    return s[0].upper() + s[1:]

# żeńskie imiona najczęstsze w źródle (gdy nazwisko nie rozstrzyga)
_IMIONA_F = {"anna", "agnes", "agnieszka", "maria", "marianna", "regina", "zofia",
             "catharina", "katarzyna", "teresa", "teresua", "zuzanna", "susanna",
             "dorota", "ewa", "eva", "jadwiga", "hedwigis", "barbara", "elżbieta",
             "elisabeth", "magdalena", "helena", "krystyna", "christina", "konegunda",
             "conegunda", "kunegunda", "małgorzata", "margaretha"}
_IMIONA_M = {"jan", "joannes", "stanisław", "stanislaus", "wojciech", "adalbertus",
             "woyciech", "jakub", "jacobus", "jacobi", "franciszek", "franciscus",
             "józef", "jozephus", "kazimierz", "casimirus", "marcin", "martinus",
             "andrzej", "andreas", "tomasz", "thomas", "michał", "michael",
             "paweł", "paulus", "piotr", "petrus", "maciej", "mathias"}

def rodzaj_osoby(nazwa):
    """Zwraca 'f' (żeński) lub 'm' (męski) na podstawie nazwy osoby."""
    n = (nazwa or "").strip()
    if not n:
        return "m"
    tokens = n.lower().split()
    # 1) jawne imię żeńskie / męskie
    for t in tokens:
        if t in _IMIONA_F:
            return "f"
        if t in _IMIONA_M:
            return "m"
    last = tokens[-1]
    # 2) żeńskie sufiksy nazwisk/przezwisk mężatek i panien
    if re.search(r"(owa|yna|ina|anka|ówna|owna|cczanka|szczanka|czanka)$", last):
        return "f"
    if re.search(r"(ska|cka|dzka|żanka|zanka)$", last):
        return "f"
    # 3) ogólna końcówka -a zwykle żeńska (np. Zerkowska, Dziedzicowicowa)
    if last.endswith("a") and not last.endswith("ski") and len(last) > 3:
        return "f"
    return "m"

def rola_strona(nazwa, typ):
    """typ: 'wnosi' (powód) lub 'przeciw' (pozwany). Rzeczownik odmieniony rodzajowo."""
    f = rodzaj_osoby(nazwa) == "f"
    if typ == "wnosi":
        return "powódka" if f else "powód"
    return "pozwana" if f else "pozwany"

def redaguj_notatke(src):
    temat = src.get("temat", "").strip()
    kto = src.get("kto", "").strip()
    zkim = src.get("zkim", "").strip()
    okol = src.get("okol", "").strip()
    ludzie = src.get("ludzie", [])

    # --- STRONY: zdanie z deklinacją rodzajową (charakter jest już w nagłówku karty) ---
    strony = ""
    if kto and zkim:
        strony = (f"{kto} ({rola_strona(kto,'wnosi')}) "
                  f"oraz {zkim} ({rola_strona(zkim,'przeciw')}).")
    elif kto:
        strony = f"{kto} ({rola_strona(kto,'wnosi')})."
    elif zkim:
        strony = f"{zkim} ({rola_strona(zkim,'przeciw')})."

    # --- OKOLICZNOŚCI: pole „Dodatkowe okoliczności” + uwagi osób wzmiankowanych ---
    # Imię/nazwisko powódki (do zamiany zaimka „ją/jej” na nazwę, gdy jednoznaczne).
    powod_nazwa = kto or ""
    zdania = []
    def biernik_f(nazwa):
        # prosty biernik żeńskich nazwisk: -owa→-ową, -a→-ą (dla „pobił ją” → „pobił …ą”)
        n = nazwa.strip()
        if n.endswith("owa"):
            return n[:-3] + "ową"
        if n.endswith("ska") or n.endswith("cka") or n.endswith("dzka"):
            return n[:-1] + "ą"
        if n.endswith("a"):
            return n[:-1] + "ą"
        return n
    if okol:
        tekst = okol.strip()
        if powod_nazwa and rodzaj_osoby(powod_nazwa) == "f":
            tekst = re.sub(r"\bją\b", biernik_f(powod_nazwa), tekst, count=1)
            tekst = re.sub(r"\bjej\b", powod_nazwa, tekst, count=1)
        zdania.append(zdanie(tekst))
    # dopisz uwagi osób wzmiankowanych (pole Uwagi w linii danej osoby) — ALE tylko
    # te opisujące zdarzenie, nie czyste etykiety pokrewieństwa/pochodzenia/statusu.
    POKREW_ONLY = re.compile(r"^(mąż|maz|żona|zona|wdowa|wdowiec|brat|siostra|syn|córka|corka|"
                             r"ojciec|matka|teść|tesc|teściowa|tesciowa|szwagier|szwagierka|"
                             r"pasierb|pasierbica|macocha|ojczym|mieszczanin|mieszczka|"
                             r"obywatel|obywatelka|ze wsi|z miasta)\b.{0,30}$",
                             re.IGNORECASE)
    for l in ludzie:
        osoba = (l[0] or "").strip() if len(l) > 0 else ""
        uw = (l[3] or "").strip() if len(l) > 3 else ""
        if not uw or not osoba:
            continue
        if POKREW_ONLY.match(uw):
            continue  # sama relacja pokrewieństwa — jest już w kafelku osoby
        # uwaga opisowa: wpleć z podmiotem = nazwa osoby, gdy zdanie go nie ma
        u = uw.strip()
        imie_nazwa = osoba.split()[-1] if osoba else osoba
        # jeśli uwaga zaczyna się od zaimka/bezokolicznika, dodaj podmiot
        if re.match(r"^(nie było go|nie było jej|był|była|grał|grała|wstąpił|"
                    r"wstąpiła|stanął|stanęła|bronił|broniła|szukał|przyszedł|"
                    r"przyszła|został|została|grali|mieszka|mieszkał)", u, re.IGNORECASE):
            u = f"{osoba}: {u[0].lower()}{u[1:]}"
        zdania.append(zdanie(u))
    okol_txt = " ".join(z for z in zdania if z).strip()

    return {"strony": strony, "okol": okol_txt}

kw_counter = defaultdict(int)
matched = 0
charaktery_set = {}
tematy_set = {}
# iterujemy w tej samej kolejności, w jakiej wpisy były dodawane (= kolejność źródła)
for wid, w in wpisy.items():
    key = (w["data"], str(w["skan"]))
    slowa = temat = okol = char = ""
    notatka = ""
    lst = orig_by_key.get(key, [])
    i = used[key]
    if i < len(lst):
        src = lst[i]
        used[key] += 1
        slowa, temat, okol = src["slowa"], src["temat"], src["okol"]
        char = src.get("charakter", "")
        nota = redaguj_notatke(src)
        matched += 1
    else:
        nota = {"strony": "", "okol": ""}
    w["slowa"] = slowa
    w["temat"] = temat
    w["charakter"] = char          # Charakter wpisu (rodzaj czynności sądowej)
    w["okol"] = okol
    w["nota_strony"] = nota["strony"]   # „Strony: …” (z deklinacją rodzajową)
    w["nota_okol"] = nota["okol"]       # „Okoliczności sprawy: …” (okol + uwagi osób)
    w["kw"] = split_kw(slowa)
    if char and char != "-":
        charaktery_set[char] = charaktery_set.get(char, 0) + 1
    if temat and temat != "-":
        tematy_set[temat] = tematy_set.get(temat, 0) + 1
    for t in w["kw"]:
        kw_counter[t.lower()] += 1

charaktery = sorted(charaktery_set, key=lambda c: (-charaktery_set[c], c.lower()))
tematy = sorted(tematy_set, key=lambda t: (-tematy_set[t], t.lower()))

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
p_uwagi = _dd2(list)        # notatki ogólne z pola 'Uwagi' osoby (pochodzenie/okoliczności), bez więzi rodzinnych
p_rodzina = _dd2(list)      # notatki o więzi rodzinnej z pola 'Uwagi' osoby
p_okol = _dd2(list)        # 'Dodatkowe okoliczności' wpisu podpięte pod każdą osobę biorącą udział
p_rel = _dd2(dict)         # wspolwystepujacy -> {"ile":n, "sprawy":[...]}
all_zawody = defaultdict(int)

# słowa wskazujące na realną więź rodzinną w notatce
RODZINA_RE = re.compile(
    r"\b(brat|brata|bracia|siostr|ojc|ojciec|matk|matka|syn|syna|córk|cork|"
    r"żon|zon|mąż|maz|małżon|malzon|teść|tesc|teści|tesci|szwagr|zięć|ziec|"
    r"wdow|pasierb|macoch|ojczym|wnuk|dziadek|babk|krewn|rodzic|rodzeństw|rodzenstw)",
    re.IGNORECASE)

for e in orig_entries:
    ludzie = e["ludzie"]
    nazwy = [l[0] for l in ludzie if l[0]]
    # zbiorcza notka okoliczności tej sprawy (podpinana pod każdą osobę biorącą udział)
    okol_note = ""
    if e.get("okol"):
        etykieta = (e["temat"] or e["charakter"] or "sprawa")
        data_sfx = f" ({e['data']})" if e.get("data") else ""
        okol_note = f"{etykieta}{data_sfx}: {e['okol']}"
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
            if RODZINA_RE.search(uw):
                p_rodzina[key].append(uw)
            else:
                p_uwagi[key].append(uw)
        if okol_note and okol_note not in p_okol[key]:
            p_okol[key].append(okol_note)
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
    rodz = p_rodzina.get(key, [])
    rel = p_rel.get(key, {})
    # top powiązań po liczbie wspólnych spraw
    rel_list = sorted(rel.items(), key=lambda kv: -kv[1]["ile"])
    o["zawody"] = zaw
    o["uwagi"] = uw[:12]
    o["rodzina"] = rodz[:12]
    o["okolicznosci"] = p_okol.get(key, [])[:12]
    # liczba wystąpień jako int (do sortowania); fallback z pola tekstowego
    try:
        o["liczba_n"] = int(str(o.get("liczba", "")).strip() or 0)
    except ValueError:
        o["liczba_n"] = 0
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

# =====================================================================
# DOŁĄCZENIE BAZY 1712–1713 (H:\Wiśnicz\Baza1.xlsx)
# Inny, bogatszy schemat kolumn: ma jawną 'Rola' (10) i 'Skąd?' (12),
# przez co kolumny po nich są przesunięte względem bazy 1724–1736.
# Budujemy wpisy/osoby/miejsca bezpośrednio z tego pliku i scalamy.
# =====================================================================
BAZA1 = r"H:\Wiśnicz\Baza1.xlsx"
import os as _os
if _os.path.exists(BAZA1):
    b1 = openpyxl.load_workbook(BAZA1, read_only=True, data_only=True)
    bws = b1[b1.sheetnames[0]]
    bit = bws.iter_rows(values_only=True)
    next(bit)  # nagłówek
    def bc(r, i):
        return "" if i >= len(r) or r[i] is None else str(r[i]).strip()
    # mapowanie kolumn Baza1
    B = dict(ID=0, DZ=1, MI=2, RO=3, STR=4, SKAN=5, KTO=6, ZKIM=7, STAN=8,
             OSOBA=9, ROLA=10, ZAW=11, SKAD=12, UW=13, TEMAT=14, CHAR=15,
             SLOWA=16, OKOL=17)
    b1_entries = []
    cur = None
    for r in bit:
        if bc(r, B["ID"]):
            rok, mie, dz = bc(r, B["RO"]), bc(r, B["MI"]), bc(r, B["DZ"])
            try:
                data = f"{int(rok):04d}-{int(mie):02d}-{int(dz):02d}"
            except ValueError:
                data = rok
            cur = {
                "id_src": bc(r, B["ID"]), "data": data,
                "skan": bc(r, B["SKAN"]), "strona": bc(r, B["STR"]),
                "kto": bc(r, B["KTO"]), "zkim": bc(r, B["ZKIM"]),
                "temat": bc(r, B["TEMAT"]), "charakter": bc(r, B["CHAR"]),
                "slowa": bc(r, B["SLOWA"]), "okol": bc(r, B["OKOL"]),
                "ludzie": [],   # (osoba, stan, zaw, uw, rola, skad)
            }
            b1_entries.append(cur)
        if cur is not None:
            osoba = bc(r, B["OSOBA"])
            if osoba or bc(r, B["UW"]) or bc(r, B["ZAW"]):
                cur["ludzie"].append((osoba, bc(r, B["STAN"]), bc(r, B["ZAW"]),
                                      bc(r, B["UW"]), bc(r, B["ROLA"]), bc(r, B["SKAD"])))
    b1.close()

    # numeracja id_wpisu w obrębie dnia (jak w bazie 1724–1736): RRRR-MM-DD_NN
    _bycount = defaultdict(int)
    def is_junk(n):
        n = (n or "").strip()
        return (not n) or n in ("?", "-", "—") or len(re.sub(r"[^0-9A-Za-zĄąĆćĘꣳŃńÓóŚśŻżŹź]", "", n)) < 3

    # mapowanie roli Baza1 -> spójne role strony
    def rola_std(rola, osoba_name, kto, zkim):
        rl = (rola or "").strip().lower()
        if rl.startswith("pokrzyw"): return "powód / wnoszący"
        if rl.startswith("oskarż") or rl.startswith("oskarz"): return "pozwany / strona przeciwna"
        if rl.startswith("apelant"): return "powód / wnoszący"
        if rl.startswith("świad") or rl.startswith("swiad"): return "osoba wzmiankowana"
        return "osoba wzmiankowana"

    # agregaty osób z Baza1 (dołączymy do istniejących p_* i idx_osob)
    b1_rows_count = 0
    b1_idx = {}  # pnorm -> rekord indeksu osoby budowany z Baza1
    place_pages = defaultdict(set)   # miejsce (ze 'Skąd?') -> set stron
    place_count = defaultdict(int)

    for e in b1_entries:
        _bycount_key = (e["data"],)
        _bycount[_bycount_key] += 1
        nn = f"{_bycount[_bycount_key]:02d}"
        wid = f"{e['data']}_{nn}"
        # złóż notatkę (Strony + Okoliczności, z wplecionymi uwagami osób wzmiankowanych)
        nota_wpisu = redaguj_notatke(e)
        osoby_wpisu = []
        nazwy_norm = [pnorm(l[0]) for l in e["ludzie"] if l[0] and not is_junk(l[0])]
        for (osoba, stan, zaw, uw, rola, skad) in e["ludzie"]:
            if is_junk(osoba):
                continue
            b1_rows_count += 1
            parts = osoba.split()
            imie = parts[0] if len(parts) > 1 else ""
            nazwisko = " ".join(parts[1:]) if len(parts) > 1 else osoba
            rola_s = rola_std(rola, osoba, e["kto"], e["zkim"])
            uwagi_pola = " · ".join([x for x in (zaw, (("ze " + skad) if skad else ""), uw) if x])
            osoby_wpisu.append({
                "imie": imie, "nazwisko": nazwisko, "rola": rola_s,
                "status": stan, "miejscowosc": skad, "uwagi": uwagi_pola,
            })
            # indeks osoby
            key = pnorm(osoba)
            rec = b1_idx.setdefault(key, {
                "osoba": osoba, "strony": set(), "statusy": set(),
                "zawody": set(), "uwagi": [], "rodzina": [], "okolicznosci": [],
                "powiazania": defaultdict(lambda: {"ile": 0, "sprawy": []}),
                "liczba": 0,
            })
            if e["strona"]:
                rec["strony"].add(e["strona"])
            if stan:
                rec["statusy"].add(stan)
            if zaw:
                rec["zawody"].add(zaw)
                all_zawody[zaw] += 1
            if uw:
                (rec["rodzina"] if RODZINA_RE.search(uw) else rec["uwagi"]).append(uw)
            if skad:
                nota = f"pochodzenie: {skad}"
                if nota not in rec["uwagi"]:
                    rec["uwagi"].append(nota)
            if e["okol"]:
                etyk = (e["temat"] or e["charakter"] or "sprawa") + (f" ({e['data']})" if e["data"] else "")
                okn = f"{etyk}: {e['okol']}"
                if okn not in rec["okolicznosci"]:
                    rec["okolicznosci"].append(okn)
            rec["liczba"] += 1
            # powiązania przez wspólną sprawę
            for inna_name in [l[0] for l in e["ludzie"] if l[0] and not is_junk(l[0])]:
                if pnorm(inna_name) == key:
                    continue
                d = rec["powiazania"][inna_name]
                d["ile"] += 1
                spr = (e["temat"] or e["charakter"] or "sprawa") + (f" ({e['data']})" if e["data"] else "")
                if spr not in d["sprawy"]:
                    d["sprawy"].append(spr)
            # miejsce ze 'Skąd?'
            if skad:
                place_pages[skad].add(e["strona"])
                place_count[skad] += 1

        wpisy[wid] = {
            "id": wid, "skan": e["skan"], "data": e["data"],
            "typ": e["charakter"], "streszczenie": "",
            "pewnosc": "wysoka", "zrodlo": "radziecka 1712–1713",
            "temat": e["temat"], "charakter": e["charakter"],
            "slowa": e["slowa"], "okol": e["okol"],
            "nota_strony": nota_wpisu["strony"], "nota_okol": nota_wpisu["okol"],
            "kw": split_kw(e["slowa"]), "osoby": osoby_wpisu,
        }
        for t in wpisy[wid]["kw"]:
            kw_counter[t.lower()] += 1
        if e["charakter"] and e["charakter"] != "-":
            charaktery_set[e["charakter"]] = charaktery_set.get(e["charakter"], 0) + 1
        if e["temat"] and e["temat"] != "-":
            tematy_set[e["temat"]] = tematy_set.get(e["temat"], 0) + 1

    # scalenie indeksu osób Baza1 z istniejącym idx_osob (po pnorm)
    existing_by_key = {pnorm(o["osoba"]): o for o in idx_osob}
    for key, rec in b1_idx.items():
        strony_str = ", ".join(sorted(rec["strony"], key=lambda s: (len(s), s)))
        pw = [{"osoba": nm, "ile": d["ile"], "sprawy": d["sprawy"][:5]}
              for nm, d in sorted(rec["powiazania"].items(), key=lambda kv: -kv[1]["ile"])[:25]]
        if key in existing_by_key:
            o = existing_by_key[key]  # ta sama osoba też w 1724–1736 — dołóż
            o["liczba_n"] = (o.get("liczba_n", 0) or 0) + rec["liczba"]
            o["liczba"] = str(o["liczba_n"])
            # scal strony
            old_pages = [p for p in (o.get("strony", "").split(", ")) if p]
            o["strony"] = ", ".join(old_pages + [p for p in rec["strony"] if p not in old_pages])
            o["zawody"] = sorted(set(o.get("zawody", [])) | rec["zawody"])
            o["uwagi"] = (o.get("uwagi", []) + rec["uwagi"])[:12]
            o["rodzina"] = (o.get("rodzina", []) + rec["rodzina"])[:12]
            o["okolicznosci"] = (o.get("okolicznosci", []) + rec["okolicznosci"])[:12]
            o["powiazania"] = (o.get("powiazania", []) + pw)[:30]
            if rec["statusy"]:
                st = set(filter(None, (o.get("statusy", "") or "").split(", "))) | rec["statusy"]
                o["statusy"] = ", ".join(sorted(st))
        else:
            idx_osob.append({
                "osoba": rec["osoba"], "liczba": str(rec["liczba"]),
                "liczba_n": rec["liczba"], "strony": strony_str,
                "statusy": ", ".join(sorted(rec["statusy"])),
                "zawody": sorted(rec["zawody"]), "uwagi": rec["uwagi"][:12],
                "rodzina": rec["rodzina"][:12], "okolicznosci": rec["okolicznosci"][:12],
                "powiazania": pw,
                "_zaw_norm": pnorm(" ".join(sorted(rec["zawody"]))),
            })

    # scalenie indeksu miejsc (ze 'Skąd?') z istniejącym idx_miejsc
    existing_place = {pnorm(m["miejsce"]): m for m in idx_miejsc}
    for miejsce, pages in place_pages.items():
        k = pnorm(miejsce)
        pages_str = ", ".join(sorted({p for p in pages if p}, key=lambda s: (len(s), s)))
        if k in existing_place:
            m = existing_place[k]
            old = [p for p in (m.get("strony", "").split(", ")) if p]
            m["strony"] = ", ".join(old + [p for p in pages if p and p not in old])
            try:
                m["liczba"] = str(int(str(m.get("liczba", "0")).strip() or 0) + place_count[miejsce])
            except ValueError:
                m["liczba"] = str(place_count[miejsce])
        else:
            idx_miejsc.append({"miejsce": miejsce, "liczba": str(place_count[miejsce]),
                               "strony": pages_str})

    # odśwież listy filtrów po dołączeniu
    charaktery = sorted(charaktery_set, key=lambda c: (-charaktery_set[c], c.lower()))
    tematy = sorted(tematy_set, key=lambda t: (-tematy_set[t], t.lower()))
    kw_canon = {}
    for w in wpisy.values():
        for t in w.get("kw", []):
            lk = t.lower()
            if lk not in kw_canon:
                kw_canon[lk] = t
    slowa_klucze = sorted(kw_canon.values(), key=lambda t: (-kw_counter[t.lower()], t.lower()))
    zawody_lista = sorted(all_zawody, key=lambda z: (-all_zawody[z], z.lower()))
    print("Dołączono Baza1 1712–1713:", len(b1_entries), "wpisów,", b1_rows_count, "wierszy osób")
else:
    print("UWAGA: nie znaleziono", BAZA1, "— pomijam dołączenie 1712–1713")

# sortowanie osób w każdym wpisie wg roli: powód → pozwany → wzmiankowani
def _rola_rank(rola):
    r = (rola or "").lower()
    if "powod" in r or "wnosz" in r:
        return 0
    if "pozwan" in r or "przeciw" in r:
        return 1
    return 2
for _w in wpisy.values():
    if _w.get("osoby"):
        _w["osoby"].sort(key=lambda o: _rola_rank(o.get("rola", "")))

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
        "charaktery": charaktery,     # Charakter wpisu (rodzaj czynności) — do filtra
        "tematy": tematy,             # Temat sprawy (przedmiot) — do filtra
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
