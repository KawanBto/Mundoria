const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

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

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: 'segredo-mundoria', resave: false, saveUninitialized: true }));
app.use('/uploads', express.static('uploads'));

const db = new sqlite3.Database('./banco_mundoria.db');

// --- TABELAS ---
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, email TEXT UNIQUE, senha TEXT, foto TEXT, endereco TEXT, cidade TEXT, estado TEXT, tipo TEXT DEFAULT 'turista', data_fim_assinatura TEXT, cancelamento_agendado INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS locais (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, categoria TEXT, descricao TEXT, endereco TEXT, numero TEXT, imagem TEXT, data_evento TEXT, horario TEXT, tipo_local TEXT DEFAULT 'ponto', id_organizador INTEGER, id_dono INTEGER, lat REAL, lon REAL, status TEXT DEFAULT 'aprovado')`);
    db.run(`CREATE TABLE IF NOT EXISTS avaliacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, id_usuario INTEGER, id_local INTEGER, nota INTEGER, comentario TEXT, resposta TEXT, data_avaliacao DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS favoritos (id INTEGER PRIMARY KEY AUTOINCREMENT, id_usuario INTEGER, id_local INTEGER)`);
    db.run(`CREATE TABLE IF NOT EXISTS roteiros (id INTEGER PRIMARY KEY AUTOINCREMENT, id_usuario INTEGER, nome_roteiro TEXT, descricao TEXT, foto_capa TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS roteiro_itens (id INTEGER PRIMARY KEY AUTOINCREMENT, id_roteiro INTEGER, id_local INTEGER, data_visita TEXT)`);
});

// --- SEMENTES ---
function criarUsuariosSemente() {
    const emailAdmin = 'admin@mundoria.com';
    db.get("SELECT * FROM usuarios WHERE email = ?", [emailAdmin], (err, row) => {
        if (!row) db.run(`INSERT INTO usuarios (nome, email, senha, tipo, foto) VALUES (?, ?, 'admin', 'admin', 'https://cdn-icons-png.flaticon.com/512/2206/2206368.png')`, ["Artur (Gestor)", emailAdmin]);
    });
    const emailProd = 'guilherme@mundoria.com';
    db.get("SELECT * FROM usuarios WHERE email = ?", [emailProd], (err, row) => {
        if (!row) {
            const dt = new Date(); dt.setFullYear(dt.getFullYear() + 5);
            db.run(`INSERT INTO usuarios (nome, email, senha, tipo, foto, data_fim_assinatura) VALUES (?, ?, 'guilherme', 'produtor', 'https://cdn-icons-png.flaticon.com/512/4086/4086679.png', ?)`, ["Guilherme (Produtor)", emailProd, dt.toISOString()]);
        }
    });
    // 🔥 NOVO USUÁRIO: DIEGO (ANALISTA) 🔥
    const emailAnalista = 'diego@mundoria.com';
    db.get("SELECT * FROM usuarios WHERE email = ?", [emailAnalista], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO usuarios (nome, email, senha, tipo, foto) VALUES (?, ?, 'diego', 'analista', 'https://cdn-icons-png.flaticon.com/512/4086/4086569.png')`, ["Diego (Analista)", emailAnalista]);
        }
    });
}
setTimeout(criarUsuariosSemente, 1000);

// --- ROTAS ---
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/login', (req, res) => { res.sendFile(path.join(__dirname, 'login.html')); });
app.get('/cadastro', (req, res) => { res.sendFile(path.join(__dirname, 'cadastro.html')); });
app.get('/perfil', (req, res) => { if(!req.session.usuarioLogado) return res.redirect('/login'); res.sendFile(path.join(__dirname, 'perfil.html')); });
app.get('/painel', (req, res) => { if(!req.session.usuarioLogado) return res.redirect('/login'); if(req.session.usuarioLogado.tipo === 'admin') return res.redirect('/admin'); if(req.session.usuarioLogado.tipo === 'analista') return res.redirect('/painel-analista'); res.sendFile(path.join(__dirname, 'meu_painel.html')); });
app.get('/admin', (req, res) => { if (!req.session.usuarioLogado || req.session.usuarioLogado.tipo !== 'admin') return res.send('<script>alert("Restrito."); window.location.href="/";</script>'); res.sendFile(path.join(__dirname, 'painel_admin.html')); });
// 🔥 ROTA DO ANALISTA 🔥
app.get('/painel-analista', (req, res) => { if (!req.session.usuarioLogado || req.session.usuarioLogado.tipo !== 'analista') return res.send('<script>alert("Restrito."); window.location.href="/";</script>'); res.sendFile(path.join(__dirname, 'painel_analista.html')); });

