import { toast } from "sonner";
import { fmtIDR } from "@/lib/format";
import { calcTotal, buildReminderLink } from "@/lib/allocations";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Send } from "lucide-react";

export function ReminderDialog({ open, onOpenChange, unpaidList, company }) {
  const openAll = () => {
    unpaidList.forEach(({ alloc, student }, i) => {
      setTimeout(() => window.open(buildReminderLink(student, alloc, company), "_blank"), i * 400);
    });
    toast.success(`Membuka ${unpaidList.length} tab WhatsApp...`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-2xl">
        <DialogHeader><DialogTitle>Kirim Reminder WhatsApp — Semua Unpaid</DialogTitle></DialogHeader>
        <div className="text-sm text-slate-600">
          Ada <span className="font-bold text-slate-900">{unpaidList.length}</span> tagihan yang belum dibayar & memiliki nomor WA.
        </div>
        <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
          {unpaidList.length === 0 && <div className="p-6 text-center text-slate-400 text-sm">Tidak ada tagihan unpaid.</div>}
          {unpaidList.map(({ alloc, student }) => (
            <div key={alloc.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900 text-sm truncate">{student.nama}</div>
                <div className="text-xs text-slate-500 truncate">{alloc.no_invoice} · {fmtIDR(calcTotal(alloc))} · {student.no_hp}</div>
              </div>
              <a data-testid={`send-wa-${alloc.id}`} href={buildReminderLink(student, alloc, company)} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                 style={{ transitionProperty: "background-color", transitionDuration: "150ms" }}>
                <Send className="h-3.5 w-3.5"/> Kirim WA
              </a>
            </div>
          ))}
        </div>
        {unpaidList.length > 0 && (
          <DialogFooter>
            <Button data-testid="open-all-wa-btn" onClick={openAll} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Send className="h-4 w-4 mr-2"/> Buka Semua ({unpaidList.length})
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
