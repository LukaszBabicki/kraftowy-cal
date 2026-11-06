# Prywatne notatki do rezerwacji – raport końcowy

Gałąź: `feature/06-02-autonomia` (zmiany lokalne, bez push). Specyfikacja i kryteria odbioru: [SPEC.md](./SPEC.md).

Spis: 0 brief · 1 ustalenia · 2 zakres · 3 kryteria odbioru · 4 testy · 5 dowody działania · 6 review specyfikacji · 7 review kodu i poprawki · 8 elementy niesprawdzone · 9 ręczny odbiór użytkownika.

## 0. Oryginalny brief
Treść pierwszej wiadomości zadania odtworzona dosłownie z historii sesji (bez zmian):

`````markdown
# Z1-06.02 – Autonomiczna implementacja modułu notatek do rezerwacji

## Cel
Zbuduj kompletny moduł prywatnych notatek do rezerwacji w aplikacji kraftowy-cal.

## Problem użytkownika
Użytkownik chce przechowywać własne informacje dotyczące spotkań, bez udostępniania ich zaproszonym uczestnikom.

## Scenariusz
Użytkownik otwiera szczegóły swojej rezerwacji, dodaje notatkę i zapisuje ją. Po ponownym otwarciu rezerwacji widzi zapisaną treść. Może ją edytować lub usunąć.

## Kryteria odbioru
- Notatki są trwale zapisywane i odczytywane z bazy danych.
- Możliwe jest dodawanie, edycja i usuwanie notatek.
- Notatki dostępne są wyłącznie dla uprawnionego właściciela.
- Obsłużone są błędne dane, brak uprawnień, brak rezerwacji i błędy zapisu.
- Istniejące rezerwacje, powiadomienia i mechanizmy autoryzacji działają bez regresji.
- Interfejs działa na desktopie i urządzeniach mobilnych.

Najpierw sprawdź, czy funkcjonalność nie istnieje już w repozytorium. Jeśli jest dostępna w całości, zatrzymaj się i przedstaw ustalenia zamiast tworzyć duplikat.

## Granice
- Pracuj wyłącznie na gałęzi feature/06-02-autonomia w bieżącym worktree.
- Nie modyfikuj produkcji ani produkcyjnych danych.
- Zmiany schematu i migracje wykonuj wyłącznie w izolowanym środowisku testowym.
- Nie wykonuj deployu ani push do zdalnego repozytorium.
- Nie obchodź zabezpieczeń, hooków ani polityk Git.
- Nie zmieniaj istniejącego hooka pre-push.
- Nie ingeruj w inne worktree i zadania.

## Autonomiczny proces
1. Poznaj architekturę repozytorium i obowiązujące instrukcje.
2. Przygotuj specyfikację z kryteriami odbioru.
3. Zleć niezależnemu agentowi review specyfikacji i popraw potwierdzone braki.
4. Samodzielnie opracuj plan implementacji.
5. Zaimplementuj pełną funkcjonalność.
6. Dodaj testy jednostkowe, integracyjne i właściwe regresyjne.
7. Uruchom aplikację na danych syntetycznych i sprawdź scenariusz użytkownika od początku do końca.
8. Zbierz zrzuty ekranu i wyniki testów.
9. Zleć niezależnemu agentowi review gotowych zmian.
10. Popraw potwierdzone błędy i ponów odpowiednie testy.

Nie zatrzymuj się po każdym etapie po rutynowe potwierdzenie. Zatrzymaj się przy decyzji produktowej, braku dostępu, ryzyku nieodwracalnych działań albo po trzech nieskutecznych próbach rozwiązania tego samego problemu. Nie omijaj zabezpieczeń.

## Wynik końcowy
Dostarcz kompletną zmianę na osobnej gałęzi oraz raport Markdown zawierający specyfikację, kryteria odbioru, wyniki testów, dowody działania, wyniki obu review, wykonane poprawki i listę elementów niesprawdzonych.

Nie uznawaj zadania za zakończone bez weryfikacji działającej funkcjonalności.
`````

## 1. Ustalenia wstępne
Funkcjonalność **nie istniała**. `BookingInternalNote` to presety powodu anulowania (host), `Booking.description` to uwagi bookera widoczne dla wszystkich.
Wykryte ryzyko bazowe: `PermissionCheckService` w `BookingAccessService` to stub zwracający zawsze `true`, więc notatki mają własną, ścisłą kontrolę uczestnictwa.

