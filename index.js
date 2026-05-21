const {
 default: makeWASocket,
 useMultiFileAuthState,
 DisconnectReason
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

 // MENSAGENS
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

Comandos:
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

 // RECONEXÃO
 sock.ev.on("connection.update", ({ connection }) => {

   if (connection === "close") {
     startBot()
   }

   if (connection === "open") {
     console.log("BOT ONLINE")
   }

 })

}

startBot()