/// Wrapper generik untuk record dari modul-modul SIPENA (aset, peminjaman,
/// penggunaan aset, pemeliharaan, jadwal, dsb).
///
/// Backend memiliki banyak modul dengan struktur field yang berbeda-beda;
/// daripada membuat satu class kaku per modul, [SipenaRecord] menyimpan
/// JSON mentah dan menyediakan accessor nyaman untuk field yang paling
/// sering dipakai di UI (id, nama, status, tanggal).
class SipenaRecord {
  final Map<String, dynamic> raw;

  SipenaRecord(this.raw);

  factory SipenaRecord.fromJson(Map<String, dynamic> json) => SipenaRecord(json);

  int get id => raw['id'] as int;

  String? string(String key) => raw[key]?.toString();

  num? number(String key) => raw[key] is num ? raw[key] as num : null;

  String get title =>
      string('name') ??
      string('assetName') ??
      string('purpose') ??
      string('description') ??
      'Tanpa nama';

  String get status => string('status') ?? '-';
}