## 2. Zakres zmian
- Prisma: model `BookingPrivateNote` + migracja `20261105090000_add_booking_private_note` (unikalność `[bookingId,userId]`, kaskady).
- `BookingPrivateNoteRepository` / `BookingPrivateNoteService` (`packages/features/bookings`).
- tRPC `viewer.bookings.getPrivateNote | upsertPrivateNote | deletePrivateNote` (+ schema, handler z jawną konwersją błędów).
- UI: `BookingPrivateNoteSection` w `BookingDetailsSheet` (desktop + mobile), i18n en/pl.
- Testy: 32 jednostkowe/komponentowe (serwis 13, handler 6, schemat 3, komponent 10) oraz 5 integracyjnych (prawdziwa baza) – liczby zweryfikowane, zob. sekcja 4.

## 3. Specyfikacja i kryteria odbioru – status
Pełna specyfikacja (model domenowy, reguły autoryzacji, API, UI, kryteria K1–K9, decyzje po review §6a, zakres wyłączony): [SPEC.md](./SPEC.md). Kryteria K1–K9 pochodzą z §6 SPEC.md; poniżej status stanu automatycznego (ręczny odbiór użytkownika: sekcja 9).

| Kryterium | Status | Dowód |
|---|---|---|
| K1 trwały zapis/odczyt | ✅ | e2e: po `reload` notatka odczytana z bazy; test integracyjny |
| K2 dodaj/edytuj/usuń, idempotentne usuwanie | ✅ | e2e (zrzuty 01–07), integracyjne, jednostkowe |
| K3 dostęp tylko właściciel-uczestnik | ✅ | HTTP: anonim 401, nie-uczestnik 403, brak rezerwacji 404; integracyjne: izolacja dwóch uczestników |
| K4 obsługa błędów | ✅ (API i UI) | 400 pusty/za długi, 401, 403, 404, 500 bez szczegółów DB (testy jednostkowe); UI: limit, retry, ukrycie sekcji |
| K5 brak wycieku do istniejących payloadów | ✅ częściowo | test integracyjny: `bookingMinimalSelect`, `bookingDetailsSelect`, `findUnique` bez select nie zawierają treści. Webhooki/e-maile/kalendarz: tylko analiza (osobna tabela, brak relacji w selectach) |
| K6 kaskady | ✅ | test integracyjny (usunięcie rezerwacji i użytkownika) |
| K7 testy | ✅ | sekcja 4 |
| K8 desktop + mobile | ✅ | `screenshots/` (18 zrzutów) |
| K9 migracja tylko na izolowanej bazie | ✅ | kontener `kcal-0602-testdb`, port 5462, `migrate diff`: brak różnic |

## 4. Wyniki testów
- Zweryfikowane ponownym uruchomieniem (2026-11-06, `yarn vitest run` na 4 plikach nowego modułu): **32/32 przechodzi**:
  - jednostkowe serwisu (`BookingPrivateNoteService.test.ts`): **13** (11 wywołań `it` + parametryzacja `it.each`);
  - handler (`privateNote.handler.test.ts`): **6**; schemat (`privateNote.schema.test.ts`): **3**;
  - komponentowe (`BookingPrivateNoteSection.test.tsx`): **10**.
  - Wcześniejsza rozbieżność (12+6+3+10 w sekcji 2) nie odpowiadała faktycznej liczbie testów (przyczyny nie ustalano); obowiązują liczby powyżej.
- Integracyjne (`VITEST_MODE=integration`, izolowany kontener `kcal-0602-testdb`, ponownie uruchomione 2026-11-06): `BookingPrivateNoteService.integration-test.ts` **5/5**. Istniejący `get.handler.integration-test.ts` 7/7 – wynik z pierwotnego raportu, w tej weryfikacji nie powtarzany.
- Regresja `apps/web`, `packages/features/bookings`, `packages/trpc/.../bookings`: wynik z logu sesji z 2026-11-05 (nie powtarzany w tej weryfikacji): **1192 przeszło, 15 pominiętych, 3 `todo`**, 1212 łącznie, **2 niepowodzenia** w `apps/web/modules/schedules/components/date-override-list.test.tsx` – test zakodowany na konkretną datę („Thursday, November 5”), niezwiązany ze zmianą (nie dotykam tego modułu).
- Biome: nowe pliki bez błędów; `BookingDetailsSheet.tsx` ma istniejące uwagi formatowania sprzed zmiany (nie reformatowałem pliku).

