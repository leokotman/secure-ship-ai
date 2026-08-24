import { create } from "zustand";

export type ChatState =
  | "anonymous"
  | "collecting_identity"
  | "code_sent"
  | "awaiting_code"
  | "verified"
  | "escalated_to_human";

interface SessionStore {
  sessionId: string;
  chatState: ChatState;
  firstName: string | null;
  setSessionId: (id: string) => void;
  setChatState: (state: ChatState) => void;
  setFirstName: (name: string | null) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessionId: "",
  chatState: "anonymous",
  firstName: null,

  setSessionId: (id) => set({ sessionId: id }),
  setChatState: (state) => set({ chatState: state }),
  setFirstName: (name) => set({ firstName: name }),
  reset: () => set({ sessionId: "", chatState: "anonymous", firstName: null }),
}));
