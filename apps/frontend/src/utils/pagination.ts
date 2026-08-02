/**
 * Membangun daftar item halaman yang tampil pada kontrol paginasi.
 *
 * Sampai 7 halaman seluruhnya ditampilkan. Lebih dari itu hanya halaman
 * pertama, terakhir, dan tetangga halaman aktif yang ditampilkan; celah di
 * antaranya diisi penanda `ellipsis-<dari>-<ke>` yang dipakai sebagai React key.
 */
export const buildVisiblePageItems = (currentPage: number, totalPages: number) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
  const sortedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right)

  return sortedPages.flatMap((page, index) => {
    const previousPage = sortedPages[index - 1]
    if (index > 0 && previousPage && page - previousPage > 1) {
      return [`ellipsis-${previousPage}-${page}`, page]
    }
    return [page]
  })
}
