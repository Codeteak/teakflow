import { create } from 'zustand';

export type AppToastStatus = 'progress' | 'success' | 'error';

export type AppToast = {
  id: string;
  status: AppToastStatus;
  title: string;
  detail?: string;
};

type ToastState = {
  items: AppToast[];
  salesDayVersion: number;
  salesPayVersion: number;
  showProgress: (title: string, detail?: string) => string;
  resolve: (id: string, status: 'success' | 'error', title: string, detail?: string) => void;
  dismiss: (id: string) => void;
  bumpSalesDay: () => void;
  bumpSalesPay: () => void;
};

const dismissTimers = new Map<string, number>();

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  salesDayVersion: 0,
  salesPayVersion: 0,
  showProgress(title, detail) {
    const id = uid();
    set((state) => ({ items: [...state.items, { id, status: 'progress', title, detail }] }));
    return id;
  },
  resolve(id, status, title, detail) {
    if (!get().items.some((item) => item.id === id)) {
      return;
    }
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, status, title, detail } : item)),
    }));
    const previous = dismissTimers.get(id);
    if (previous) {
      window.clearTimeout(previous);
    }
    const timer = window.setTimeout(() => {
      get().dismiss(id);
    }, status === 'success' ? 4200 : 5600);
    dismissTimers.set(id, timer);
  },
  dismiss(id) {
    const previous = dismissTimers.get(id);
    if (previous) {
      window.clearTimeout(previous);
      dismissTimers.delete(id);
    }
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },
  bumpSalesDay() {
    set((state) => ({ salesDayVersion: state.salesDayVersion + 1 }));
  },
  bumpSalesPay() {
    set((state) => ({ salesPayVersion: state.salesPayVersion + 1 }));
  },
}));
