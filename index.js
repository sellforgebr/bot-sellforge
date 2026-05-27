require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const db = require('./firebase');
const client = require('./mercadopago');
const { Payment } = require('mercadopago');

const app = express();

const bot = new TelegramBot(
  process.env.BOT_TOKEN,
  {
    polling: true
  }
);

// Configuração essencial para a Render receber os dados
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Página inicial para testar se está online
app.get('/', (req, res) => {
  res.send('🚀 SellForge Online e funcionando na Render! ✅');
});

// ======================================
// ROTA PRINCIPAL DE RECEBIMENTO DO MP
// ======================================
app.post('/webhook/mercadopago', async (req, res) => {
  try {
    const { topic, id } = req.body;

    if (topic === 'payment') {
      // Busca os dados completos do pagamento
      const payment = await Payment.get({ id: id });
      
      // Se o pagamento foi aprovado
      if (payment.status === 'approved') {
        // Separa o ID do usuário e o ID do produto que enviamos na criação
        const { external_reference } = payment;
        const [userId, produtoId] = external_reference.split('_');

        // Busca o produto no banco de dados
        const produtoDoc = await db.collection('produtos').doc(produtoId).get();
        if (!produtoDoc.exists) return res.sendStatus(404);

        const produto = produtoDoc.data();

        // 🚀 ENTREGA O PRODUTO PARA O USUÁRIO
        await bot.sendMessage(userId, 
`✅ *PAGAMENTO APROVADO COM SUCESSO!* ✅

📦 Seu produto: *${produto.nome}*

📝 Conteúdo:
${produto.conteudo}

💵 Valor pago: R$ ${payment.transaction_amount.toFixed(2)}

Obrigado pela compra! 🎉`, 
{ parse_mode: 'Markdown' });
        
        // 📝 SALVA O PEDIDO NO HISTÓRICO
        await db.collection('pedidos').add({
          usuarioId: userId,
          produtoId: produtoId,
          pagamentoId: id,
          valor: payment.transaction_amount,
          data: Date.now(),
          status: 'aprovado'
        });
      }
    }

    // Responde para o Mercado Pago que recebemos a informação
    res.sendStatus(200);
  } catch (error) {
    console.log('❌ Erro no Webhook:', error);
    res.sendStatus(500);
  }
});

