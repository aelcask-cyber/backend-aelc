import { fmtIDR } from "@/lib/format";

export const EMPTY_ALLOCATION = { teacher_id: "", student_id: "", pertemuan: 0, biaya: 0, buku: "", harga_buku: 0, no_invoice: "", payment_status: "Unpaid" };

export const calcTotal = (a) => (Number(a.biaya) || 0) + (Number(a.harga_buku) || 0);

export const toWaPhone = (no_hp) => {
  let phone = String(no_hp || "").replace(/\D/g, "");
  if (phone.startsWith("0")) phone = "62" + phone.slice(1);
  return phone;
};

export const buildReminderLink = (student, alloc, company) => {
  const msg = `Halo Bapak/Ibu wali dari ${student.nama},\n\nMengingatkan kembali tagihan Bimbel AELC:\n\n*No Invoice*: ${alloc.no_invoice}\n*Program*: ${student.program_bimbel}\n*Pertemuan*: ${alloc.pertemuan}x\n*Total*: ${fmtIDR(calcTotal(alloc))}\n\nMohon transfer ke:\n*Bank ${company.bank_name}*\nNo Rek: ${company.bank_account_number}\na/n ${company.bank_account_holder}\n\nTerima kasih 🙏`;
  return `https://wa.me/${toWaPhone(student.no_hp)}?text=${encodeURIComponent(msg)}`;
};
