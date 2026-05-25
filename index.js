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
  res.send('🚀 SellForge Online');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

console.log('🚀 SellForge iniciado com sucesso!');

const CATEGORIAS = [
  '🔥 Free Fire',
  '📚 Dicas',
  '📖 Manuais'
];

/*
====================================
SALVAR USUÁRIO
====================================
*/

async function salvarUsuario(user) {

  try {

    await db
      .collection('users')
      .doc(String(user.id))
      .set({
        id: user.id,
        nome: user.first_name || '',
        username: user.username || '',
        criadoEm: Date.now()
      }, { merge: true });

  } catch (error) {

    console.log(error);

  }

}

/*
====================================
START
====================================
*/

bot.onText(/\/start/, async (msg) => {

  await salvarUsuario(msg.from);

  bot.sendMessage(
    msg.chat.id,

`🚀 Bem-vindo ao SellForge

Escolha uma opção abaixo:`,

    {
      reply_markup: {
        inline_keyboard: [

          [
            {
              text: '🛒 Produtos',
              callback_data: 'PRODUTOS'
            }
          ],

          [
            {
              text: '👤 Informações Dono',
              callback_data: 'DONO'
            }
          ],

          [
            {
              text: '📞 Suporte',
              callback_data: 'SUPORTE'
            }
          ]

        ]
      }
    }

  );

});

/*
====================================
CALLBACKS MENU
====================================
*/

bot.on('callback_query', async (query) => {

  const chatId = query.message.chat.id;

  try {

    /*
    ==========================
    PRODUTOS
    ==========================
    */

    if (query.data === 'PRODUTOS') {

      bot.sendMessage(
        chatId,

`📂 Escolha uma categoria:`,

        {
          reply_markup: {
            inline_keyboard: [

              [
                {
                  text: '🔥 Free Fire',
                  callback_data: 'CAT_FREEFIRE'
                }
              ],

              [
                {
                  text: '📚 Dicas',
                  callback_data: 'CAT_DICAS'
                }
              ],

              [
                {
                  text: '📖 Manuais',
                  callback_data: 'CAT_MANUAIS'
                }
              ]

            ]
          }
        }

      );

    }

    /*
    ==========================
    DONO
    ==========================
    */

    if (query.data === 'DONO') {

      bot.sendMessage(
        chatId,

`👤 Proprietário

Bem-vindo ao SellForge.

Loja automatizada com entregas digitais.

Em caso de dúvidas utilize o suporte.`
      );

    }

    /*
    ==========================
    SUPORTE
    ==========================
    */

    if (query.data === 'SUPORTE') {

      bot.sendMessage(
        chatId,

`📞 Suporte Oficial

WhatsApp:
https://wa.me/5551981528372`
      );

    }

    /*
    ==========================
    FREE FIRE
    ==========================
    */

    if (query.data === 'CAT_FREEFIRE') {

      bot.sendMessage(
        chatId,

`🔥 Categoria Free Fire

Nenhum produto cadastrado ainda.`
      );

    }

    /*
    ==========================
    DICAS
    ==========================
    */

    if (query.data === 'CAT_DICAS') {

      bot.sendMessage(
        chatId,

`📚 Categoria Dicas

Nenhum produto cadastrado ainda.`
      );

    }

    /*
    ==========================
    MANUAIS
    ==========================
    */

    if (query.data === 'CAT_MANUAIS') {

      bot.sendMessage(
        chatId,

`📖 Categoria Manuais

Nenhum produto cadastrado ainda.`
      );

    }

    await bot.answerCallbackQuery(query.id);

  } catch (error) {

    console.log(error);

  }

});

/*
====================================
ERROS
====================================
*/

bot.on('polling_error', (error) => {
  console.log(error);
});

process.on('uncaughtException', (error) => {
  console.log(error);
});

process.on('unhandledRejection', (error) => {
  console.log(error);
});
