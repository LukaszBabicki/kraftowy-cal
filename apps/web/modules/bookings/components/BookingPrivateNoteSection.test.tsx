import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingPrivateNoteSection } from "./BookingPrivateNoteSection";

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  upsert: vi.fn(),
  remove: vi.fn(),
  setData: vi.fn(),
  upsertOpts: {} as { onSuccess?: (d: unknown) => void; onError?: (e: unknown) => void },
  removeOpts: {} as { onSuccess?: () => void; onError?: (e: unknown) => void },
  toast: vi.fn(),
}));

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({ t: (k: string, o?: { count?: number }) => (o?.count ? `${k}:${o.count}` : k) }),
}));
vi.mock("@calcom/ui/components/toast", () => ({ showToast: state.toast }));
vi.mock("@calcom/trpc/react", () => ({
  trpc: {
    useUtils: () => ({ viewer: { bookings: { getPrivateNote: { setData: state.setData } } } }),
    viewer: {
      bookings: {
        getPrivateNote: { useQuery: () => state.query },
        upsertPrivateNote: {
          useMutation: (o: typeof state.upsertOpts) => {
            state.upsertOpts = o;
            return { mutate: state.upsert, isPending: false };
          },
        },
        deletePrivateNote: {
          useMutation: (o: typeof state.removeOpts) => {
            state.removeOpts = o;
            return { mutate: state.remove, isPending: false };
          },
        },
      },
    },
  },
}));

const ok = (data: unknown) => ({ isLoading: false, isError: false, isSuccess: true, data, refetch: vi.fn() });

describe("BookingPrivateNoteSection", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("renders nothing for a non-participant (FORBIDDEN) and for NOT_FOUND", () => {
    for (const code of ["FORBIDDEN", "NOT_FOUND"]) {
      state.query = { isLoading: false, isError: true, isSuccess: false, error: { data: { code } } };
      const { container, unmount } = render(<BookingPrivateNoteSection bookingUid="u" />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("shows a loading placeholder", () => {
    state.query = { isLoading: true, isError: false, isSuccess: false };
    render(<BookingPrivateNoteSection bookingUid="u" />);
    expect(screen.getByTestId("private-note-loading")).toBeInTheDocument();
  });

  it("shows an error with retry for other failures", () => {
    const refetch = vi.fn();
    state.query = {
      isLoading: false,
      isError: true,
      isSuccess: false,
      error: { data: { code: "INTERNAL_SERVER_ERROR" } },
      refetch,
    };
    render(<BookingPrivateNoteSection bookingUid="u" />);
    expect(screen.getByRole("alert")).toHaveTextContent("private_note_load_error");
    fireEvent.click(screen.getByText("try_again"));
    expect(refetch).toHaveBeenCalled();
  });

  it("adds a note: save disabled until text is entered, then mutates with raw text", () => {
    state.query = ok(null);
    render(<BookingPrivateNoteSection bookingUid="u" />);
    fireEvent.click(screen.getByTestId("private-note-add"));
    expect(screen.getByTestId("private-note-save")).toBeDisabled();
    fireEvent.change(screen.getByTestId("private-note-input"), { target: { value: "  hello " } });
    fireEvent.click(screen.getByTestId("private-note-save"));
    expect(state.upsert).toHaveBeenCalledWith({ bookingUid: "u", text: "  hello " });
  });

  it("disables save and shows an error when over the limit", () => {
    state.query = ok(null);
    render(<BookingPrivateNoteSection bookingUid="u" />);
    fireEvent.click(screen.getByTestId("private-note-add"));
    fireEvent.change(screen.getByTestId("private-note-input"), { target: { value: "x".repeat(5001) } });
    expect(screen.getByTestId("private-note-save")).toBeDisabled();
    expect(screen.getByTestId("private-note-error")).toHaveTextContent("private_note_too_long_error:5000");
  });

  it("renders saved text as plain text (no HTML injection) and allows editing prefilled", () => {
    state.query = ok({ text: "<b>bold</b>\nline2", updatedAt: new Date() });
    render(<BookingPrivateNoteSection bookingUid="u" />);
    const text = screen.getByTestId("private-note-text");
    expect(text.textContent).toBe("<b>bold</b>\nline2");
    expect(text.querySelector("b")).toBeNull();
    fireEvent.click(screen.getByTestId("private-note-edit"));
    expect(screen.getByTestId("private-note-input")).toHaveValue("<b>bold</b>\nline2");
  });

  it("requires confirmation before deleting", () => {
    state.query = ok({ text: "n", updatedAt: new Date() });
    render(<BookingPrivateNoteSection bookingUid="u" />);
    fireEvent.click(screen.getByTestId("private-note-delete"));
    expect(state.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("private-note-delete-confirm"));
    expect(state.remove).toHaveBeenCalledWith({ bookingUid: "u" });
  });

  it("shows an error message when saving fails and keeps the editor open", () => {
    state.query = ok(null);
    render(<BookingPrivateNoteSection bookingUid="u" />);
    fireEvent.click(screen.getByTestId("private-note-add"));
    fireEvent.change(screen.getByTestId("private-note-input"), { target: { value: "a" } });
    act(() => state.upsertOpts.onError?.({ data: { code: "INTERNAL_SERVER_ERROR" } }));
    expect(state.toast).toHaveBeenCalledWith("private_note_save_error", "error");
  });

  it("does not carry editing state to another booking when remounted with a new key (sheet navigation)", () => {
    state.query = ok(null);
    const { rerender } = render(<BookingPrivateNoteSection key="A" bookingUid="A" />);
    fireEvent.click(screen.getByTestId("private-note-add"));
    fireEvent.change(screen.getByTestId("private-note-input"), { target: { value: "note for A" } });
    rerender(<BookingPrivateNoteSection key="B" bookingUid="B" />);
    expect(screen.queryByTestId("private-note-input")).toBeNull();
    expect(screen.getByTestId("private-note-add")).toBeInTheDocument();
  });

  it("hides the section when a mutation reveals access was lost (FORBIDDEN)", () => {
    state.query = ok({ text: "n", updatedAt: new Date() });
    const { container } = render(<BookingPrivateNoteSection bookingUid="u" />);
    act(() => state.removeOpts.onError?.({ data: { code: "FORBIDDEN" } } as never));
    expect(container).toBeEmptyDOMElement();
  });
});