app.get('/planos', (req, res) => { res.sendFile(path.join(__dirname, 'planos.html')); });
app.get('/detalhes', (req, res) => { res.sendFile(path.join(__dirname, 'detalhes.html')); });
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });
app.get('/popular-banco', (req, res) => { res.send("<h1>Banco OK.</h1>"); });

// --- APIS GERAIS ---
app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    db.get(`SELECT * FROM usuarios WHERE email = ? AND senha = ?`, [email, senha], (err, u) => {
        if (!u) return res.send('<script>alert("Dados incorretos."); window.location.href="/login";</script>');
        req.session.usuarioLogado = u;
        if (u.tipo === 'admin') res.send('<script>window.location.href="/admin";</script>');
        else if (u.tipo === 'analista') res.send('<script>window.location.href="/painel-analista";</script>');
        else res.send('<script>window.location.href="/painel";</script>');
    });
});
app.post('/api/cadastro', (req, res) => { const { nome, email, senha } = req.body; db.run(`INSERT INTO usuarios (nome, email, senha, foto) VALUES (?, ?, ?, 'https://cdn-icons-png.flaticon.com/512/847/847969.png')`, [nome, email, senha], (err) => { if (err) return res.send('<script>alert("Email já existe!"); window.location.href="/cadastro";</script>'); res.send('<script>alert("Sucesso!"); window.location.href="/login";</script>'); }); });
app.get('/api/usuario-atual', (req, res) => { if (req.session.usuarioLogado) { db.get("SELECT * FROM usuarios WHERE id = ?", [req.session.usuarioLogado.id], (err, u) => { req.session.usuarioLogado = u; res.json({ logado: true, ...u }); }); } else res.json({ logado: false }); });
app.post('/api/editar-perfil', upload.single('nova_foto'), (req, res) => { if (!req.session.usuarioLogado) return res.redirect('/login'); const { nome, email, endereco, cidade, estado } = req.body; let caminhoFoto = req.session.usuarioLogado.foto; if (req.file) caminhoFoto = '/uploads/' + req.file.filename; db.run(`UPDATE usuarios SET nome=?, email=?, endereco=?, cidade=?, estado=?, foto=? WHERE id=?`, [nome, email, endereco, cidade, estado, caminhoFoto, req.session.usuarioLogado.id], (err) => { req.session.usuarioLogado.nome=nome; req.session.usuarioLogado.email=email; req.session.usuarioLogado.foto=caminhoFoto; res.send('<script>alert("Perfil atualizado!"); window.location.href="/perfil";</script>'); }); });

app.post('/api/virar-parceiro', (req, res) => {
    if(!req.session.usuarioLogado) return res.json({ erro: 'Logue primeiro' });
    const dt = new Date(); dt.setDate(dt.getDate()+30);
    db.run(`UPDATE usuarios SET tipo='parceiro', data_fim_assinatura=?, cancelamento_agendado=0 WHERE id=?`, [dt.toISOString(), req.session.usuarioLogado.id], (err) => {
        req.session.usuarioLogado.tipo = 'parceiro';
        req.session.save(() => res.json({ sucesso: true }));
    });
});
app.post('/api/cancelar-parceiro', (req, res) => { if(!req.session.usuarioLogado) return res.json({ erro: "Erro" }); const id = req.session.usuarioLogado.id; db.run("UPDATE locais SET id_dono = NULL WHERE id_dono = ?", [id], () => { db.run("UPDATE usuarios SET tipo = 'turista' WHERE id = ?", [id], () => { req.session.usuarioLogado.tipo = 'turista'; req.session.save(()=>res.json({ sucesso: true })); }); }); });

