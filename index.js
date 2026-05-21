const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const P = require("pino")
const express = require("express")
const QRCode = require("qrcode-terminal")

const app = express()

// PORTA RENDER
const PORT = process.env.PORT || 3000

app.get("/", (req, res) => {
  res.send("🤖 BOT ONLINE")
})

app.listen(PORT, () => {
  console.log("🌐 Servidor Web Online")
})

async function startBot() {

  // SESSION
  const { state, saveCreds } =
  await useMultiFileAuthState("session")

  // SOCKET
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    browser: ["Bot Lite", "Chrome", "1.0.0"],
    printQRInTerminal: false
  })

  // SALVAR SESSÃO
  sock.ev.on("creds.update", saveCreds)

  // QR CODE
  sock.ev.on("connection.update", async (update) => {

    const {
      connection,
      lastDisconnect,
      qr
    } = update

    // MOSTRAR QR
    if (qr) {

      console.log("")
      console.log("📱 ESCANEIE O QR CODE:")
      console.log("")

      QRCode.generate(qr, {
        small: true
      })

      console.log("")

    }

    // ONLINE
    if (connection === "open") {

      console.log("")
      console.log("✅ BOT ONLINE")
      console.log("")

    }

    // DESCONECTOU
    if (connection === "close") {

      const reason =
      lastDisconnect?.error?.output?.statusCode

      console.log("")
      console.log("❌ CONEXÃO FECHADA")
      console.log("Motivo:", reason)
      console.log("")

      // RECONECTAR
      if (
        reason !== DisconnectReason.loggedOut
      ) {

        console.log("🔄 RECONECTANDO...")
        startBot()

      } else {

        console.log("🚫 SESSÃO DESCONECTADA")

      }

    }

  })

  // RECEBER MENSAGENS
  sock.ev.on("messages.upsert", async ({ messages }) => {

    const msg = messages[0]

    if (!msg.message) return

    const texto =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text

    const from = msg.key.remoteJid

    console.log("📩", texto)

    // MENU
    if (texto === "!menu") {

      await sock.sendMessage(from, {
        text:
`🤖 BOT LITE ONLINE

📌 COMANDOS:

!menu
!ping`
      })

    }

    // PING
    if (texto === "!ping") {

      await sock.sendMessage(from, {
        text: "🏓 PONG!"
      })

    }

  })

}

// INICIAR BOT
startBot()
