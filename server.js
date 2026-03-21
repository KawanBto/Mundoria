const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

// --- CONFIGURAÇÕES DE ARQUIVOS (UPLOAD LOCAL - OPCIONAL) ---
// Nota: Se você já migrou todas as fotos para o Firebase Storage, 
// você pode até remover o multer e a pasta uploads depois.
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

// SERVIDOR DE ARQUIVOS ESTÁTICOS
// Isso permite que o navegador acesse seus HTMLs, CSS e JS
app.use(express.static(path.join(__dirname))); 
app.use('/uploads', express.static('uploads'));

// --- ROTAS DE PÁGINAS ---
// O Express servirá os arquivos conforme você acessar as rotas
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/login', (req, res) => { res.sendFile(path.join(__dirname, 'login.html')); });
app.get('/cadastro', (req, res) => { res.sendFile(path.join(__dirname, 'cadastro.html')); });
app.get('/painel', (req, res) => { res.sendFile(path.join(__dirname, 'meu_painel.html')); });
app.get('/detalhes', (req, res) => { res.sendFile(path.join(__dirname, 'detalhes.html')); });

// --- REMOVIDO: TODA A LÓGICA DE SQLITE ---
// O seu Frontend agora busca os locais diretamente do Firestore:
// const snap = await getDocs(query(collection(db, "locais"), where("status", "==", "ativo")));
// Portanto, a rota /api/locais que usava o banco antigo não é mais necessária.

app.listen(3000, () => {
    console.log('-------------------------------------------');
    console.log('🌍 Mundoria Online: http://localhost:3000');
    console.log('🚀 Sistema rodando via Firebase (Nuvem)');
    console.log('-------------------------------------------');
});