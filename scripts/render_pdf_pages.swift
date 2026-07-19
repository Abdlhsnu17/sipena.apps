import AppKit
import Foundation
import PDFKit

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: render_pdf_pages.swift <input.pdf> <output-dir>\n", stderr)
    exit(2)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
try FileManager.default.createDirectory(at: outputURL, withIntermediateDirectories: true)

guard let document = PDFDocument(url: inputURL) else {
    fputs("Cannot open PDF\n", stderr)
    exit(1)
}

let scale: CGFloat = 2.0
for index in 0..<document.pageCount {
    guard let page = document.page(at: index) else { continue }
    let bounds = page.bounds(for: .mediaBox)
    let pixelSize = NSSize(width: bounds.width * scale, height: bounds.height * scale)
    let image = page.thumbnail(of: pixelSize, for: .mediaBox)

    guard let tiff = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff),
          let png = bitmap.representation(using: .png, properties: [:]) else {
        continue
    }
    let filename = String(format: "page-%02d.png", index + 1)
    try png.write(to: outputURL.appendingPathComponent(filename))
}

print("Rendered \(document.pageCount) pages")