app.post('/api/locais/salvar', upload.single('foto_local'), (req, res) => {
    if(!req.session.usuarioLogado) return res.json({ erro: "Logue" });
    const { id, nome, categoria, descricao, endereco_texto, numero, lat, lon, data_formatada, horario } = req.body;
    const user = req.session.usuarioLogado;
    let imgPath = null; if(req.file) imgPath = '/uploads/' + req.file.filename;

    let status = user.tipo === 'produtor' ? 'aprovado' : 'pendente';
    let idDono = user.tipo === 'parceiro' ? user.id : null;
    let idOrg = user.tipo === 'produtor' ? user.id : null;
    const dataFinal = data_formatada || "A definir"; const horaFinal = horario || "Livre"; const numFinal = numero || "S/N";

    if (id) { 
        db.get("SELECT * FROM locais WHERE id=?", [id], (err, l) => {
            if(!l) return res.json({erro: "Não achou"});
            let finalImg = imgPath || l.imagem;
            if (user.tipo === 'produtor') { status = 'aprovado'; idOrg = user.id; idDono = l.id_dono; } else { status = l.status; idDono = user.id; }
            db.run(`UPDATE locais SET nome=?, categoria=?, descricao=?, endereco=?, numero=?, imagem=?, data_evento=?, horario=?, lat=?, lon=?, status=?, id_organizador=? WHERE id=?`, 
                [nome, categoria, descricao, endereco_texto, numFinal, finalImg, dataFinal, horaFinal, lat, lon, status, idOrg, id], () => res.json({ sucesso: true }));
        });
    } else { 
        let finalImg = imgPath || "https://via.placeholder.com/600";
        db.run(`INSERT INTO locais (nome, categoria, descricao, endereco, numero, imagem, data_evento, horario, id_dono, id_organizador, lat, lon, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                [nome, categoria, descricao, endereco_texto, numFinal, finalImg, dataFinal, horaFinal, idDono, idOrg, lat, lon, status], () => res.json({ sucesso: true }));
    }
});

app.get('/api/parceiro/dados', (req, res) => {
    if(!req.session.usuarioLogado || req.session.usuarioLogado.tipo !== 'parceiro') return res.json({ erro: "Acesso" });
    db.get("SELECT * FROM locais WHERE id_dono = ?", [req.session.usuarioLogado.id], (err, local) => {
        if(!local) return res.json({ local: null });
        const sqlStats = `SELECT (SELECT count(*) FROM avaliacoes WHERE id_local=?) as total_reviews, (SELECT avg(nota) FROM avaliacoes WHERE id_local=?) as nota_media, (SELECT count(*) FROM favoritos WHERE id_local=?) as total_favoritos, (SELECT count(*) FROM roteiro_itens WHERE id_local=?) as total_roteiros`;
        db.get(sqlStats, [local.id,local.id,local.id,local.id], (err, stats) => {
            db.all("SELECT nota, count(*) as qtd FROM avaliacoes WHERE id_local=? GROUP BY nota", [local.id], (e, dist) => {
                db.all(`SELECT a.*, u.nome as nome_user, u.foto as foto_user FROM avaliacoes a JOIN usuarios u ON a.id_usuario=u.id WHERE a.id_local=? ORDER BY a.data_avaliacao DESC`, [local.id], (e,revs)=>{
                    res.json({ local, status: local.status, stats, dist, reviews: revs });
                });
            });
        });
    });
});

app.post('/api/parceiro/editar-local', upload.single('foto_local'), (req, res) => { if(!req.session.usuarioLogado) return res.json({ erro: "Logue" }); const { id, descricao, endereco, numero } = req.body; db.get("SELECT * FROM locais WHERE id=? AND id_dono=?", [id, req.session.usuarioLogado.id], (e,l)=>{ if(!l) return res.json({erro:"."}); let img=l.imagem; if(req.file) img='/uploads/'+req.file.filename; db.run("UPDATE locais SET descricao=?, endereco=?, numero=?, imagem=? WHERE id=?", [descricao,endereco,numero,img,id], ()=>res.json({sucesso:true})); }); });
app.post('/api/parceiro/responder', (req, res) => { if(!req.session.usuarioLogado) return res.json({ erro: "Logue" }); db.run(`UPDATE avaliacoes SET resposta=? WHERE id=?`, [req.body.resposta, req.body.id_avaliacao], ()=>res.json({sucesso:true})); });
app.get('/api/produtor/pendentes', (req, res) => { if(!req.session.usuarioLogado || req.session.usuarioLogado.tipo !== 'produtor') return res.json([]); db.all("SELECT * FROM locais WHERE status = 'pendente'", [], (err, rows) => res.json(rows)); });
app.get('/api/meus-eventos', (req, res) => { if(!req.session.usuarioLogado) return res.json([]); db.all("SELECT * FROM locais WHERE id_organizador = ? AND status = 'aprovado'", [req.session.usuarioLogado.id], (err, rows) => res.json(rows)); });
app.get('/api/eventos/:id', (req, res) => { if(!req.session.usuarioLogado) return res.json({ erro: 'Erro' }); db.get("SELECT * FROM locais WHERE id = ?", [req.params.id], (err, row) => { res.json(row); }); });
app.post('/api/eventos/criar-ou-aprovar', upload.single('foto_local'), (req, res) => { res.redirect(307, '/api/locais/salvar'); });
app.post('/api/produtor/rejeitar', (req, res) => { if(!req.session.usuarioLogado) return res.json({ erro: "Acesso" }); db.run("DELETE FROM locais WHERE id = ?", [req.body.id], () => res.json({ sucesso: true })); });
app.post('/api/eventos/excluir', (req, res) => { if(!req.session.usuarioLogado) return res.json({ erro: 'Erro' }); db.run("DELETE FROM locais WHERE id = ?", [req.body.id], () => { res.json({ sucesso: true }); }); });

// --- ADMIN ---
app.get('/api/admin/pontos', (req, res) => { db.all("SELECT * FROM locais WHERE tipo_local='ponto' AND status='aprovado'", [], (e,r)=>res.json(r)); });
app.post('/api/admin/salvar-ponto', upload.single('foto_ponto'), (req, res) => { let img=null; if(req.file)img='/uploads/'+req.file.filename; if(req.body.id){ if(!img)db.run("UPDATE locais SET nome=?, categoria=?, descricao=?, endereco=?, lat=?, lon=? WHERE id=?", [req.body.nome, req.body.categoria, req.body.descricao, req.body.endereco_texto, req.body.lat, req.body.lon, req.body.id], ()=>res.json({sucesso:true})); else db.run("UPDATE locais SET nome=?, categoria=?, descricao=?, endereco=?, imagem=?, lat=?, lon=? WHERE id=?", [req.body.nome, req.body.categoria, req.body.descricao, req.body.endereco_texto, img, req.body.lat, req.body.lon, req.body.id], ()=>res.json({sucesso:true})); } else { db.run("INSERT INTO locais (nome, categoria, descricao, endereco, imagem, tipo_local, lat, lon, status) VALUES (?, ?, ?, ?, ?, 'ponto', ?, ?, 'aprovado')", [req.body.nome, req.body.categoria, req.body.descricao, req.body.endereco_texto, img||"http://via.placeholder.com/600", req.body.lat, req.body.lon], ()=>res.json({sucesso:true})); } });
app.post('/api/admin/excluir', (req, res) => { db.run("DELETE FROM locais WHERE id=?",[req.body.id],()=>res.json({sucesso:true})); });

// --- GESTÃO DE EQUIPE ---
app.get('/api/produtor/equipe/listar', (req, res) => {
    if(!req.session.usuarioLogado || req.session.usuarioLogado.tipo !== 'produtor') return res.json([]);
    db.all("SELECT id, nome, email FROM usuarios WHERE tipo = 'produtor'", [], (err, rows) => res.json(rows));
});
app.post('/api/produtor/equipe/criar', (req, res) => {
    if(!req.session.usuarioLogado || req.session.usuarioLogado.tipo !== 'produtor') return res.json({ erro: "Acesso" });
    const { nome, email, senha } = req.body;
    const foto = "https://cdn-icons-png.flaticon.com/512/4086/4086679.png";
    const dt = new Date(); dt.setFullYear(dt.getFullYear() + 5);
    db.run(`INSERT INTO usuarios (nome, email, senha, tipo, foto, data_fim_assinatura) VALUES (?, ?, ?, 'produtor', ?, ?)`,
        [nome, email, senha, foto, dt.toISOString()],
        (err) => { if(err) return res.json({ erro: "Erro." }); res.json({ sucesso: true }); }
    );
});
app.post('/api/produtor/equipe/excluir', (req, res) => {
    if(!req.session.usuarioLogado || req.session.usuarioLogado.tipo !== 'produtor') return res.json({ erro: "Acesso" });
    if(req.body.id == req.session.usuarioLogado.id) return res.json({ erro: "Erro." });
    db.run("DELETE FROM usuarios WHERE id = ? AND tipo = 'produtor'", [req.body.id], () => res.json({ sucesso: true }));
});

// 🔥 API DO ANALISTA (NOVA) 🔥
app.get('/api/analista/dashboard', (req, res) => {
    if(!req.session.usuarioLogado || req.session.usuarioLogado.tipo !== 'analista') return res.json({ erro: "Acesso negado" });
    
    const dados = {};
    
    // 1. Top 5 Favoritos
    db.all("SELECT l.nome, count(f.id) as qtd FROM locais l JOIN favoritos f ON l.id=f.id_local GROUP BY l.id ORDER BY qtd DESC LIMIT 5", [], (e, favs) => {
        dados.favoritos = favs;
        
        // 2. Top 5 Melhores Avaliados (Média)
        db.all("SELECT l.nome, AVG(a.nota) as media FROM locais l JOIN avaliacoes a ON l.id=a.id_local GROUP BY l.id ORDER BY media DESC LIMIT 5", [], (e, avs) => {
            dados.avaliados = avs;
            
            // 3. Totais Gerais
            db.get("SELECT (SELECT count(*) FROM usuarios) as users, (SELECT count(*) FROM locais) as locais, (SELECT count(*) FROM avaliacoes) as reviews", [], (e, totais) => {
                dados.totais = totais;
                res.json(dados);
            });
        });
    });
});

app.get('/api/meu-painel-dados', (req, res) => {
    if (!req.session.usuarioLogado) return res.json({ erro: 'Não logado' });
    db.get("SELECT * FROM usuarios WHERE id = ?", [req.session.usuarioLogado.id], (err, user) => {
        req.session.usuarioLogado = user;
        const idUser = user.id;
        const dados = { usuario: user, favoritos: [], roteiros: [], avaliacoes: [], meus_comentarios: [] };
        if(user.tipo === 'parceiro') return res.json(dados);
        db.all("SELECT f.*, l.nome as nome_local, l.categoria, l.imagem, l.id as id_local FROM favoritos f LEFT JOIN locais l ON f.id_local = l.id WHERE f.id_usuario = ?", [idUser], (err, favs) => {
            if(favs) dados.favoritos = favs.filter(f => f.nome_local);
            db.all("SELECT * FROM roteiros WHERE id_usuario = ?", [idUser], (err, rots) => {
                if(rots) dados.roteiros = rots;
                db.all(`SELECT a.*, l.nome as nome_local, l.imagem FROM avaliacoes a JOIN locais l ON a.id_local = l.id WHERE a.id_usuario = ? ORDER BY a.data_avaliacao DESC`, [idUser], (err, coments) => {
                    if(coments) dados.meus_comentarios = coments;
                    res.json(dados);
                });
            });
        });
    });
});

// 1. Gestão de Gestores (Equipe)
app.get('/api/admin/gestores', (req, res) => {
    if(!req.session.usuarioLogado || req.session.usuarioLogado.tipo !== 'admin') return res.json([]);
    db.all("SELECT id, nome, email FROM usuarios WHERE tipo='admin'", [], (e,r)=>res.json(r));
});
app.post('/api/admin/criar-gestor', (req, res) => {
    if(!req.session.usuarioLogado || req.session.usuarioLogado.tipo !== 'admin') return res.json({erro:"Acesso negado"});
    db.run(`INSERT INTO usuarios (nome, email, senha, tipo, foto) VALUES (?, ?, ?, 'admin', 'https://cdn-icons-png.flaticon.com/512/2206/2206368.png')`, 
    [req.body.nome, req.body.email, req.body.senha], (err) => {
        if(err) return res.json({erro: "Email já cadastrado."});
        res.json({sucesso:true});
    });
});
app.post('/api/admin/excluir-gestor', (req, res) => {
    if(!req.session.usuarioLogado || req.session.usuarioLogado.tipo !== 'admin') return res.json({erro:"Acesso negado"});
    if(req.body.email === 'admin@mundoria.com') return res.json({erro: "Não pode excluir o Admin Principal."});
    db.run("DELETE FROM usuarios WHERE id=?", [req.body.id], ()=>res.json({sucesso:true}));
});

// 2. Gestão de Usuários Gerais (Pesquisar e Excluir)
app.post('/api/admin/usuarios/buscar', (req, res) => {
    if(!req.session.usuarioLogado || req.session.usuarioLogado.tipo !== 'admin') return res.json([]);
    const termo = `%${req.body.termo}%`;
    db.all("SELECT id, nome, email, tipo FROM usuarios WHERE (nome LIKE ? OR email LIKE ?) AND tipo != 'admin'", [termo, termo], (err, rows) => {
        res.json(rows);
    });
});
app.post('/api/admin/usuarios/excluir', (req, res) => {
    if(!req.session.usuarioLogado || req.session.usuarioLogado.tipo !== 'admin') return res.json({erro:"Acesso negado"});
    const id = req.body.id;
    // Remove em cascata para não dar erro de banco
    db.run("DELETE FROM locais WHERE id_dono = ? OR id_organizador = ?", [id, id], () => {
        db.run("DELETE FROM avaliacoes WHERE id_usuario = ?", [id], () => {
            db.run("DELETE FROM favoritos WHERE id_usuario = ?", [id], () => {
                db.run("DELETE FROM roteiros WHERE id_usuario = ?", [id], () => {
                     db.run("DELETE FROM usuarios WHERE id = ?", [id], () => res.json({sucesso:true}));
                });
            });
        });
    });
});

app.post('/api/roteiros/criar', (req, res) => { db.run("INSERT INTO roteiros (id_usuario, nome_roteiro, descricao) VALUES (?,?,?)", [req.session.usuarioLogado.id, req.body.nome, req.body.descricao], ()=>res.json({sucesso:true})); });
app.post('/api/roteiros/excluir', (req, res) => { db.run("DELETE FROM roteiros WHERE id=?",[req.body.id_roteiro],()=>{ db.run("DELETE FROM roteiro_itens WHERE id_roteiro=?",[req.body.id_roteiro]); res.json({sucesso:true}); }); });
app.get('/api/roteiros/:id', (req, res) => { db.get("SELECT * FROM roteiros WHERE id=?",[req.params.id],(e,r)=>{ const sql="SELECT ri.id as id_item, ri.data_visita, l.id as id_local_real, l.nome, l.categoria, l.imagem, l.endereco FROM roteiro_itens ri JOIN locais l ON ri.id_local=l.id WHERE ri.id_roteiro=? ORDER BY ri.data_visita ASC"; db.all(sql,[req.params.id],(e,i)=>{ res.json({roteiro:r, itens:i}); }); }); });
app.post('/api/roteiros/adicionar-item', (req, res) => { db.run("INSERT INTO roteiro_itens (id_roteiro, id_local) VALUES (?,?)", [req.body.id_roteiro, req.body.id_local], ()=>res.json({sucesso:true})); });
app.post('/api/roteiros/item/remover', (req, res) => { db.run("DELETE FROM roteiro_itens WHERE id=?",[req.body.id_item],()=>res.json({sucesso:true})); });
app.post('/api/roteiros/item/data', (req, res) => { db.run("UPDATE roteiro_itens SET data_visita=? WHERE id=?",[req.body.data, req.body.id_item],()=>res.json({sucesso:true})); });
app.post('/api/roteiros/capa', upload.single('foto_capa'), (req, res) => { let c='/uploads/'+req.file.filename; db.run("UPDATE roteiros SET foto_capa=? WHERE id=?",[c,req.body.id_roteiro],()=>{ res.send('<script>alert("Capa atualizada!"); window.location.href="/painel";</script>'); }); });
app.get('/api/meus-roteiros-simples', (req, res) => { if(!req.session.usuarioLogado)return res.json([]); db.all("SELECT id, nome_roteiro FROM roteiros WHERE id_usuario=?",[req.session.usuarioLogado.id],(e,r)=>res.json(r)); });
app.get('/api/pontos-disponiveis', (req, res) => { db.all("SELECT id, nome FROM locais WHERE status='aprovado'", [], (e,r)=>res.json(r)); });
app.get('/api/locais', (req, res) => { db.all("SELECT * FROM locais WHERE status='aprovado'", [], (e,r)=>res.json(r)); });
app.get('/api/locais/:id', (req, res) => { const idLocal = req.params.id; const idUser = req.session.usuarioLogado ? req.session.usuarioLogado.id : null; db.get("SELECT * FROM locais WHERE id=?",[idLocal],(e,l)=>{ if(!l)return res.json({}); db.all("SELECT a.*, u.nome as nome_usuario, u.foto as foto_usuario FROM avaliacoes a JOIN usuarios u ON a.id_usuario=u.id WHERE id_local=? ORDER BY id DESC",[idLocal],(e,a)=>{ db.get("SELECT * FROM favoritos WHERE id_usuario=? AND id_local=?",[req.session.usuarioLogado?.id,idLocal],(e,f)=>{ res.json({local:l, avaliacoes:a, isFavorito:!!f}); }); }); }); });
app.post('/api/avaliar', (req, res) => { if(!req.session.usuarioLogado) return res.json({ erro: "Logue." }); db.get("SELECT id FROM avaliacoes WHERE id_usuario=? AND id_local=?",[req.session.usuarioLogado.id, req.body.id_local],(e,r)=>{ if(r) return res.json({ erro: "Já avaliou." }); db.run(`INSERT INTO avaliacoes (id_usuario, id_local, nota, comentario) VALUES (?,?,?,?)`, [req.session.usuarioLogado.id, req.body.id_local, req.body.nota, req.body.comentario], ()=>res.json({sucesso:true})); }); });
app.post('/api/favoritar', (req, res) => { if(!req.session.usuarioLogado) return res.json({ erro: "Logue." }); const uid=req.session.usuarioLogado.id; const lid=req.body.id_local; db.get("SELECT * FROM favoritos WHERE id_usuario=? AND id_local=?",[uid,lid],(e,r)=>{ if(!r)db.run("INSERT INTO favoritos (id_usuario,id_local) VALUES (?,?)",[uid,lid],()=>res.json({sucesso:true,estado:'adicionado'})); else db.run("DELETE FROM favoritos WHERE id_usuario=? AND id_local=?",[uid,lid],()=>res.json({sucesso:true,estado:'removido'})); }); });
app.post('/api/produtor/rejeitar', (req, res) => { if(!req.session.usuarioLogado) return res.json({ erro: "Acesso" }); db.run("DELETE FROM locais WHERE id = ?", [req.body.id], () => res.json({ sucesso: true })); });
app.get('/api/admin/pontos', (req, res) => { db.all("SELECT * FROM locais WHERE tipo_local='ponto' AND status='aprovado'", [], (e,r)=>res.json(r)); });
app.post('/api/admin/excluir', (req, res) => { db.run("DELETE FROM locais WHERE id=?",[req.body.id],()=>res.json({sucesso:true})); });

app.listen(3000, () => console.log('Servidor Mundoria rodando em http://localhost:3000'));