## 5. Dowody działania (dane syntetyczne, seed Cal.com, użytkownik `pro`)
Scenariusz `e2e-scenario.mjs` (Playwright): logowanie → lista rezerwacji → szczegóły → dodanie → zapis → reload → ponowne otwarcie (treść obecna) → edycja → usunięcie z potwierdzeniem → walidacja 5001 znaków → zapis końcowy. Przeszedł na desktopie (1440×900) i mobile (390×844).
Zrzuty (istniejące, w `screenshots/`):
- desktop: [00-list](./screenshots/desktop-00-list.png), [01-empty](./screenshots/desktop-01-empty.png), [02-editing](./screenshots/desktop-02-editing.png), [03-saved](./screenshots/desktop-03-saved.png), [04-reopened](./screenshots/desktop-04-reopened.png), [05-edited](./screenshots/desktop-05-edited.png), [06-confirm-delete](./screenshots/desktop-06-confirm-delete.png), [07-deleted](./screenshots/desktop-07-deleted.png), [08-too-long](./screenshots/desktop-08-too-long.png)
- mobile: [00-list](./screenshots/mobile-00-list.png), [01-empty](./screenshots/mobile-01-empty.png), [02-editing](./screenshots/mobile-02-editing.png), [03-saved](./screenshots/mobile-03-saved.png), [04-reopened](./screenshots/mobile-04-reopened.png), [05-edited](./screenshots/mobile-05-edited.png), [06-confirm-delete](./screenshots/mobile-06-confirm-delete.png), [07-deleted](./screenshots/mobile-07-deleted.png), [08-too-long](./screenshots/mobile-08-too-long.png)

Uwaga: skrypt `e2e-scenario.mjs` nie robi `reload` po kroku usunięcia (zrzut 07 pokazuje stan UI po usunięciu); trwałość usunięcia po odświeżeniu nie jest więc udowodniona tym scenariuszem (zob. sekcja 9). Usunięcie w bazie jest pokryte jedynie testami automatycznymi (serwis/integracyjne) i wywołaniem HTTP `delete` → `{"deleted":true}`.
Zrzuty były wykonane przed ręcznym odbiorem i są dowodem automatycznego scenariusza, nie ręcznego odbioru. Treść `<b>…</b>` wyświetlana jako zwykły tekst.
Autoryzacja przez realne HTTP (`/api/trpc`): zob. sekcja 6, punkt 2.

```
desktop after reload: "Zadzwonić do klienta przed spotkaniem.\nPrzygotować <b>ofertę</b>."
desktop save disabled at 5001: true
mobile after reload: "Zadzwonić do klienta przed spotkaniem.\nPrzygotować <b>ofertę</b>."
mobile save disabled at 5001: true

--- authz (HTTP)
--- anonymous
get          : 401 UNAUTHORIZED - UNAUTHORIZED
get missing  : 401 UNAUTHORIZED - UNAUTHORIZED
upsert       : 401 UNAUTHORIZED - UNAUTHORIZED
upsert empty : 401 UNAUTHORIZED - UNAUTHORIZED
delete       : 401 UNAUTHORIZED - UNAUTHORIZED
--- free (non-participant)
get          : 403 FORBIDDEN - You do not have permission to access notes of this booking
get missing  : 404 NOT_FOUND - Booking not found
upsert       : 403 FORBIDDEN - You do not have permission to access notes of this booking
upsert empty : 400 BAD_REQUEST - Invalid input
delete       : 403 FORBIDDEN - You do not have permission to access notes of this booking
--- pro (organizer)
get          : 200 {"text":"organizer note","updatedAt":"2026-11-05T22:53:06.126Z"}
get missing  : 404 NOT_FOUND - Booking not found
upsert       : 200 {"text":"intruder","updatedAt":"2026-11-05T22:53:18.904Z"}
upsert empty : 400 BAD_REQUEST - Invalid input
delete       : 200 {"deleted":true}
```

## 6. Review specyfikacji (agent niezależny) i poprawki
Potwierdzone braki → poprawione w SPEC.md §6a: błędna ścieżka locali (`packages/i18n/locales`), niejednoznaczna widoczność UI dla nie-uczestników (sekcja ukrywana na 403/404), decyzje o reschedule/recurring (brak dziedziczenia), secondary e-mail i zmiana głównego e-maila (świadome ograniczenie), kaskada przy usunięciu organizatora, metoda weryfikacji K5, fakt że `BookingDetailsSheet.test.tsx` testuje tylko store.
Niepotwierdzone/odrzucone: oracle 403 vs 404 (uid nieodgadywalne – ryzyko zaakceptowane), wydajność lower(email) (bez znaczenia).

