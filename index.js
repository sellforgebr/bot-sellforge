require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const db = require('./firebase'); // MANTÉM SEU FIREBASE AQUI

const app = express();

// ======================================
// ⚙️ CONFIGURAÇÕES GERAIS
// ======================================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID); // 🔴 COLOQUE SEU ID TELEGRAM AQUI
const IMG_LOGO = "https://imgbox.com/oHOjbfWZ"; // 🔴 COLOQUE SEU LINK DE IMAGEM (JPG/PNG)

// 🟢 AGORA O BOT É CRIADO AQUI, ANTES DE SER USADO!
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// 🛡️ SISTEMA DE SEGURANÇA - SUAS REGRAS
const PALAVROES_PROIBIDOS = ["palavrao1", "palavrao2", "ofensa", "xingamento"]; // 🔴 ADICIONE OUTRAS SE QUISER
const LIMITE_COMANDOS_DIARIO = 50;
let contadorComandos = {};
let bloqueados = {};

// 📌 ETAPAS DO SISTEMA
let etapaUsuario = {};

// ======================================
// 🛡️ FUNÇÃO DE SEGURANÇA COMPLETA
// ======================================
function verificarSeguranca(texto, chatId, nome = "") {
  // 🔴 LIMITE DE COMANDOS
  if (!contadorComandos[chatId]) contadorComandos[chatId] = 0;
  contadorComandos[chatId]++;
  if (contadorComandos[chatId] > LIMITE_COMANDOS_DIARIO) {
    bot.sendMessage(chatId, "❌ Você atingiu limite diário de comandos!");
    return false;
  }

  // 🔴 ANTI-PALAVRÃO - NÍVEL HARD
  const textoMinusculo = texto.toLowerCase();
  if (PALAVROES_PROIBIDOS.some(palavra => textoMinusculo.includes(palavra))) {
    bot.sendMessage(chatId, "⚠️ Sistema sensível detectado: palavras inadequadas ❌");
    return false;
  }

  // 🔴 ANTI-LINK E COMPARTILHAMENTO - HARD DETECT
  if (/https?:\/\/|t\.me|@|www\./gi.test(texto)) {
    bot.sendMessage(chatId, "🚫 Detectamos link ou compartilhamento não oficial ❌");
    return false;
  }

  // 🔴 ANTI-APELIDO INADEQUADO - HARD DETECT
  if (nome && /[^\w\sáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/gi.test(nome)) {
    bot.sendMessage(chatId, "⚠️ Detectamos apelidos inapropriados ❌");
    return false;
  }

  return true;
}

// ======================================
// 🚀 INICIO DO BOT /START
// ======================================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const nomeUsuario = msg.from.first_name || "Usuário";

  // ✅ VERIFICA SEGURANÇA
  if (!verificarSeguranca("inicio", chatId, nomeUsuario)) return;

  // 📩 MENSAGEM DE BOAS VINDAS
  await bot.sendPhoto(chatId, IMG_LOGO, {
    caption: `👋 Olá ${nomeUsuario}, sou seu assistente virtual, como posso lhe ajudar? Confira nosso menu atualizado.

📌 *Informações*:
👤 Criador: Faelzin criador oficial prompt
📞 WhatsApp: 55 51 98152-8372
🆔 Seu ID: \`${chatId}\`

📋 *Menu Atualizado*:`,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛍️ Produtos", callback_data: "menu_produtos" }],
        [{ text: "📞 Suporte", callback_data: "menu_suporte" }],
        [{ text: "ℹ️ Informações Bot", callback_data: "menu_bot" }],
        [{ text: "👤 Informações Dono", callback_data: "menu_dono" }],
        [{ text: "📂 Categorias", callback_data: "menu_categorias" }],
        [{ text: "⚡ Comandos Limite", callback_data: "menu_limite" }]
      ]
    }
  });
});

