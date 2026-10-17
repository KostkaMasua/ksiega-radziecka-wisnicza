# Księga radziecka Wiśnicza 1712–1736 — baza wpisów i osób

Statyczna strona (GitHub Pages) z wyszukiwarką wpisów sądowych i osób z księgi
radzieckiej (akt rady miejskiej) miasta Nowy Wiśnicz z lat 1712–1736.

Układ i sposób działania wzorowane na projekcie
[„Zaginieni i poszukiwani w edyktach”](https://machmi-pro.github.io/zaginieni-w-edyktach/).

## Dwa widoki (przełącznik u góry strony)

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
data/data.json    – dane wyeksportowane z pliku xlsx
.nojekyll         – wyłącza przetwarzanie Jekyll (serwuje folder data/)
```

## Aktualizacja danych

Dane pochodzą z pliku `Baza_Ksiega_radziecka_Wisnicza_1712-1736.xlsx`
(arkusze: WPISY, OSOBY, Indeks osób, Indeks miejsc). Po zmianie w xlsx
wygeneruj ponownie `data/data.json` skryptem eksportu i wykonaj commit.

## Źródło

Zindeksowana księga radziecka miasta Nowy Wiśnicz 1712–1736. Nazwy osobowe
zachowują oryginalną łacińsko-polską pisownię źródła (stąd możliwe warianty
fleksyjne tej samej osoby).
