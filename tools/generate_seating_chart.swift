import Foundation
import AppKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

struct Seat {
    let x: Double
    let y: Double
}

struct Cluster {
    var x: Double
    var y: Double
}

let imagePath = "/Users/lihongda/Desktop/Weixin Image_20260417154409_39_97.jpg"
let namesPath = "/tmp/seat_names.txt"
let outputPath = "/Users/lihongda/Documents/dev/neo-jira/output/政务一体化事业部-工位姓名图.png"

func loadNames(from path: String) throws -> [String] {
    let content = try String(contentsOfFile: path, encoding: .utf8)
    return content
        .split(whereSeparator: \.isNewline)
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
}

func loadImage(_ path: String) throws -> CGImage {
    let url = URL(fileURLWithPath: path)
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
        throw NSError(domain: "seat-chart", code: 1, userInfo: [NSLocalizedDescriptionKey: "无法读取图片"])
    }
    return image
}

func rgbaData(for image: CGImage) -> [UInt8] {
    let width = image.width
    let height = image.height
    let bytesPerPixel = 4
    let bytesPerRow = width * bytesPerPixel
    var data = [UInt8](repeating: 0, count: height * bytesPerRow)
    let ctx = CGContext(
        data: &data,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return data
}

func isSeatOrange(r: UInt8, g: UInt8, b: UInt8) -> Bool {
    let r = Int(r), g = Int(g), b = Int(b)
    let maxv = max(r, max(g, b))
    let minv = min(r, min(g, b))
    return r > 170 && g > 120 && b > 100 && r > g + 8 && g >= b - 5 && (maxv - minv) > 18
}

func detectSeats(in image: CGImage) -> [Seat] {
    let width = image.width
    let height = image.height
    let bytesPerPixel = 4
    let bytesPerRow = width * bytesPerPixel
    let data = rgbaData(for: image)
    var mask = [UInt8](repeating: 0, count: width * height)

    for y in 0..<height {
        for x in 0..<width {
            let idx = y * bytesPerRow + x * bytesPerPixel
            if isSeatOrange(r: data[idx], g: data[idx + 1], b: data[idx + 2]) {
                mask[y * width + x] = 1
            }
        }
    }

    var visited = [UInt8](repeating: 0, count: width * height)
    let dirs = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    var queue = [(Int, Int)]()
    queue.reserveCapacity(256)
    var seats = [Seat]()

    for y in 0..<height {
        for x in 0..<width {
            let start = y * width + x
            if mask[start] == 0 || visited[start] == 1 {
                continue
            }

            visited[start] = 1
            queue.removeAll(keepingCapacity: true)
            queue.append((x, y))

            var head = 0
            var area = 0
            var minX = x, maxX = x, minY = y, maxY = y
            var sx = 0.0, sy = 0.0

            while head < queue.count {
                let (cx, cy) = queue[head]
                head += 1
                area += 1
                sx += Double(cx)
                sy += Double(cy)
                minX = min(minX, cx)
                maxX = max(maxX, cx)
                minY = min(minY, cy)
                maxY = max(maxY, cy)

                for (dx, dy) in dirs {
                    let nx = cx + dx
                    let ny = cy + dy
                    if nx < 0 || ny < 0 || nx >= width || ny >= height {
                        continue
                    }
                    let next = ny * width + nx
                    if mask[next] == 1 && visited[next] == 0 {
                        visited[next] = 1
                        queue.append((nx, ny))
                    }
                }
            }

            let w = maxX - minX + 1
            let h = maxY - minY + 1
            let cx = sx / Double(area)
            let cy = sy / Double(area)

            if area >= 55 && area <= 120 &&
                w >= 8 && w <= 16 &&
                h >= 8 && h <= 16 &&
                !(cx < 150 && cy < 160) {
                seats.append(Seat(x: cx, y: cy))
            }
        }
    }

    return seats.sorted {
        if abs($0.y - $1.y) > 20 { return $0.y < $1.y }
        return $0.x < $1.x
    }
}

func kmeans(points: [Seat], k: Int, iterations: Int = 30) -> [Cluster] {
    precondition(points.count >= k)
    var centers = [
        Cluster(x: 170, y: 420),
        Cluster(x: 170, y: 720),
        Cluster(x: 170, y: 920),
        Cluster(x: 1450, y: 510),
        Cluster(x: 1450, y: 810),
        Cluster(x: 320, y: 1010),
        Cluster(x: 560, y: 980),
        Cluster(x: 960, y: 980),
        Cluster(x: 1140, y: 920)
    ]

    for _ in 0..<iterations {
        var groups = Array(repeating: [(Double, Double)](), count: k)
        for p in points {
            var best = 0
            var bestDist = Double.greatestFiniteMagnitude
            for i in 0..<k {
                let dx = p.x - centers[i].x
                let dy = p.y - centers[i].y
                let d = dx * dx + dy * dy
                if d < bestDist {
                    bestDist = d
                    best = i
                }
            }
            groups[best].append((p.x, p.y))
        }

        for i in 0..<k where !groups[i].isEmpty {
            let sumX = groups[i].reduce(0.0) { $0 + $1.0 }
            let sumY = groups[i].reduce(0.0) { $0 + $1.1 }
            centers[i] = Cluster(
                x: sumX / Double(groups[i].count),
                y: sumY / Double(groups[i].count)
            )
        }
    }

    return centers
}

func nearestCluster(for seat: Seat, centers: [Cluster]) -> Cluster {
    centers.min {
        let d1 = (seat.x - $0.x) * (seat.x - $0.x) + (seat.y - $0.y) * (seat.y - $0.y)
        let d2 = (seat.x - $1.x) * (seat.x - $1.x) + (seat.y - $1.y) * (seat.y - $1.y)
        return d1 < d2
    }!
}

func seatOffset(for seat: Seat, cluster: Cluster, scale: CGFloat) -> CGPoint {
    var dx = seat.x - cluster.x
    var dy = seat.y - cluster.y
    let length = max((dx * dx + dy * dy).squareRoot(), 1.0)
    dx /= length
    dy /= length
    if abs(dx) < 0.15 && abs(dy) < 0.15 {
        dx = seat.x < cluster.x ? -1 : 1
        dy = seat.y < cluster.y ? -1 : 1
    }
    let distance: CGFloat = 72 * scale
    return CGPoint(x: CGFloat(dx) * distance, y: CGFloat(dy) * distance)
}

func fontSize(for name: String, scale: CGFloat) -> CGFloat {
    if name.count >= 8 { return 16 * scale }
    if name.count >= 6 { return 18 * scale }
    if name.count >= 5 { return 20 * scale }
    return 22 * scale
}

func drawLabel(
    text: String,
    seatPoint: CGPoint,
    offset: CGPoint,
    scale: CGFloat,
    in ctx: CGContext
) {
    let font = NSFont(name: "PingFang SC", size: fontSize(for: text, scale: scale)) ?? NSFont.systemFont(ofSize: fontSize(for: text, scale: scale), weight: .medium)
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: NSColor(red: 0.08, green: 0.27, blue: 0.46, alpha: 1.0),
        .paragraphStyle: paragraph
    ]
    let attributed = NSAttributedString(string: text, attributes: attrs)
    let size = attributed.size()
    let paddingX: CGFloat = 10 * scale
    let paddingY: CGFloat = 6 * scale

    let labelCenter = CGPoint(x: seatPoint.x + offset.x, y: seatPoint.y + offset.y)
    let rect = CGRect(
        x: labelCenter.x - size.width / 2 - paddingX,
        y: labelCenter.y - size.height / 2 - paddingY,
        width: size.width + paddingX * 2,
        height: size.height + paddingY * 2
    )

    ctx.setStrokeColor(NSColor(calibratedWhite: 0.70, alpha: 0.75).cgColor)
    ctx.setLineWidth(1.4 * scale)
    ctx.move(to: seatPoint)
    ctx.addLine(to: CGPoint(x: labelCenter.x, y: labelCenter.y))
    ctx.strokePath()

    let path = NSBezierPath(roundedRect: rect, xRadius: 7 * scale, yRadius: 7 * scale)
    ctx.setFillColor(NSColor(calibratedWhite: 1.0, alpha: 0.88).cgColor)
    ctx.addPath(path.cgPath)
    ctx.fillPath()

    attributed.draw(in: rect.insetBy(dx: paddingX, dy: paddingY))

    let dotRect = CGRect(
        x: seatPoint.x - 4 * scale,
        y: seatPoint.y - 4 * scale,
        width: 8 * scale,
        height: 8 * scale
    )
    ctx.setFillColor(NSColor(red: 0.93, green: 0.39, blue: 0.18, alpha: 0.95).cgColor)
    ctx.fillEllipse(in: dotRect)
}

