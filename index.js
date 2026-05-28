require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const db = require('./firebase');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();

// 🟢 INICIALIZAÇÃO CORRETA DO MERCADO PAGO
const mercadoPagoClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

const bot = new TelegramBot(
  process.env.BOT_TOKEN,
  { polling: true }
);

// 🟢 SEU ID DE ADMINISTRADOR
const ADMIN_ID = Number(process.env.ADMIN_ID);

// ⚠️ LINK DA IMAGEM CORRETO
const IMAGEM_INICIAL = "https://thumbs2.imgbox.com/10/35/oHOjbfWZ_t.jpeg";

// Configuração Render
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('🚀 SellForge Online e funcionando na Render! ✅');
});

// ======================================
// WEBHOOK MERCADO PAGO
// ======================================
app.post('/webhook/mercadopago', async (req, res) => {
  try {
    const { topic, id } = req.body;

    if (topic === 'payment') {
      const pagamento = await Payment.get({ id: id }, mercadoPagoClient);
      
      if (pagamento.status === 'approved') {
        const { external_reference } = pagamento;
        const [userId, produtoId] = external_reference.split('_');

        const produtoDoc = await db.collection('produtos').doc(produtoId).get();
        if (!produtoDoc.exists) return res.sendStatus(404);

        const produto = produtoDoc.data();

        // 🚀 ENTREGA O PRODUTO
        await bot.sendMessage(userId, 
`✅ *PAGAMENTO APROVADO COM SUCESSO!* ✅

📦 Produto: *${produto.nome}*

🔗 Link do Produto:
${produto.link_produto}

📞 Suporte: ${produto.whatsapp || '51981528372'}

Obrigado pela compra! 🎉`, 
{ parse_mode: 'Markdown' });
        
        // 📉 DIMINUI ESTOQUE
        await db.collection('produtos').doc(produtoId).update({
          estoque: produto.estoque - 1
        });

        // 📝 SALVA PEDIDO
        await db.collection('produtos').doc(produtoId).update({
          estoque: produto.estoque - 1
        });

        await db.collection('pedidos').add({
          usuarioId: userId,
          produtoId: produtoId,
          pagamentoId: id,
          valor: pagamento.transaction_amount,
          data: Date.now(),
          status: 'aprovado'
        });
      }
    }
    res.sendStatus(200);
  } catch (error) {
    console.log('❌ Erro no Webhook:', error);
    res.sendStatus(500);
  }
});

// PORTA
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🔗 URL de Notificação: ${process.env.WEBHOOK_URL}/webhook/mercadopago`);
});

console.log('🚀 Sistema SellForge - Faelzin Vendas Iniciado!');

// ⚙️ VARIAVEIS DE ETAPAS
let etapaCadastro = {};
let etapaCategoria = {};

/*
====================================
FUNÇÃO PARA PEGAR PING
====================================
*/
function getPing() {
  const start = Date.now();
  return Date.now() - start;
}

/*
====================================
SALVAR USUÁRIO
====================================
*/
async function salvarUsuario(user) {
  try {
    await db.collection('users').doc(String(user.id)).set({
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
/START
====================================
*/
bot.onText(/\/start/, async (msg) => {
  await salvarUsuario(msg.from);
  const chatId = msg.chat.id;
  const pingAtual = getPing();

  // 🟢 ADMIN
  if (msg.from.id === ADMIN_ID) {
    return bot.sendPhoto(chatId, IMAGEM_INICIAL, {
      caption: 
`👑 *PAINEL ADMINISTRADOR* 👑

Olá Faelzin, seja bem-vindo ao seu painel de controle!

Favor, selecione o serviços logo abaixo:`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [ { text: '📦 Gerenciar Produtos', callback_data: 'MENU_PRODUTOS' } ],
          [ { text: '📂 Gerenciar Categorias', callback_data: 'MENU_CATEGORIAS' } ],
          [ { text: '🛒 Ir para Loja', callback_data: 'IR_PARA_LOJA' } ]
        ]
      }
    });
  }

  // 👤 CLIENTE
  bot.sendPhoto(chatId, IMAGEM_INICIAL, {
    caption: 
`🚀 *Bem-vindo ao SellForge* 🚀

Olá! Ficamos muito felizes em ter você aqui.

