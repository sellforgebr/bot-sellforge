require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const db = require('./firebase');

const app = express();

const bot = new TelegramBot(
  process.env.BOT_TOKEN,
  {
    polling: true
  }
);

app.use(express.json());

app.get('/', (req, res) => {
  res.send('🚀 SellForge Bot Online');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

console.log('Bot iniciado com sucesso!');

bot.onText(/\/start/, async (msg) => {

  try {

    await db.collection('users')
      .doc(String(msg.from.id))
      .set({
        id: msg.from.id,
        nome: msg.from.first_name || '',
        username: msg.from.username || '',
        criadoEm: Date.now()
      });

    bot.sendMessage(
      msg.chat.id,

`🚀 Bem-vindo ao SellForge Bot!

Seu cadastro foi realizado com sucesso.

Comandos disponíveis:

/comprar
/meuid`
    );

  } catch (error) {

    console.error(error);

    bot.sendMessage(
      msg.chat.id,
      '❌ Erro ao conectar ao Firebase.'
    );

  }

});

bot.onText(/\/comprar/, async (msg) => {

  bot.sendMessage(
    msg.chat.id,

`🛒 Produto Teste

💰 Valor: R$10,00

⚠️ Integração PIX será adicionada na próxima etapa.`
  );

});

bot.onText(/\/meuid/, (msg) => {

  bot.sendMessage(
    msg.chat.id,
    `🆔 Seu ID é: ${msg.from.id}`
  );

});

bot.on('polling_error', (error) => {
  console.log(error);
});

process.on('uncaughtException', (error) => {
  console.log(error);
});

process.on('unhandledRejection', (error) => {
  console.log(error);
});
