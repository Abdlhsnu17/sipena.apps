"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { maintenanceScheduleService, type MaintenanceSchedule, type MaintenanceScheduleStatus } from "@/services/maintenance-schedule.service"
import { useCallback, useEffect, useState } from "react"

const statuses: MaintenanceScheduleStatus[] = ["terjadwal", "proses", "tertunda", "selesai", "dibatalkan"]
export default function MaintenanceSchedulePage() {
  const { toast } = useToast()
  const [items, setItems] = useState<MaintenanceSchedule[]>([])
  const [form, setForm] = useState({ asset_id: "", asset_type: "medical" as "medical" | "non_medical", tanggal: "", deskripsi: "" })
  const load = useCallback(async () => { try { setItems(await maintenanceScheduleService.list()) } catch { toast({ title: "Jadwal tidak termuat", variant: "destructive" }) } }, [toast])
  useEffect(() => { void load() }, [load])
  const create = async () => { try { await maintenanceScheduleService.create({ ...form, asset_id: Number(form.asset_id) }); setForm({ asset_id: "", asset_type: "medical", tanggal: "", deskripsi: "" }); await load(); toast({ title: "Jadwal dibuat" }) } catch { toast({ title: "Jadwal belum tersimpan", variant: "destructive" }) } }
  const update = async (id: number, status: MaintenanceScheduleStatus) => { try { await maintenanceScheduleService.updateStatus(id, status); await load() } catch { toast({ title: "Status belum diperbarui", variant: "destructive" }) } }
  return <div className="space-y-5"><section><h1 className="text-xl font-bold">Jadwal Pemeliharaan</h1><p className="text-sm text-muted-foreground">Kelola jadwal, progres, dan realisasi pemeliharaan terpisah dari riwayatnya.</p></section><Card><CardHeader><CardTitle>Tambah jadwal</CardTitle><CardDescription>Masukkan ID aset sesuai inventaris yang dipilih.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-4"><Input placeholder="ID aset" value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })} /><select className="h-9 rounded-md border bg-background px-2" value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value as typeof form.asset_type })}><option value="medical">Medis</option><option value="non_medical">Non-medis</option></select><Input type="datetime-local" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} /><Input placeholder="Deskripsi" value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} /><Button className="md:col-span-4" disabled={!form.asset_id || !form.tanggal} onClick={() => void create()}>Simpan jadwal</Button></CardContent></Card><Card><CardHeader><CardTitle>Daftar jadwal</CardTitle></CardHeader><CardContent className="space-y-2">{items.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada jadwal.</p> : items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"><div><b>Aset #{item.asset_id}</b> • {new Date(item.tanggal).toLocaleString("id-ID")}<p className="text-muted-foreground">{item.deskripsi || "Tanpa deskripsi"}</p></div><select className="h-9 rounded-md border bg-background px-2" value={item.status} onChange={(e) => void update(item.id, e.target.value as MaintenanceScheduleStatus)}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>)}</CardContent></Card></div>
}