Favor, selecione o serviços logo abaixo:`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [ { text: '🛍️ Produtos', callback_data: 'PRODUTOS' } ],
        [ { text: '📶 Status Ping', callback_data: 'VER_PING' } ],
        [ { text: '👤 Informações Dono', callback_data: 'INFO_DONO' } ],
        [ { text: 'ℹ️ Informações Versão', callback_data: 'INFO_VERSAO' } ],
        [ { text: '📞 Suporte', callback_data: 'SUPORTE' } ]
      ]
    }
  });
});

/*
====================================
FUNÇÕES DE CATEGORIAS
====================================
*/
async function criarCategoria(nomeCompleto) {
  const id = nomeCompleto.toLowerCase().replace(/[\s&/]/g, '_');
  await db.collection('categorias').doc(id).set({
    nome: nomeCompleto,
    id: id,
    criadoEm: Date.now()
  });
}

async function deletarCategoria(idCategoria) {
  await db.collection('categorias').doc(idCategoria).delete();
}

async function listarCategorias() {
  const snapshot = await db.collection('categorias').orderBy('nome', 'asc').get();
  let lista = [];
  snapshot.forEach(doc => lista.push(doc.data()));
  return lista;
}

/*
====================================
✅ FUNÇÃO GERAR PAGAMENTO - VERSÃO CORRIGIDA
====================================
*/
async function gerarPagamento(chatId, produto) {
  try {
    // 🛑 VERIFICA SE TEM WEBHOOK
    if (!process.env.WEBHOOK_URL) {
      return bot.sendMessage(chatId, '❌ ERRO: Variável WEBHOOK_URL não configurada na Render!');
    }

    // 🛑 VERIFICA SE TEM TOKEN
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return bot.sendMessage(chatId, '❌ ERRO: Token do Mercado Pago não configurado!');
    }

    // 🛑 VERIFICA ESTOQUE
    if (produto.estoque <= 0) {
      return bot.sendMessage(chatId, '❌ Produto esgotado no momento!');
    }

    // 🛑 VERIFICA VALOR MÍNIMO (Mercado Pago não aceita abaixo de R$0,05 em produção)
    if (produto.valor < 0.05) {
      return bot.sendMessage(chatId, '❌ Valor muito baixo! Mínimo é R$0,05. Altere o valor do produto.');
    }

    console.log('📌 Tentando gerar pagamento para:', produto.nome, 'Valor:', produto.valor);

    // ✅ ESTRUTURA CORRETA PARA A VERSÃO NOVA DA API
    const pagamento = await Payment.create({
      body: {
        transaction_amount: produto.valor,
        description: `Compra: ${produto.nome}`,
        external_reference: `${chatId}_${produto.id}`,
        payment_method_id: 'pix',
        payer: {
          email: `cliente_${chatId}@sellforge.com.br`
        },
        notification_url: `${process.env.WEBHOOK_URL}/webhook/mercadopago`,
        date_of_expiration: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }
    }, mercadoPagoClient);

    // ✅ PEGA OS DADOS DO QR CODE
    const qrCodeImagem = pagamento.point_of_interaction.transaction_data.qr_code_image;
    const codigoCopiaCola = pagamento.point_of_interaction.transaction_data.qr_code;

    await bot.sendPhoto(chatId, `data:image/png;base64,${qrCodeImagem}`, {
      caption: 
`💸 *Pagamento Gerado!* 📱

🛍️ Produto: ${produto.nome}
💰 Valor: R$ ${produto.valor.toFixed(2)}
📦 Estoque: ${produto.estoque} unidades

📌 Escaneie o QR Code acima ou use o código abaixo:

