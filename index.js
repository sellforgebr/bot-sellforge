const {
 default: makeWASocket,
 useMultiFileAuthState
} = require("@whiskeysockets/baileys")

const P = require("pino")

async function startBot() {

 const { state, saveCreds } =
 await useMultiFileAuthState("./session")

 const sock = makeWASocket({
   auth: state,
   logger: P({ level: "silent" })
 })

 // PAIRING CODE
 if (!sock.authState.creds.registered) {

   const numero = "5551981528372"

   const code =
   await sock.requestPairingCode(numero)

   console.log("")
   console.log("==============")
   console.log("PAIRING CODE:")
   console.log(code)
   console.log("==============")
 }

 sock.ev.on("creds.update", saveCreds)

 // RECEBER MENSAGENS
 sock.ev.on("messages.upsert", async ({ messages }) => {

   const msg = messages[0]

   if (!msg.message) return

   const texto =
   msg.message.conversation ||
   msg.message.extendedTextMessage?.text

   const from = msg.key.remoteJid

   console.log("Mensagem:", texto)

   // COMANDO MENU
   if (texto === "!menu") {

     await sock.sendMessage(from, {
       text:
`🤖 BOT LITE ONLINE

📌 Comandos:
!menu
!ping`
     })
   }

   // COMANDO PING
   if (texto === "!ping") {

     await sock.sendMessage(from, {
       text: "🏓 PONG!"
     })
   }

 })

 // STATUS CONEXÃO
 sock.ev.on("connection.update", ({ connection }) => {

   if (connection === "open") {

     console.log("")
     console.log("✅ BOT ONLINE")
     console.log("")

   }

   if (connection === "close") {

     console.log("")
     console.log("❌ CONEXÃO FECHADA")
     console.log("🔄 RECONECTANDO...")
     console.log("")

     startBot()
   }

 })

}

startBot()
