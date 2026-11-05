# Prywatne notatki do rezerwacji – specyfikacja

## 1. Ustalenia z rozpoznania repozytorium
- Brak istniejącej funkcjonalności prywatnych notatek. `BookingInternalNote` (+ `handleInternalNote`) to presety
  powodu **anulowania** wybierane przez hosta w dialogu anulowania – nie jest to notatka użytkownika.
  `Booking.description` to „additional notes” podane przez uczestnika przy rezerwacji i jest widoczne dla wszystkich.
- Szczegóły rezerwacji zalogowanego użytkownika: `BookingDetailsSheet` (`apps/web/modules/bookings/components`),
  dane dodatkowe przez `trpc.viewer.bookings.getBookingDetails`.
- **Uwaga bezpieczeństwa:** `BookingAccessService` używa lokalnego stubu `PermissionCheckService`, który zawsze zwraca `true`
  (gałąź zespołowa/organizacyjna). Dlatego notatki NIE mogą polegać na tym serwisie – używają własnej, ścisłej kontroli uczestnictwa.

## 2. Model domenowy
Jedna prywatna notatka na parę (rezerwacja, użytkownik).

`BookingPrivateNote`: `id`, `bookingId` (FK → Booking, onDelete Cascade), `userId` (FK → users, onDelete Cascade),
`text` (String), `createdAt`, `updatedAt`. `@@unique([bookingId, userId])`, `@@index([userId])`.

Notatka jest w osobnej tabeli, więc nie trafia do payloadów rezerwacji, maili, webhooków, wydarzeń kalendarza ani
powiadomień (brak regresji w tych mechanizmach).

## 3. Reguły autoryzacji
Użytkownik jest uprawniony do notatki, gdy jest zalogowany ORAZ jest uczestnikiem rezerwacji:
- organizatorem (`booking.userId === user.id`), albo
- uczestnikiem, którego adres e-mail (porównanie bez rozróżniania wielkości liter) równa się głównemu adresowi użytkownika
  na liście `attendees` (obejmuje współgospodarzy wydarzeń zbiorowych).

Administrator zespołu/organizacji, który nie jest uczestnikiem, **nie** ma dostępu. Każdy użytkownik widzi wyłącznie własną notatkę
(zapytania zawsze filtrowane po `userId` z sesji; `userId` nigdy nie pochodzi z wejścia).

## 4. API (tRPC `viewer.bookings`)
Wszystkie procedury: `authedProcedure`.
| Procedura | Wejście | Wynik |
|---|---|---|
| `getPrivateNote` (query) | `{ bookingUid }` | `{ text, updatedAt } \| null` |
| `upsertPrivateNote` (mutation) | `{ bookingUid, text }` | `{ text, updatedAt }` |
| `deletePrivateNote` (mutation) | `{ bookingUid }` | `{ deleted: boolean }` (idempotentne) |

Walidacja `text`: po `trim()` długość 1–5000 znaków; białe znaki same w sobie są odrzucane (`BAD_REQUEST`). `bookingUid`: niepusty string.
Kody błędów: brak sesji → `UNAUTHORIZED`; brak rezerwacji → `NOT_FOUND`; nie-uczestnik → `FORBIDDEN`;
nieudany zapis do bazy → `INTERNAL_SERVER_ERROR` z ogólnym komunikatem (bez szczegółów DB).

## 5. UI
W `BookingDetailsSheet` (zakładka „info”) sekcja „Prywatne notatki” widoczna dla uprawnionego użytkownika:
- podpowiedź „Widoczne tylko dla Ciebie. Nie są udostępniane uczestnikom.”,
- stan pusty → przycisk „Dodaj notatkę” → textarea + Zapisz/Anuluj,
- stan zapisany → tekst (`whitespace-pre-wrap`, renderowany jako zwykły tekst) + Edytuj / Usuń (Usuń z potwierdzeniem),
- licznik znaków i limit 5000, wyłączony przycisk Zapisz dla pustej treści, stany ładowania, komunikaty błędów (toast + tekst przy polu),
- układ responsywny (przyciski zawijane/pełnej szerokości na mobile, `flex-wrap`), tekst z `break-words`.
- Gdy `getPrivateNote` zwróci FORBIDDEN lub NOT_FOUND (np. admin zespołu, który nie jest uczestnikiem), sekcja **nie jest renderowana**. Inne błędy (sieć, 500) pokazują komunikat błędu z możliwością ponowienia.
- Teksty w `en` i `pl` (`packages/i18n/locales/{en,pl}/common.json`).

## 6. Kryteria odbioru
- K1 Notatka jest trwale zapisywana w DB i odczytywana po ponownym otwarciu szczegółów.
- K2 Dodawanie, edycja (nadpisanie), usuwanie działają; usunięcie jest idempotentne.
- K3 Notatka dostępna wyłącznie dla jej właściciela-uczestnika; inny użytkownik (także admin zespołu, drugi uczestnik) nie widzi ani nie modyfikuje cudzej notatki.
- K4 Błędy: pusty/za długi tekst (BAD_REQUEST), brak sesji (UNAUTHORIZED), brak rezerwacji (NOT_FOUND), brak uprawnień (FORBIDDEN), błąd zapisu (INTERNAL_SERVER_ERROR, bez wycieku szczegółów) – obsłużone w API i w UI.
- K5 Treść notatki nie występuje w żadnym istniejącym payloadzie rezerwacji, mailu, webhooku ani wpisie kalendarza.
- K6 Usunięcie rezerwacji lub użytkownika usuwa notatki (kaskada); brak wpływu na istniejące rezerwacje.
- K7 Testy jednostkowe (serwis, schematy), integracyjne (DB: upsert/unikalność/kaskada/izolacja), komponentowe (UI) oraz regresyjne
  (istniejące testy `BookingDetailsSheet`) przechodzą.
- K8 UI działa na desktopie i w widoku mobilnym (zrzuty ekranu).
- K9 Migracja wykonywana tylko na izolowanej bazie testowej (kontener Docker), nigdy na bazie produkcyjnej.

## 6a. Decyzje po review specyfikacji (potwierdzone braki)
- Notatka jest przypisana do konkretnego `Booking` (uid). Rezerwacje cykliczne (osobne rekordy) i przełożone (nowe uid) **nie dziedziczą** notatek.
- Uczestnictwo = organizator lub attendee z głównym e-mailem użytkownika (bez rozróżniania wielkości liter). Świadome ograniczenia:
  weryfikowane dodatkowe adresy e-mail (`SecondaryEmail`) oraz hosty z `eventType.hosts`, którzy nie są ani organizatorem, ani attendee, nie mają notatek;
  zmiana głównego e-maila po utworzeniu notatki powoduje utratę dostępu do niej (wiersz pozostaje w bazie).
- Usunięcie organizatora kaskadowo usuwa jego rezerwacje, a z nimi notatki wszystkich uczestników (zgodne z istniejącą semantyką `Booking.user onDelete: Cascade`).
- Sprawdzenie K5 realizowane testem: relacja `privateNotes` nie jest dołączana do żadnego jawnego selectu w `packages/prisma/selects/booking.ts` oraz grepem po `include` na booking.
- Brak wspólnego NOT_FOUND dla 403 (uid są nieodgadywalne; ryzyko oracle akceptowane).
- Testy komponentowe UI piszemy od zera (`BookingDetailsSheet.test.tsx` testuje tylko store).

## 7. Poza zakresem
Wiele notatek na rezerwację, współdzielenie notatek, wyszukiwanie po notatkach, notatki w widoku publicznym `/booking/[uid]`,
API v2/platform, eksport.