📋 *Código Copia e Cola:*
\`\`\`
${codigoCopiaCola}
\`\`\`

⏳ Validade: 15 Minutos
✅ Após o pagamento, o produto chegará automaticamente!`,
      parse_mode: 'Markdown'
    });

  } catch (erro) {
    console.log('❌ ERRO COMPLETO:', JSON.stringify(erro, null, 2));
    let mensagem = '❌ Erro ao gerar pagamento.\n';
    
    // ✅ MOSTRA O ERRO EXATO PARA RESOLVERMOS
    if (erro.response && erro.response.data) {
      const dados = erro.response.data;
      mensagem += `📌 Código: ${dados.status}\n`;
      mensagem += `📌 Mensagem: ${dados.message}\n`;
      if (dados.cause) {
        dados.cause.forEach(c => {
          mensagem += `⚠️ Problema: ${c.code} -> ${c.description}\n`;
        });
      }
    } else {
      mensagem += `📌 Detalhe: ${erro.message}`;
    }

    bot.sendMessage(chatId, mensagem);
  }
}

    // ✅ PEGA OS DADOS DO QR CODE
    const qrCodeImagem = pagamento.point_of_interaction.transaction_data.qr_code_image;
    const codigoCopiaCola = pagamento.point_of_interaction.transaction_data.qr_code;

    await bot.sendPhoto(chatId, `data:image/png;base64,${qrCodeImagem}`, {
      caption: 
`💸 *Pagamento Gerado!* 📱

🛍️ Produto: ${produto.nome}
💰 Valor: R$ ${produto.valor.toFixed(2)}
📦 Estoque: ${produto.estoque} unidades

📌 Escaneie o QR Code acima ou use o código abaixo:

📋 *Código Copia e Cola:*
\`\`\`
${codigoCopiaCola}
\`\`\`

⏳ Validade: 15 Minutos
✅ Após o pagamento, o produto chegará automaticamente!`,
      parse_mode: 'Markdown'
    });

  } catch (erro) {
    console.log('❌ ERRO COMPLETO:', JSON.stringify(erro, null, 2));
    let mensagem = '❌ Erro ao gerar pagamento.\n';
    
    // ✅ MOSTRA O ERRO EXATO PARA RESOLVERMOS
    if (erro.response && erro.response.data) {
      const dados = erro.response.data;
      mensagem += `📌 Código: ${dados.status}\n`;
      mensagem += `📌 Mensagem: ${dados.message}\n`;
      if (dados.cause) {
        dados.cause.forEach(c => {
          mensagem += `⚠️ Problema: ${c.code} -> ${c.description}\n`;
        });
      }
    } else {
      mensagem += `📌 Detalhe: ${erro.message}`;
    }

    bot.sendMessage(chatId, mensagem);
  }
}

    // ✅ ESTRUTURA CORRETA PARA A VERSÃO NOVA DA API
    const pagamento = await Payment.create({
      body: {
        transaction_amount: produto.valor,
        description: `Compra: ${produto.nome}`,
        external_reference: `${chatId}_${produto.id}`,
        payment_method_id: 'pix',
        payer: {
          email: `cliente_${chatId}@sellforge.com.br`
        },
        notification_url: `${process.env.WEBHOOK_URL}/webhook/mercadopago`,
        date_of_expiration: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }
    }, mercadoPagoClient);

    // ✅ PEGA OS DADOS DO QR CODE
    const qrCodeImagem = pagamento.point_of_interaction.transaction_data.qr_code_image;
    const codigoCopiaCola = pagamento.point_of_interaction.transaction_data.qr_code;

    await bot.sendPhoto(chatId, `data:image/png;base64,${qrCodeImagem}`, {
      caption: 
`💸 *Pagamento Gerado!* 📱

🛍️ Produto: ${produto.nome}
💰 Valor: R$ ${produto.valor.toFixed(2)}
📦 Estoque: ${produto.estoque} unidades

📌 Escaneie o QR Code acima ou use o código abaixo:

📋 *Código Copia e Cola:*
\`\`\`
${codigoCopiaCola}
\`\`\`

⏳ Validade: 15 Minutos
✅ Após o pagamento, o produto chegará automaticamente!`,
      parse_mode: 'Markdown'
    });

  } catch (erro) {
    console.log('❌ ERRO AO GERAR PAGAMENTO:', erro);
    let mensagem = '❌ Erro ao gerar pagamento. ';
    
    // ✅ MOSTRA O ERRO EXATO PARA SABERMOS
    if (erro.response && erro.response.data) {
      if (erro.response.data.message) mensagem += erro.response.data.message;
      if (erro.response.data.cause) mensagem += ' | ' + erro.response.data.cause.map(c => c.description).join(', ');
    }
    bot.sendMessage(chatId, mensagem);
  }
}

