import SwiftUI
import WebKit

/// A thin WKWebView wrapper that hosts the bundled web game.
struct GameWebView: NSViewRepresentable {
    let url: URL

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.mediaTypesRequiringUserActionForPlayback = []
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}
}

struct ContentView: View {
    private var gameURL: URL? {
        Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web")
    }

    var body: some View {
        if let url = gameURL {
            GameWebView(url: url)
        } else {
            VStack(spacing: 12) {
                Text("Game files not found.")
                    .font(.title2)
                Text("The Super Kid web app is missing from the app bundle.")
                    .font(.body)
                    .foregroundColor(.secondary)
            }
            .padding()
        }
    }
}

@main
struct SuperKidApp: App {
    var body: some Scene {
        WindowGroup("Super Kid Saves the Planet") {
            ContentView()
                .frame(minWidth: 900, minHeight: 675)
        }
        .defaultSize(width: 1200, height: 900)
    }
}
