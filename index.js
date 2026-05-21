const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const P = require("pino")

async function startBot() {

  // SESSION
  const { state, saveCreds } =
  await useMultiFileAuthState("session")

  // SOCKET
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    browser: ["Bot Lite", "Chrome", "1.0.0"]
  })

  // SALVAR SESSÃO
  sock.ev.on("creds.update", saveCreds)

  // PAIRING CODE
  if (!sock.authState.creds.registered) {

    try {

      const numero = "5551981528372"

      console.log("")
      console.log("⏳ GERANDO PAIRING CODE...")
      console.log("")

      // ESPERA EVITAR CONNECTION CLOSED
      await new Promise(resolve =>
        setTimeout(resolve, 5000)
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

      console.log("")
      console.log("❌ ERRO AO GERAR PAIRING")
      console.log(err)
      console.log("")

    }

  }

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

  // CONEXÃO
  sock.ev.on("connection.update", async (update) => {

    const {
      connection,
      lastDisconnect
    } = update

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

}

// INICIAR BOT
startBot()