/*
====================================
RECEBER MENSAGENS E ETAPAS
====================================
*/
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.text && msg.text.startsWith('/')) {
    if (etapaCadastro[chatId]) delete etapaCadastro[chatId];
    if (etapaCategoria[chatId]) delete etapaCategoria[chatId];
    return;
  }

  // ETAPA CRIAR/DELETAR CATEGORIA
  if (etapaCategoria[chatId]) {
    const etapa = etapaCategoria[chatId].etapa;
    if (etapa === 'criar') {
      try { await criarCategoria(msg.text); bot.sendMessage(chatId, `✅ *Categoria criada com sucesso!*\n\n📂 Nome: ${msg.text}`, {parse_mode:'Markdown'}); } 
      catch (e) { bot.sendMessage(chatId, '❌ Erro ao criar categoria.'); }
      delete etapaCategoria[chatId]; return;
    }
    if (etapa === 'deletar') {
      try { await deletarCategoria(msg.text); bot.sendMessage(chatId, '✅ *Categoria deletada com sucesso!*'); } 
      catch (e) { bot.sendMessage(chatId, '❌ Categoria não encontrada ou erro ao deletar.'); }
      delete etapaCategoria[chatId]; return;
    }
  }

  // ETAPA CADASTRAR PRODUTO
  if (etapaCadastro[chatId]) {
    const etapa = etapaCadastro[chatId].etapa;
    try {
      if (etapa === 'img_produto') {
        if (!msg.photo) return bot.sendMessage(chatId, '❌ Por favor, envie apenas uma imagem.');
        etapaCadastro[chatId].dados.img_produto = msg.photo[msg.photo.length - 1].file_id;
        etapaCadastro[chatId].etapa = 'nome'; return bot.sendMessage(chatId, '✍️ Nome do produto:');
      }
      if (etapa === 'nome') { etapaCadastro[chatId].dados.nome = msg.text; etapaCadastro[chatId].etapa = 'valor'; return bot.sendMessage(chatId, '💰 Valor (ex: 19.90):'); }
      if (etapa === 'valor') { 
        const valor = Number(msg.text.replace(',','.')); 
        if(isNaN(valor) || valor <=0) return bot.sendMessage(chatId, '❌ Valor inválido! Apenas números.'); 
        etapaCadastro[chatId].dados.valor = valor; etapaCadastro[chatId].etapa = 'descricao'; return bot.sendMessage(chatId, '📝 Descrição do produto:'); 
      }
      if (etapa === 'descricao') { etapaCadastro[chatId].dados.descricao = msg.text; etapaCadastro[chatId].etapa = 'estoque'; return bot.sendMessage(chatId, '📦 Quantidade em estoque:'); }
      if (etapa === 'estoque') { 
        const qtd = Number(msg.text); 
        if(isNaN(qtd) || qtd <0) return bot.sendMessage(chatId, '❌ Quantidade inválida!'); 
        etapaCadastro[chatId].dados.estoque = qtd; etapaCadastro[chatId].etapa = 'whatsapp'; return bot.sendMessage(chatId, '📞 WhatsApp para suporte:'); 
      }
      if (etapa === 'whatsapp') { etapaCadastro[chatId].dados.whatsapp = msg.text; etapaCadastro[chatId].etapa = 'link_produto'; return bot.sendMessage(chatId, '🔗 Link do produto:'); }
      if (etapa === 'link_produto') { 
        etapaCadastro[chatId].dados.link_produto = msg.text; 
        const categorias = await listarCategorias();
        if(categorias.length ===0) { bot.sendMessage(chatId, '❌ Nenhuma categoria cadastrada! Crie uma primeiro.'); delete etapaCadastro[chatId]; return; }
        let botoesCat = []; categorias.forEach(cat => botoesCat.push([{text:cat.nome, callback_data:`CAT_ESCOLHIDA_${cat.id}`}]));
        etapaCadastro[chatId].etapa = 'categoria';
        return bot.sendMessage(chatId, '📂 Selecione a Categoria:', {reply_markup:{inline_keyboard:botoesCat}});
      }
    } catch (e) { console.log(e); delete etapaCadastro[chatId]; }
  }
});

