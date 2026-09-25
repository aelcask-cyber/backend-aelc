import { fmtIDR, capWords } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen } from "lucide-react";

export function AllocationFormDialog({ open, onOpenChange, editing, form, setForm, teachers, students, studentMap, onSave }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const onSelectStudent = (id) => {
    const s = studentMap[id];
    setForm((f) => ({ ...f, student_id: id, biaya: s?.biaya || f.biaya }));
  };
  const selected = form.student_id ? studentMap[form.student_id] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Edit Alokasi" : "Tambah Alokasi"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>Nama Guru</Label>
            <Select value={form.teacher_id} onValueChange={(v) => setForm({ ...form, teacher_id: v })}>
              <SelectTrigger data-testid="alloc-form-teacher"><SelectValue placeholder="Pilih guru"/></SelectTrigger>
              <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.nama}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Nama Siswa</Label>
            <Select value={form.student_id} onValueChange={onSelectStudent}>
              <SelectTrigger data-testid="alloc-form-student"><SelectValue placeholder="Pilih siswa"/></SelectTrigger>
              <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.no_urut}. {s.nama} — {s.kelas}</SelectItem>)}</SelectContent>
            </Select>
            {selected && (
              <p className="text-xs text-slate-500 mt-1">Kelas: {selected.kelas} · {selected.program_kelas} · {selected.program_bimbel}</p>
            )}
          </div>
          <div><Label>Pertemuan (info)</Label><Input data-testid="alloc-form-pertemuan" type="number" value={form.pertemuan} onChange={set("pertemuan")}/></div>
          <div><Label>Biaya per Bulan (Rp)</Label><Input data-testid="alloc-form-biaya" type="number" value={form.biaya} onChange={set("biaya")}/></div>
          <div>
            <Label className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5"/> Buku (Nama)</Label>
            <Input data-testid="alloc-form-buku" value={form.buku} onChange={(e) => setForm({ ...form, buku: capWords(e.target.value) })} placeholder="cth: Matematika SD 5"/>
          </div>
          <div><Label>Harga Buku (Rp)</Label><Input data-testid="alloc-form-harga-buku" type="number" value={form.harga_buku} onChange={set("harga_buku")}/></div>
          <div><Label>No Invoice</Label><Input data-testid="alloc-form-invoice" placeholder="Kosongkan → auto: {Nama}-INV-AELC-{Bulan}-{No} (+ -2, -3 jika sudah ada)" value={form.no_invoice} onChange={set("no_invoice")}/></div>
          <div>
            <Label>Pembayaran</Label>
            <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
              <SelectTrigger data-testid="alloc-form-payment"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
            <span className="text-slate-600">Total: </span>
            <span data-testid="alloc-form-total" className="font-mono font-extrabold text-blue-700">
              {fmtIDR((Number(form.biaya) || 0) + (Number(form.harga_buku) || 0))}
            </span>
            <span className="text-xs text-slate-500 ml-2">= Biaya per Bulan + Harga Buku</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button data-testid="alloc-form-save" onClick={onSave} className="bg-blue-600 hover:bg-blue-700 text-white">Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
