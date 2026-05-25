require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(
  process.env.BOT_TOKEN,
  { polling: true }
);

console.log('Bot iniciado');

bot.onText(/\/start/, (msg) => {

  bot.sendMessage(
    msg.chat.id,

`🚀 Bem-vindo!

Bot V1 funcionando.

Clique:

/comprar`
  );

});

bot.onText(/\/comprar/, (msg) => {

  bot.sendMessage(
    msg.chat.id,

`🛒 Produto Teste

Valor: R$10,00

PIX em breve...`
  );

});