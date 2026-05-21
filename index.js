const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const P = require("pino")
const express = require("express")

const app = express()

// PORTA RENDER
const PORT = process.env.PORT || 3000

app.get("/", (req, res) => {
  res.send("BOT ONLINE")
})

app.listen(PORT, () => {
  console.log("🌐 Servidor Web Online")
})

async function startBot() {

  const { state, saveCreds } =
  await useMultiFileAuthState("session")

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    browser: ["Bot Lite", "Chrome", "1.0.0"]
  })

  sock.ev.on("creds.update", saveCreds)

  // PAIRING
  if (!sock.authState.creds.registered) {

    try {

      const numero = "5551981528372"

      console.log("")
      console.log("⏳ GERANDO PAIRING CODE...")
      console.log("")

      await new Promise(resolve =>
        setTimeout(resolve, 8000)
      )

      const code =
      await sock.requestPairingCode(numero)

      console.log("")
      console.log("==============")
      console.log("PAIRING CODE:")
      console.log(code)
      console.log("==============")
      console.log("")

    } catch (err) {

      console.log("❌ ERRO:")
      console.log(err)

    }

  }

  // MENSAGENS
  sock.ev.on("messages.upsert", async ({ messages }) => {

    const msg = messages[0]

    if (!msg.message) return

    const texto =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text

    const from = msg.key.remoteJid

    console.log("📩", texto)

    if (texto === "!ping") {

      await sock.sendMessage(from, {
        text: "🏓 PONG!"
      })

    }

    if (texto === "!menu") {

      await sock.sendMessage(from, {
        text:
`🤖 BOT LITE

📌 COMANDOS:
!menu
!ping`
      })

    }

  })

  // CONEXÃO
  sock.ev.on("connection.update", (update) => {

    const {
      connection,
      lastDisconnect
    } = update

    if (connection === "open") {

      console.log("✅ BOT ONLINE")

    }

    if (connection === "close") {

      const reason =
      lastDisconnect?.error?.output?.statusCode

      console.log("❌ CONEXÃO FECHADA")

      if (
        reason !== DisconnectReason.loggedOut
      ) {

        startBot()

      }

    }

  })

}

startBot()
