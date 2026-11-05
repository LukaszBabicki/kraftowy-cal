"use client";

import { BOOKING_PRIVATE_NOTE_MAX_LENGTH } from "@calcom/features/bookings/lib/privateNotes/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { TextArea } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";
import { useState } from "react";

type Mode = "view" | "edit" | "confirmDelete";

const isHiddenError = (code?: string) => code === "FORBIDDEN" || code === "NOT_FOUND";

export function BookingPrivateNoteSection({ bookingUid }: { bookingUid: string }) {
  const { t } = useLocale();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [accessLost, setAccessLost] = useState(false);

  const query = trpc.viewer.bookings.getPrivateNote.useQuery(
    { bookingUid },
    { retry: (count, err) => !isHiddenError(err.data?.code) && count < 2 }
  );

  const upsert = trpc.viewer.bookings.upsertPrivateNote.useMutation({
    onSuccess: async (data) => {
      utils.viewer.bookings.getPrivateNote.setData({ bookingUid }, data);
      setMode("view");
      setFieldError(null);
      showToast(t("private_note_saved"), "success");
    },
    onError: (err) => {
      if (isHiddenError(err.data?.code)) return setAccessLost(true);
      setFieldError(t("private_note_save_error"));
      showToast(t("private_note_save_error"), "error");
    },
  });

  const remove = trpc.viewer.bookings.deletePrivateNote.useMutation({
    onSuccess: () => {
      utils.viewer.bookings.getPrivateNote.setData({ bookingUid }, null);
      setMode("view");
      showToast(t("private_note_deleted"), "success");
    },
    onError: (err) => {
      setMode("view");
      if (isHiddenError(err.data?.code)) return setAccessLost(true);
      showToast(t("private_note_delete_error"), "error");
    },
  });

  // Not a participant (e.g. team admin) or booking gone: the feature is simply not offered.
  if (accessLost || (query.isError && isHiddenError(query.error.data?.code))) return null;

  const note = query.data ?? null;
  const trimmedLength = draft.trim().length;
  const tooLong = trimmedLength > BOOKING_PRIVATE_NOTE_MAX_LENGTH;
  const canSave = trimmedLength > 0 && !tooLong && !upsert.isPending;

  const startEdit = () => {
    setDraft(note?.text ?? "");
    setFieldError(null);
    setMode("edit");
  };

  const save = () => {
    if (trimmedLength === 0) return setFieldError(t("private_note_empty_error"));
    if (tooLong)
      return setFieldError(t("private_note_too_long_error", { count: BOOKING_PRIVATE_NOTE_MAX_LENGTH }));
    upsert.mutate({ bookingUid, text: draft });
  };

  return (
    <div className="flex flex-col gap-1" data-testid="booking-private-note">
      <h3 className="font-medium text-subtle text-xs">{t("private_note")}</h3>
      <p className="text-muted text-xs">{t("private_note_visibility_hint")}</p>

      {query.isLoading && (
        <div className="h-8 w-full animate-pulse rounded-md bg-subtle" data-testid="private-note-loading" />
      )}

      {query.isError && !query.isLoading && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-error text-sm" role="alert">
            {t("private_note_load_error")}
          </p>
          <Button color="minimal" size="sm" onClick={() => query.refetch()}>
            {t("try_again")}
          </Button>
        </div>
      )}

      {query.isSuccess && mode === "edit" && (
        <div className="flex flex-col gap-2">
          <TextArea
            data-testid="private-note-input"
            autoFocus
            aria-describedby="private-note-error"
            value={draft}
            rows={4}
            placeholder={t("private_note_placeholder")}
            aria-label={t("private_note")}
            aria-invalid={!!fieldError || tooLong}
            onChange={(e) => {
              setDraft(e.target.value);
              setFieldError(null);
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-error text-xs"
              id="private-note-error"
              role={tooLong || fieldError ? "alert" : undefined}
              data-testid="private-note-error">
              {tooLong
                ? t("private_note_too_long_error", { count: BOOKING_PRIVATE_NOTE_MAX_LENGTH })
                : fieldError}
            </span>
            <span className="shrink-0 text-muted text-xs">
              {trimmedLength}/{BOOKING_PRIVATE_NOTE_MAX_LENGTH}
            </span>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              color="minimal"
              className="w-full justify-center sm:w-auto"
              onClick={() => setMode("view")}
              disabled={upsert.isPending}>
              {t("cancel")}
            </Button>
            <Button
              data-testid="private-note-save"
              className="w-full justify-center sm:w-auto"
              onClick={save}
              disabled={!canSave}
              loading={upsert.isPending}>
              {t("save")}
            </Button>
          </div>
        </div>
      )}

      {query.isSuccess && mode !== "edit" && !note && (
        <div>
          <Button data-testid="private-note-add" color="secondary" size="sm" onClick={startEdit}>
            {t("private_note_add")}
          </Button>
        </div>
      )}

      {query.isSuccess && mode !== "edit" && note && (
        <div className="flex flex-col gap-2">
          <p
            data-testid="private-note-text"
            className="whitespace-pre-wrap break-words font-medium text-emphasis text-sm">
            {note.text}
          </p>
          {mode === "confirmDelete" ? (
            <div
              className="flex flex-col gap-2"
              role="alertdialog"
              aria-label={t("private_note_delete_confirm")}>
              <p className="text-default text-sm">{t("private_note_delete_confirm")}</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button
                  color="minimal"
                  className="w-full justify-center sm:w-auto"
                  onClick={() => setMode("view")}
                  disabled={remove.isPending}>
                  {t("cancel")}
                </Button>
                <Button
                  data-testid="private-note-delete-confirm"
                  color="destructive"
                  className="w-full justify-center sm:w-auto"
                  loading={remove.isPending}
                  onClick={() => remove.mutate({ bookingUid })}>
                  {t("delete")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button data-testid="private-note-edit" color="secondary" size="sm" onClick={startEdit}>
                {t("edit")}
              </Button>
              <Button
                data-testid="private-note-delete"
                color="destructive"
                variant="icon"
                size="sm"
                StartIcon="trash"
                aria-label={t("delete")}
                onClick={() => setMode("confirmDelete")}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