## 7. Review gotowych zmian (agent niezależny) i poprawki
- **[CONFIRMED, wysoka] Stan edycji przeciekał między rezerwacjami przy nawigacji prev/next w panelu** (można było nadpisać notatkę B treścią z A). Poprawka: `key={booking.uid}` na sekcji + 2 testy (zmiana klucza, utrata dostępu).
- [CONFIRMED, niska] Mutacje z 403/404 nie ukrywały sekcji → teraz ukrywają.
- [CONFIRMED, niska] Dostępność: `autoFocus` na polu, `aria-describedby`, `role=alert` tylko przy błędzie. Zarządzanie fokusem po zapisie/usunięciu i Escape w potwierdzeniu: **niewykonane**.
- [PLAUSIBLE] Odczyt nie miał obsługi błędu DB → dodano generyczny 500 + test.
- Teksty pl wyrównane do specyfikacji.
- Odrzucone/nie zmieniane: brak `maxLength` na textarea (świadomie: licznik + komunikat zamiast cichego obcinania wklejanego tekstu).
- Wykryte przy okazji e2e (nie przez agenta): `errorConversionMiddleware` nie konwertuje błędów rzucanych w procedurach (istniejąca `getBookingDetails` też zwraca 500 zamiast 403). Nie zmieniałem wspólnego middleware (ryzyko regresji); notatki konwertują błędy jawnie w handlerach.

## 8. Elementy niesprawdzone / ograniczenia
- Typecheck `apps/web` (`tsc`): w tym środowisku zawodzi typ routera tRPC także w istniejącym kodzie (np. `BookingDetailsSheet.tsx:156` sprzed zmian), więc nie dał wiarygodnego wyniku; `packages/trpc` i `packages/features` – brak błędów dotyczących nowych plików.
- Widok panelu dla nie-uczestnika (np. admin zespołu) w prawdziwym UI: pokryty testem komponentu i HTTP 403, ale nie zrzutem (brak takiego scenariusza w seedzie).
- Wyciek do webhooków, e-maili, wydarzeń kalendarza, API v1/v2: tylko analiza statyczna, bez testu uruchomieniowego.
- Język polski w UI: klucze dodane i zwalidowane jako JSON, ale e2e wykonano w UI angielskim.
- Brak e2e dla rezerwacji zespołowych/collective/seats i dla wielu równoległych sesji.
- Flaga `bookings-v3` była wyłączona w seedzie; włączona tylko w izolowanej bazie testowej dla użytkownika `pro`. Panel (a więc notatki) jest widoczny tylko przy tej fladze – decyzja produktowa o jej wdrożeniu poza zakresem.
- Zarządzanie fokusem a11y, Escape w potwierdzeniu usunięcia, nawigacja klawiaturowa – patrz sekcja 7.
- Test `date-override-list` (2 niepowodzenia) – istniejący, zależny od daty.
- Nie wykonywano deployu ani push; hook `.husky/pre-push` nie był zmieniany (pozostaje nieśledzony, nie dodany do commita).

## 9. Wyniki ręcznego odbioru użytkownika
Wyniki podane przez użytkownika po ręcznym sprawdzeniu funkcjonalności (nie są wynikiem testów automatycznych):

| Scenariusz ręczny | Wynik |
|---|---|
| Dodanie i zapis notatki | PASS |
| Odczyt po odświeżeniu | PASS |
| Edycja notatki | PASS |
| Usunięcie notatki w interfejsie | PASS |
| Trwałość usunięcia po odświeżeniu | **NIEPOTWIERDZONA ręcznie** |

Zastrzeżenie: ostatni punkt nie został sprawdzony ręcznie, więc nie jest zgłaszany jako zaliczony. Nie ma go też w automatycznym scenariuszu e2e (brak `reload` po usunięciu, zob. sekcja 5); w bazie usunięcie weryfikują wyłącznie testy serwisu/integracyjne i wywołanie HTTP `delete`. Do potwierdzenia: usunąć notatkę, odświeżyć stronę, ponownie otworzyć rezerwację i sprawdzić stan pusty.