// PORTA DA RENDER (não alterar)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🔗 URL de Notificação: ${process.env.WEBHOOK_URL}/webhook/mercadopago`);
  
  if (!process.env.WEBHOOK_URL) {
    console.log('⚠️ ERRO: WEBHOOK_URL não configurada nas variáveis!');
  }
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
FUNÇÃO GERAR PAGAMENTO COM QR CODE
====================================
*/
async function gerarPagamento(chatId, produto) {
  try {
    if (!process.env.WEBHOOK_URL) {
      return bot.sendMessage(chatId, '❌ Sistema de pagamento não configurado. Avise o administrador!');
    }

    const pagamento = await Payment.create({
      transaction_amount: produto.valor,
      description: `Compra: ${produto.nome}`,
      external_reference: `${chatId}_${produto.id}`,
      payment_method_id: 'pix',
      payer: {
        email: 'cliente@sellforge.com.br'
      },
      notification_url: process.env.WEBHOOK_URL + '/webhook/mercadopago'
    });

    // Dados do QR Code e Código
    const qrCodeImagem = pagamento.point_of_interaction.transaction_data.qr_code_image;
    const codigoCopiaCola = pagamento.point_of_interaction.transaction_data.qr_code;

    // Envia a imagem e a mensagem
    await bot.sendPhoto(chatId, `data:image/png;base64,${qrCodeImagem}`, {
      caption: 
`💸 *Pagamento Gerado!* 📱

🛍️ Produto: ${produto.nome}
💰 Valor: R$ ${produto.valor.toFixed(2)}

📌 Escaneie o QR Code acima ou use o código abaixo:

📋 *Código Copia e Cola:*
\`\`\`
${codigoCopiaCola}
\`\`\`

⏳ Validade: 15 Minutos
✅ Após o pagamento, o produto chegará automaticamente!`,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.log('❌ Erro ao gerar pagamento:', error);
    bot.sendMessage(chatId, '❌ Erro ao gerar o pagamento. Tente novamente ou contate o suporte.');
  }
}

/*
====================================
CALLBACKS E MENUS
====================================
*/
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;

  try {
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

    if (query.data === 'DONO') {
      bot.sendMessage(
        chatId,
`👤 Proprietário

Bem-vindo ao SellForge.

Loja automatizada com entregas digitais.

Em caso de dúvidas utilize o suporte.`
      );
    }

    if (query.data === 'SUPORTE') {
      bot.sendMessage(
        chatId,
`📞 Suporte Oficial

WhatsApp:
https://wa.me/5551981528372`
      );
    }

    if (query.data === 'CAT_FREEFIRE') {
      const produtosSnapshot = await db.collection('produtos').where('categoria', '==', 'freefire').get();
      
      if (produtosSnapshot.empty) {
        bot.sendMessage(chatId, `🔥 Categoria Free Fire\n\nNenhum produto cadastrado ainda.`);
      } else {
        let botoes = [];
        produtosSnapshot.forEach(doc => {
          const produto = doc.data();
          produto.id = doc.id;
          botoes.push([{
            text: `${produto.nome} - R$ ${produto.valor.toFixed(2)}`,
            callback_data: `COMPRAR_${produto.id}`
          }]);
        });

        bot.sendMessage(chatId, `🔥 Categoria Free Fire\n\nEscolha um produto:`, {
          reply_markup: { inline_keyboard: botoes }
        });
      }
    }

    if (query.data === 'CAT_DICAS') {
      const produtosSnapshot = await db.collection('produtos').where('categoria', '==', 'dicas').get();
      
      if (produtosSnapshot.empty) {
        bot.sendMessage(chatId, `📚 Categoria Dicas\n\nNenhum produto cadastrado ainda.`);
      } else {
        let botoes = [];
        produtosSnapshot.forEach(doc => {
          const produto = doc.data();
          produto.id = doc.id;
          botoes.push([{
            text: `${produto.nome} - R$ ${produto.valor.toFixed(2)}`,
            callback_data: `COMPRAR_${produto.id}`
          }]);
        });

        bot.sendMessage(chatId, `📚 Categoria Dicas\n\nEscolha um produto:`, {
          reply_markup: { inline_keyboard: botoes }
        });
      }
    }

    if (query.data === 'CAT_MANUAIS') {
      const produtosSnapshot = await db.collection('produtos').where('categoria', '==', 'manuais').get();
      
      if (produtosSnapshot.empty) {
        bot.sendMessage(chatId, `📖 Categoria Manuais\n\nNenhum produto cadastrado ainda.`);
      } else {
        let botoes = [];
        produtosSnapshot.forEach(doc => {
          const produto = doc.data();
          produto.id = doc.id;
          botoes.push([{
            text: `${produto.nome} - R$ ${produto.valor.toFixed(2)}`,
            callback_data: `COMPRAR_${produto.id}`
          }]);
        });

        bot.sendMessage(chatId, `📖 Categoria Manuais\n\nEscolha um produto:`, {
          reply_markup: { inline_keyboard: botoes }
        });
      }
    }

    if (query.data.startsWith('COMPRAR_')) {
      const produtoId = query.data.split('_')[1];
      const produtoDoc = await db.collection('produtos').doc(produtoId).get();

      if (!produtoDoc.exists) {
        return bot.sendMessage(chatId, '❌ Produto não encontrado.');
      }

      const produto = produtoDoc.data();
      produto.id = produtoId;

      await gerarPagamento(chatId, produto);
    }

    await bot.answerCallbackQuery(query.id);

  } catch (error) {
    console.log(error);
  }
});

/*
====================================
ERROS E LOGS
====================================
*/
bot.on('polling_error', (error) => {
  console.log('⚠️ Erro de conexão:', error.message);
});

process.on('uncaughtException', (error) => {
  console.log('⚠️ Erro geral:', error);
});

process.on('unhandledRejection', (error) => {
  console.log('⚠️ Rejeição não tratada:', error);
});
