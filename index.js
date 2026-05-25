require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();

const bot = new TelegramBot(
  process.env.BOT_TOKEN,
  {
    polling: true
  }
);

app.get('/', (req, res) => {
  res.send('SellForge Bot Online');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

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