// ======================================
// 📂 FUNÇÕES DE BANCO DE DADOS (FIREBASE)
// ======================================
async function listarCategorias() {
  const snap = await db.collection("categorias").orderBy("nome", "asc").get();
  let lista = [];
  snap.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
  return lista;
}

async function listarProdutosPorCategoria(idCategoria) {
  const snap = await db.collection("produtos").where("categoria", "==", idCategoria).get();
  let lista = [];
  snap.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
  return lista;
}

async function pegarProdutoPorId(idProduto) {
  const doc = await db.collection("produtos").doc(idProduto).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// ======================================
// 📩 RECEBER MENSAGENS DO USUÁRIO
// ======================================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text || "";

  // ❌ IGNORA COMANDOS
  if (texto.startsWith("/")) return;

  // ✅ SEGURANÇA
  if (!verificarSeguranca(texto, chatId)) return;

  // ======================================
  // 🟑 ÁREA DO ADMIN - LIBERAÇÃO MANUAL
  // FORMATO PARA ENVIAR:  ID_DO_CLIENTE | LINK_DO_PRODUTO
  // ======================================
  if (chatId === ADMIN_ID && texto.includes("|")) {
    const partes = texto.split("|").map(p => p.trim());
    const idCliente = partes[0];
    const linkEntrega = partes[1];

    if (idCliente && linkEntrega) {
      // ✅ ENVIA PRODUTO PARA O CLIENTE
      await bot.sendMessage(idCliente, `✅ *PRODUTO ENVIADO COM SUCESSO* ✔️

🔗 Link de Entrega:
${linkEntrega}

Obrigado pela sua preferência! 🎉
*official creator Prompt - Faelzin*`, { parse_mode: "Markdown" });

      // ✅ CONFIRMA PARA VOCÊ
      return bot.sendMessage(ADMIN_ID, "📨 Entrega realizada com sucesso para o cliente! ✅");
    } else {
      // ❌ DADOS FALTANDO
      return bot.sendMessage(ADMIN_ID, "❌ Informações incompletas ou não preenchidas!\n\nFormato correto:\n`ID | LINK`", { parse_mode: "Markdown" });
    }
  }

  // ======================================
  // 🧑‍🤝‍🧑 ÁREA DO CLIENTE - ENVIO DE COMPROVANTE
  // ======================================
  if (etapaUsuario[chatId]?.etapa === "aguardar_comprovante") {
    const produto = etapaUsuario[chatId].produto;

    // ✅ AVISA O CLIENTE
    await bot.sendMessage(chatId, `✅ *Informações recebidas!*

📌 Lembre-se: compre somente comigo e evitem golpes, fraudes!

Aguarde enquanto verificamos o pagamento, em breve seu produto será liberado! 🕒`);

    // ✅ AVISA VOCÊ (ADMIN) PARA LIBERAR
    await bot.sendMessage(ADMIN_ID, `📥 *NOVA SOLICITAÇÃO DE PRODUTO*

🆔 Cliente ID: \`${chatId}\`
🛍️ Produto: *${produto.nome}*
💰 Valor: R$ ${produto.valor.toFixed(2)}

📄 Comprovante/Informações:
${texto || "Imagem enviada"}

➡️ Para liberar, envie aqui:
\`${chatId} | LINK_DO_PRODUTO\`
`, { parse_mode: "Markdown" });

    // 🧹 LIMPA ETAPA
    delete etapaUsuario[chatId];
  }
});

