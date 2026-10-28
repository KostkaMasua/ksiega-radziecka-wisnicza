# Księga radziecka Wiśnicza 1712–1736 — baza wpisów i osób

Statyczna strona (GitHub Pages) z wyszukiwarką wpisów sądowych i osób z księgi
radzieckiej (akt rady miejskiej) miasta Nowy Wiśnicz z lat 1712–1736.

Układ i sposób działania wzorowane na projekcie
[„Zaginieni i poszukiwani w edyktach”](https://machmi-pro.github.io/zaginieni-w-edyktach/).

## Trzy widoki (zakładki u góry strony)

- **Mapa** — Nowy Wiśnicz według katastru galicyjskiego 1847/1849 na terenie z NMT 1 m
  (rzeczywista wysokość, bez przewyższenia), z modelami domów wschodniej pierzei rynku,
  ratuszem i kościołem. Pliki w folderze `mapa/`, ładowane dopiero po otwarciu zakładki.

Wpisy i Osoby działają w układzie lista + karta: wybór z listy po lewej otwiera pełną kartę
po prawej (na telefonie osobny ekran). Strzałki ↑↓ przechodzą po liście. Każdy wpis i każda
osoba mają własny adres (`#w-…`, `#o-…`) i przyciski do kopiowania linku oraz przypisu.

Poprzednia wersja strony jest zachowana w folderze `archiwum-2026-10/`.

## Widoki danych

- **Wpisy (model A)** — karta to jedna sprawa sądowa: typ, data, streszczenie,
  skan, pewność odczytu oraz rozwijana lista osób z rolami procesowymi.
  Filtry: nazwisko/imię/miejscowość, typ sprawy, rok, rola osoby, pewność odczytu.
- **Osoby (model B)** — karta to jedna osoba z indeksu: status stanowy i numery
  stron rękopisu, na których występuje. Filtr po nazwisku i po numerze strony.

Oba widoki działają na tych samych danych połączonych relacyjnie przez
identyfikator wpisu (Tabela A ↔ Tabela B).

## Struktura

```
index.html        – cała strona (HTML + CSS + JS, bez zależności budowania)
data/data.json    – dane wyeksportowane z arkusza xlsx skryptem eksport_bazy.py
mapa/             – mapa: mapa.js, maplibre.css, teren (kafle NMT), warstwy katastru (GeoJSON),
                    skan 1847, modele domów (GLB)
archiwum-2026-10/ – kopia poprzedniej wersji strony
.nojekyll         – wyłącza przetwarzanie Jekyll (serwuje folder data/)
```

## Aktualizacja danych

Bazę generuje skrypt `eksport_bazy.py` z jednego arkusza źródłowego
(„Księga radziecka Wiśnicza 1712-1736.xlsx”, pierwszy arkusz):

```
python eksport_bazy.py "Księga radziecka Wiśnicza 1712-1736.xlsx"
```

Skrypt zapisuje `data/data.json` i drukuje podsumowanie. Wpisy już obecne w bazie
zachowują swoje identyfikatory (linki `#w-…` działają dalej), nowe dostają kolejny
numer w obrębie dnia. Zredagowane opisy okoliczności pochodzą z `nota_red.json`.
Słowa klucze zapisujemy małymi literami i bez kropek; wyjątki w pisowni źródła
wymienia `KW_ORYGINAL` w skrypcie. Strony sprawy z kolumn Kto / Z kim, których
nie ma wśród osób wpisu, są dopisywane jako osoby. Po eksporcie wystarczy commit.

## Źródło

Zindeksowana księga radziecka miasta Nowy Wiśnicz 1712–1736. Nazwy osobowe
zachowują oryginalną łacińsko-polską pisownię źródła (stąd możliwe warianty
fleksyjne tej samej osoby).