/*
====================================
CALLBACKS / BOTÕES
====================================
*/
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const pingAtual = getPing();

  try {
    // MENUS ADMIN
    if (query.data === 'MENU_PRODUTOS') {
      return bot.sendMessage(chatId, '📦 *GERENCIAR PRODUTOS*', {parse_mode:'Markdown', reply_markup:{inline_keyboard:[[{text:'📝 Cadastrar Novo Produto', callback_data:'CADASTRAR_PRODUTO_INICIO'}],[{text:'📋 Ver Todos Produtos', callback_data:'LISTAR_PRODUTOS'}],[{text:'🔙 Voltar', callback_data:'VOLTAR_ADMIN'}]]}});
    }
    if (query.data === 'MENU_CATEGORIAS') {
      return bot.sendMessage(chatId, '📂 *GERENCIAR CATEGORIAS*', {parse_mode:'Markdown', reply_markup:{inline_keyboard:[[{text:'➕ Criar Nova Categoria', callback_data:'CRIAR_CATEGORIA'}],[{text:'❌ Deletar Categoria', callback_data:'DELETAR_CATEGORIA_MENU'}],[{text:'📄 Ver Todas Categorias', callback_data:'VER_CATEGORIAS'}],[{text:'🔙 Voltar', callback_data:'VOLTAR_ADMIN'}]]}});
    }
    if (query.data === 'VOLTAR_ADMIN') {
      return bot.sendPhoto(chatId, IMAGEM_INICIAL, {caption:'👑 *PAINEL ADMINISTRADOR* 👑\n\nOlá Faelzin, seja bem-vindo ao seu painel de controle!', parse_mode:'Markdown', reply_markup:{inline_keyboard:[[{text:'📦 Gerenciar Produtos', callback_data:'MENU_PRODUTOS'}],[{text:'📂 Gerenciar Categorias', callback_data:'MENU_CATEGORIAS'}],[{text:'🛒 Ir para Loja', callback_data:'IR_PARA_LOJA'}]]}});
    }

    // AÇÕES CATEGORIAS
    if (query.data === 'CRIAR_CATEGORIA') { etapaCategoria[chatId]={etapa:'criar'}; return bot.sendMessage(chatId, '➕ Envie o NOME COMPLETO da nova categoria:'); }
    if (query.data === 'DELETAR_CATEGORIA_MENU') { 
      const categorias = await listarCategorias(); if(categorias.length===0) return bot.sendMessage(chatId, '❌ Nenhuma categoria encontrada.');
      let botoesDel=[]; categorias.forEach(c=>botoesDel.push([{text:`❌ ${c.nome}`, callback_data:`DELCAT_${c.id}`}]));
      return bot.sendMessage(chatId, '⚠️ Escolha qual categoria DELETAR:', {reply_markup:{inline_keyboard:botoesDel}});
    }
    if (query.data.startsWith('DELCAT_')) { const id=query.data.split('_')[1]; await deletarCategoria(id); bot.sendMessage(chatId, '✅ Categoria deletada com sucesso!'); return bot.answerCallbackQuery(query.id); }
    if (query.data === 'VER_CATEGORIAS') { 
      const categorias = await listarCategorias(); if(categorias.length===0) return bot.sendMessage(chatId, '❌ Nenhuma categoria cadastrada.');
      let texto='📄 *SUAS CATEGORIAS* 📄\n\n'; categorias.forEach(c=>texto+=`📂 ${c.nome}\n`);
      return bot.sendMessage(chatId, texto, {parse_mode:'Markdown'});
    }

    // CADASTRO PRODUTO
    if (query.data === 'CADASTRAR_PRODUTO_INICIO') { etapaCadastro[chatId]={etapa:'img_produto', dados:{}}; return bot.sendMessage(chatId, '📸 1/8 - Envie a IMAGEM do produto:'); }
    if (query.data.startsWith('CAT_ESCOLHIDA_')) { 
      const idCat = query.data.split('_')[2]; etapaCadastro[chatId].dados.categoria=idCat;
      await db.collection('produtos').add(etapaCadastro[chatId].dados);
      bot.sendMessage(chatId, `✅ *PRODUTO CADASTRADO COM SUCESSO!* 🎉\n📌 Nome: ${etapaCadastro[chatId].dados.nome}\n💰 Valor: R$ ${etapaCadastro[chatId].dados.valor.toFixed(2)}\n📦 Estoque: ${etapaCadastro[chatId].dados.estoque}`, {parse_mode:'Markdown'});
      delete etapaCadastro[chatId]; return bot.answerCallbackQuery(query.id);
    }
    if (query.data === 'LISTAR_PRODUTOS') { 
      const snap = await db.collection('produtos').get(); if(snap.empty) return bot.sendMessage(chatId, '❌ Nenhum produto cadastrado.');
      let texto='📋 *LISTA DE PRODUTOS* 📋\n\n'; snap.forEach(d=>{const p=d.data(); texto+=`📌 ${p.nome} | R$${p.valor.toFixed(2)} | Estoque:${p.estoque}\n`;});
      return bot.sendMessage(chatId, texto, {parse_mode:'Markdown'});
    }

    // VOLTAR LOJA
    if (query.data === 'IR_PARA_LOJA') {
      return bot.sendPhoto(chatId, IMAGEM_INICIAL, {caption:'🚀 *Bem-vindo ao SellForge* 🚀\n\nFavor, selecione o serviços logo abaixo:', parse_mode:'Markdown', reply_markup:{inline_keyboard:[[{text:'🛍️ Produtos', callback_data:'PRODUTOS'}],[{text:'📶 Status Ping', callback_data:'VER_PING'}],[{text:'👤 Informações Dono', callback_data:'INFO_DONO'}],[{text:'ℹ️ Informações Versão', callback_data:'INFO_VERSAO'}],[{text:'📞 Suporte', callback_data:'SUPORTE'}]]}});
    }

    // CLIENTE MENUS
    if (query.data === 'PRODUTOS') { 
      const categorias = await listarCategorias(); if(categorias.length===0) return bot.sendMessage(chatId, '❌ Nenhuma categoria disponível no momento.');
      let botoesCat=[]; categorias.forEach(c=>botoesCat.push([{text:c.nome, callback_data:`CAT_${c.id}`}]));
      return bot.sendMessage(chatId, '📂 Selecione a Categoria:', {reply_markup:{inline_keyboard:botoesCat}});
    }
    if (query.data === 'VER_PING') { return bot.sendMessage(chatId, `📶 *Status do Sistema*\n\n${pingAtual}ms em tempo real`, {parse_mode:'Markdown'}); }
    if (query.data === 'INFO_DONO') { return bot.sendMessage(chatId, `👤 *Informações do Dono*\n\nSellForge - Faelzin Vendas`, {parse_mode:'Markdown'}); }
    if (query.data === 'INFO_VERSAO') { return bot.sendMessage(chatId, `ℹ️ *Informações da Versão*\n\nMercado pago Max Pay`, {parse_mode:'Markdown'}); }
    if (query.data === 'SUPORTE') { return bot.sendMessage(chatId, `📞 *Suporte*\n\n51981528372`, {parse_mode:'Markdown'}); }

    // ABRIR CATEGORIA E PRODUTOS
    if (query.data.startsWith('CAT_') && !query.data.startsWith('CAT_ESCOLHIDA_')) {
      const idCat = query.data.split('_')[1]; const docCat = await db.collection('categorias').doc(idCat).get(); const nomeCat = docCat.exists ? docCat.data().nome : 'Categoria';
      const snapProd = await db.collection('produtos').where('categoria','==',idCat).get();
      if(snapProd.empty) return bot.sendMessage(chatId, `📂 ${nomeCat}\n\n❌ Nenhum produto cadastrado nessa categoria.`);
      let botoes=[]; snapProd.forEach(d=>{const p=d.data(); p.id=d.id; botoes.push([{text:`${p.nome} | R$${p.valor.toFixed(2)} | Estoque:${p.estoque}`, callback_data:`COMPRAR_${p.id}`}]);});
      return bot.sendMessage(chatId, `📂 *${nomeCat}*\n\nEscolha um produto:`, {parse_mode:'Markdown', reply_markup:{inline_keyboard:botoes}});
    }

    // MOSTRAR PRODUTO
    if (query.data.startsWith('COMPRAR_')) {
      const idProd = query.data.split('_')[1]; const docProd = await db.collection('produtos').doc(idProd).get(); if(!docProd.exists) return bot.sendMessage(chatId, '❌ Produto não encontrado.');
      const p = docProd.data(); p.id=idProd;
      return bot.sendPhoto(chatId, p.img_produto, {caption:`📦 *${p.nome}*\n\n📝 Descrição: ${p.descricao}\n💰 Valor: R$ ${p.valor.toFixed(2)}\n📦 Estoque: ${p.estoque} disponíveis\n\n👇 Clique abaixo para gerar pagamento`, parse_mode:'Markdown', reply_markup:{inline_keyboard:[[{text:'💸 Gerar Pagamento PIX', callback_data:`PAGAR_${idProd}`}]]}});
    }

    // CHAMA FUNÇÃO DE PAGAMENTO
    if (query.data.startsWith('PAGAR_')) {
      const idProd = query.data.split('_')[1]; const docProd = await db.collection('produtos').doc(idProd).get(); const p = docProd.data(); p.id=idProd;
      await gerarPagamento(chatId, p);
    }

    await bot.answerCallbackQuery(query.id);

  } catch (error) {
    console.log('❌ Erro geral:', error);
  }
});

/*
====================================
ERROS
====================================
*/
bot.on('polling_error', (error) => { console.log('⚠️ Erro de conexão:', error.message); });
process.on('uncaughtException', (error) => { console.log('⚠️ Erro geral:', error); });
process.on('unhandledRejection', (error) => { console.log('⚠️ Rejeição não tratada:', error); });
