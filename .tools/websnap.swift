import Cocoa
import WebKit

// Uso: swift websnap.swift <url> <saida.png> [largura] [altura] [esperaSegundos]
let args = CommandLine.arguments
guard args.count >= 3 else {
    print("uso: websnap <url> <saida.png> [w] [h] [espera]")
    exit(2)
}
let url = URL(string: args[1])!
let outPath = args[2]
let width = args.count > 3 ? CGFloat(Double(args[3])!) : 1600
let height = args.count > 4 ? CGFloat(Double(args[4])!) : 1000
let espera = args.count > 5 ? Double(args[5])! : 6
// Opcional: args[6] = JS de interação; args[7] = espera pós-interação; args[8] = segundo PNG
let jsAcao = args.count > 6 ? args[6] : ""
let espera2 = args.count > 7 ? Double(args[7])! : 0
let outPath2 = args.count > 8 ? args[8] : ""

let app = NSApplication.shared
app.setActivationPolicy(.accessory)

let config = WKWebViewConfiguration()
let userContent = WKUserContentController()
let erroScript = WKUserScript(
    source: "window.__errs=[];window.addEventListener('error',e=>{window.__errs.push(String(e.message||e.error))});window.addEventListener('unhandledrejection',e=>{window.__errs.push('promise: '+String(e.reason))});",
    injectionTime: .atDocumentStart,
    forMainFrameOnly: false
)
userContent.addUserScript(erroScript)
config.userContentController = userContent
let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: width, height: height), configuration: config)

let window = NSWindow(
    contentRect: NSRect(x: 0, y: 0, width: width, height: height),
    styleMask: [.titled],
    backing: .buffered,
    defer: false
)
window.contentView = webView
window.orderFront(nil)

var terminou = false

var fase = 0

func capturar() {
    let cfg = WKSnapshotConfiguration()
    cfg.rect = NSRect(x: 0, y: 0, width: width, height: height)
    let destino = fase == 0 ? outPath : outPath2
    webView.takeSnapshot(with: cfg) { imagem, erro in
        guard let img = imagem, erro == nil else {
            FileHandle.standardError.write("erro snapshot: \(String(describing: erro))\n".data(using: .utf8)!)
            exit(1)
        }
        guard let tiff = img.tiffRepresentation,
              let rep = NSBitmapImageRep(data: tiff),
              let png = rep.representation(using: .png, properties: [:]) else {
            FileHandle.standardError.write("falha ao converter PNG\n".data(using: .utf8)!)
            exit(1)
        }
        do {
            try png.write(to: URL(fileURLWithPath: destino))
            print("ok: \(destino)")
        } catch {
            FileHandle.standardError.write("falha ao salvar: \(error)\n".data(using: .utf8)!)
            exit(1)
        }
        if fase == 0 && !jsAcao.isEmpty && !outPath2.isEmpty {
            fase = 1
            webView.evaluateJavaScript(jsAcao) { _, errJs in
                if let e = errJs {
                    FileHandle.standardError.write("jsAcao erro: \(e)\n".data(using: .utf8)!)
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + espera2) {
                    webView.evaluateJavaScript("document.getAnimations().forEach(a=>{try{a.finish()}catch(e){}}); 'ok'") { _, _ in
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                            capturar()
                        }
                    }
                }
            }
        } else {
            terminou = true
        }
    }
}

webView.load(URLRequest(url: url))

// Aguarda carregamento + JS + alguns frames de animação
DispatchQueue.main.asyncAfter(deadline: .now() + espera) {
    // Janela sem foco tem animações pausadas: força o estado final
    webView.evaluateJavaScript("document.getAnimations().forEach(a=>{try{a.finish()}catch(e){}}); 'ok'") { _, _ in
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            dumpDebug()
        }
    }
}

func dumpDebug() {
    webView.evaluateJavaScript("""
        (() => {
          const info = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return sel + ': AUSENTE';
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return sel + ' rect=' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)
              + ' opacity=' + cs.opacity + ' display=' + cs.display + ' visibility=' + cs.visibility
              + ' color=' + cs.color + ' bg=' + cs.backgroundColor + ' anim=' + cs.animationName + '/' + cs.animationDuration;
          };
          const bolha = document.querySelector('.msg-usuario .bolha');
          const corpo = document.querySelector('.msg-agente .corpo');
          return JSON.stringify({
            errs: window.__errs || [],
            u: info('.msg-usuario'),
            a: info('.msg-agente'),
            bolha: bolha ? getComputedStyle(bolha).color + ' | ' + bolha.textContent : 'sem bolha',
            corpo: corpo ? corpo.textContent.slice(0, 60) : 'sem corpo',
            t: info('.thread')
          });
        })()
        """) { resultado, erro in
        if let s = resultado as? String {
            FileHandle.standardError.write(("DEBUG " + s + "\n").data(using: .utf8)!)
        } else {
            FileHandle.standardError.write("DEBUG falhou: \(String(describing: erro))\n".data(using: .utf8)!)
        }
        capturar()
    }
}
// Loop de runloop até terminar (com teto de segurança)
let limite = Date().addingTimeInterval(espera + espera2 + 40)
while !terminou && Date() < limite {
    RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.1))
}
exit(terminou ? 0 : 1)