// ======================================
// 🎛️ AÇÕES DOS BOTÕES
// ======================================
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const acao = query.data;

  // ✅ SEGURANÇA
  if (!verificarSeguranca(acao, chatId)) return;

  try {
    // 📂 MENU CATEGORIAS
    if (acao === "menu_categorias") {
      const categorias = await listarCategorias();
      if (categorias.length === 0) return bot.sendMessage(chatId, "❌ Nenhuma categoria cadastrada!");

      const botoes = categorias.map(cat => [{ text: cat.nome, callback_data: `cat_${cat.id}` }]);
      return bot.sendMessage(chatId, "📂 *Selecione a Categoria desejada:*", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: botoes }
      });
    }

    // 🛍️ LISTAR PRODUTOS DE UMA CATEGORIA
    if (acao.startsWith("cat_")) {
      const idCat = acao.split("_")[1];
      const produtos = await listarProdutosPorCategoria(idCat);

      if (produtos.length === 0) return bot.sendMessage(chatId, "❌ Nenhum produto cadastrado nessa categoria!");

      // 📤 MOSTRA TODOS OS PRODUTOS
      for (const prod of produtos) {
        const mensagem = `📦 *${prod.nome}*

📝 Descrição: ${prod.descricao || "Sem descrição"}
💰 Valor: R$ ${prod.valor.toFixed(2)}
📦 Estoque: ${prod.estoque || "Indisponível"}
🎬 Vídeo: ${prod.video || "Não incluso"}
📞 WhatsApp: 55 51 98152-8372

🆔 Seu ID: \`${chatId}\`

⚠️ *Aviso*: Lembre-se compre somente comigo e evitem golpes, fraudes!`;

        await bot.sendPhoto(chatId, prod.img, {
          caption: mensagem,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "📩 Enviar Comprovante / Solicitar", callback_data: `comprar_${prod.id}` }
            ]]
          }
        });
      }
      return;
    }

    // 📥 CLIENTE QUER COMPRAR / SOLICITAR
    if (acao.startsWith("comprar_")) {
      const idProd = acao.split("_")[1];
      const produto = await pegarProdutoPorId(idProd);
      if (!produto) return bot.sendMessage(chatId, "❌ Produto não encontrado!");

      // 📌 GUARDA ETAPA
      etapaUsuario[chatId] = { etapa: "aguardar_comprovante", produto: produto };

      return bot.sendMessage(chatId, `📝 *Instruções para liberação:*

1. Efetue o pagamento para o WhatsApp: 55 51 98152-8372
2. Envie aqui a IMAGEM do COMPROVANTE ou os dados da transação
3. Aguardar confirmação e liberação ✅

🆔 *Seu ID para identificação:* \`${chatId}\`

Aguardando envio...`, { parse_mode: "Markdown" });
    }

    // 📌 OUTROS MENUS
    switch (acao) {
      case "menu_produtos":
        return bot.sendMessage(chatId, "🛍️ *Produtos*\nEscolha uma categoria abaixo 👇", {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "📂 Ver Categorias", callback_data: "menu_categorias" }]] }
        });

      case "menu_suporte":
        return bot.sendMessage(chatId, "📞 *Suporte ao Cliente*\n\nWhatsApp: 55 51 98152-8372\nTelegram: @SeuUsuario", { parse_mode: "Markdown" });

      case "menu_bot":
        return bot.sendMessage(chatId, "ℹ️ *Informações do Bot*\n\nVersão: Lite Oficial\nDesenvolvido para: Faelzin\n*official creator Prompt - Faelzin*", { parse_mode: "Markdown" });

      case "menu_dono":
        return bot.sendMessage(chatId, "👤 *Informações do Dono*\n\nNome: Faelzin\nContato: 55 51 98152-8372\nID Oficial: `SEU_ID_AQUI`", { parse_mode: "Markdown" });

      case "menu_limite":
        const usados = contadorComandos[chatId] || 0;
        return bot.sendMessage(chatId, `⚡ *Limite de Comandos*\n\nUtilizados: ${usados}/${LIMITE_COMANDOS_DIARIO}\n*official creator Prompt - Faelzin*`, { parse_mode: "Markdown" });
    }

  } catch (erro) {
    bot.sendMessage(chatId, "❌ Ocorreu um erro no sistema! Tente novamente.");
  }

  await bot.answerCallbackQuery(query.id);
});

// ======================================
// 🚀 INICIAR SERVIDOR
// ======================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("✅ Sistema Online - Render + GitHub"));

console.log("✅ Base Lite Oficial - Faelzin Carregada com Sucesso!");
