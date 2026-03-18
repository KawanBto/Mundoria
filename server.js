const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

// --- CONFIGURAÇÕES DE ARQUIVOS (UPLOAD) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, 'foto-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- MIDDLEWARES ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: 'segredo-mundoria', resave: false, saveUninitialized: true }));

// 🔥 RESOLVE O "CANNOT GET": Esta linha permite que o Node sirva todos os seus arquivos HTML/CSS/JS diretamente
app.use(express.static(path.join(__dirname))); 
app.use('/uploads', express.static('uploads'));

const db = new sqlite3.Database('./banco_mundoria.db');

// --- TABELAS (Mantidas para as partes ainda não migradas) ---
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, email TEXT UNIQUE, senha TEXT, foto TEXT, endereco TEXT, cidade TEXT, estado TEXT, tipo TEXT DEFAULT 'turista', data_fim_assinatura TEXT, cancelamento_agendado INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS locais (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, categoria TEXT, descricao TEXT, endereco TEXT, numero TEXT, imagem TEXT, data_evento TEXT, horario TEXT, tipo_local TEXT DEFAULT 'ponto', id_organizador INTEGER, id_dono INTEGER, lat REAL, lon REAL, status TEXT DEFAULT 'aprovado')`);
    db.run(`CREATE TABLE IF NOT EXISTS avaliacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, id_usuario INTEGER, id_local INTEGER, nota INTEGER, comentario TEXT, resposta TEXT, data_avaliacao DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS favoritos (id INTEGER PRIMARY KEY AUTOINCREMENT, id_usuario INTEGER, id_local INTEGER)`);
    db.run(`CREATE TABLE IF NOT EXISTS roteiros (id INTEGER PRIMARY KEY AUTOINCREMENT, id_usuario INTEGER, nome_roteiro TEXT, descricao TEXT, foto_capa TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS roteiro_itens (id INTEGER PRIMARY KEY AUTOINCREMENT, id_roteiro INTEGER, id_local INTEGER, data_visita TEXT)`);
});

// --- ROTAS DE PÁGINAS ---
// O index.html é servido automaticamente na raiz '/'
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

// Rotas amigáveis (opcional, já que o express.static cuida dos .html)
app.get('/login', (req, res) => { res.sendFile(path.join(__dirname, 'login.html')); });
app.get('/cadastro', (req, res) => { res.sendFile(path.join(__dirname, 'cadastro.html')); });
app.get('/painel', (req, res) => { res.sendFile(path.join(__dirname, 'meu_painel.html')); });
app.get('/detalhes', (req, res) => { res.sendFile(path.join(__dirname, 'detalhes.html')); });

// --- APIS MANTIDAS (Para o que ainda não foi pro Firebase) ---
// Note que REMOVI o /api/login e /api/cadastro originais para não conflitar com o Firebase

app.get('/api/locais', (req, res) => { 
    db.all("SELECT * FROM locais WHERE status='aprovado'", [], (e, r) => res.json(r)); 
});

// Outras APIs de Roteiros e Favoritos que você ainda usa no SQLite podem continuar aqui...
// ... (mantenha as rotas de api/roteiros se ainda não migrou os roteiros para o Firestore)

app.listen(3000, () => {
    console.log('-------------------------------------------');
    console.log('🚀 Mundoria Online: http://localhost:3000');
    console.log('✅ Servidor de arquivos estáticos ATIVO');
    console.log('-------------------------------------------');
});