extension NSBezierPath {
    var cgPath: CGPath {
        let path = CGMutablePath()
        var points = [NSPoint](repeating: .zero, count: 3)
        for i in 0..<elementCount {
            let type = element(at: i, associatedPoints: &points)
            switch type {
            case .moveTo:
                path.move(to: points[0])
            case .lineTo:
                path.addLine(to: points[0])
            case .curveTo:
                path.addCurve(to: points[2], control1: points[0], control2: points[1])
            case .cubicCurveTo:
                path.addCurve(to: points[2], control1: points[0], control2: points[1])
            case .quadraticCurveTo:
                path.addQuadCurve(to: points[1], control: points[0])
            case .closePath:
                path.closeSubpath()
            @unknown default:
                break
            }
        }
        return path
    }
}

do {
    let image = try loadImage(imagePath)
    let names = try loadNames(from: namesPath)
    let detectedSeats = detectSeats(in: image)

    guard detectedSeats.count == 87 else {
        throw NSError(domain: "seat-chart", code: 2, userInfo: [NSLocalizedDescriptionKey: "识别到的工位数为 \(detectedSeats.count)，不是 87"])
    }

    let seatLabels = names + ["空位"]
    guard seatLabels.count == detectedSeats.count else {
        throw NSError(domain: "seat-chart", code: 3, userInfo: [NSLocalizedDescriptionKey: "姓名数量 \(seatLabels.count) 与工位数量 \(detectedSeats.count) 不匹配"])
    }

    let scale: CGFloat = 2.0
    let width = Int(CGFloat(image.width) * scale)
    let height = Int(CGFloat(image.height) * scale)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let ctx = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    ctx.interpolationQuality = .high
    ctx.setFillColor(NSColor.white.cgColor)
    ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))

    ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

    let clusters = kmeans(points: detectedSeats, k: 9)

    NSGraphicsContext.saveGraphicsState()
    let graphicsContext = NSGraphicsContext(cgContext: ctx, flipped: false)
    NSGraphicsContext.current = graphicsContext

    for (seat, label) in zip(detectedSeats, seatLabels) {
        let cluster = nearestCluster(for: seat, centers: clusters)
        let seatPoint = CGPoint(
            x: CGFloat(seat.x) * scale,
            y: CGFloat(image.height) * scale - CGFloat(seat.y) * scale
        )
        let rawOffset = seatOffset(for: seat, cluster: cluster, scale: scale)
        let offset = CGPoint(x: rawOffset.x, y: -rawOffset.y)
        drawLabel(text: label, seatPoint: seatPoint, offset: offset, scale: scale, in: ctx)
    }

    let note = "姓名按 Excel“姓名”列顺序，自左上到右下填入，最后 1 个工位标记为空位"
    let noteAttrs: [NSAttributedString.Key: Any] = [
        .font: NSFont(name: "PingFang SC", size: 20 * scale) ?? NSFont.systemFont(ofSize: 20 * scale, weight: .medium),
        .foregroundColor: NSColor(red: 0.12, green: 0.33, blue: 0.32, alpha: 0.95)
    ]
    NSAttributedString(string: note, attributes: noteAttrs).draw(at: CGPoint(x: 40 * scale, y: 30 * scale))

    NSGraphicsContext.restoreGraphicsState()

    guard let output = ctx.makeImage() else {
        throw NSError(domain: "seat-chart", code: 4, userInfo: [NSLocalizedDescriptionKey: "输出图片生成失败"])
    }

    let outputURL = URL(fileURLWithPath: outputPath)
    try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    guard let dest = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        throw NSError(domain: "seat-chart", code: 5, userInfo: [NSLocalizedDescriptionKey: "无法创建输出文件"])
    }
    CGImageDestinationAddImage(dest, output, nil)
    if !CGImageDestinationFinalize(dest) {
        throw NSError(domain: "seat-chart", code: 6, userInfo: [NSLocalizedDescriptionKey: "图片写入失败"])
    }

    print(outputPath)
} catch {
    fputs("ERROR: \(error.localizedDescription)\n", stderr)
    exit(1)
}
