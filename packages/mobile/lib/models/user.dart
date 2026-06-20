class AppUser {
  final int id;
  final String nip;
  final String name;
  final String email;
  final String role;
  final String? staffAccessType;
  final String? photoUrl;

  AppUser({
    required this.id,
    required this.nip,
    required this.name,
    required this.email,
    required this.role,
    this.staffAccessType,
    this.photoUrl,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as int,
        nip: json['nip']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        email: json['email']?.toString() ?? '',
        role: json['role']?.toString() ?? 'user',
        staffAccessType: json['staffAccessType']?.toString(),
        photoUrl: json['photoUrl']?.toString() ?? json['profilePhoto']?.toString(),
      );
}
