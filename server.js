const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');

const DATA_FILE = path.join(__dirname,'data','players.json');
function loadData(){ try{ const t = fs.readFileSync(DATA_FILE,'utf8'); return JSON.parse(t||'{}'); }catch(e){ return {}; } }
function saveData(d){ fs.mkdirSync(path.join(__dirname,'data'),{recursive:true}); fs.writeFileSync(DATA_FILE, JSON.stringify(d,null,2)); }

let players = loadData();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));

// CORS for testing
app.use((req,res,next)=>{ res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Admin-Token, X-Player-Token'); next(); });

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'CHANGE_ME_ADMIN_TOKEN';

function genToken(){ return crypto.randomBytes(16).toString('hex'); }

app.get('/api/players', (req,res)=>{
  const arr = Object.values(players).map(p=>{
    // don't leak playerToken in list
    const copy = Object.assign({}, p);
    delete copy.playerToken;
    return copy;
  });
  res.json(arr);
});

app.get('/api/player/:name', (req,res)=>{
  const name = req.params.name;
  const p = players[name] || null;
  if(!p) return res.status(404).json({error:'not found'});
  // Only return token if requester is admin or provides correct player token
  const providedToken = req.headers['x-player-token'];
  const isAdmin = req.headers['x-admin-token'] && req.headers['x-admin-token'] === ADMIN_TOKEN;
  const copy = Object.assign({}, p);
  if(!isAdmin && providedToken !== p.playerToken){ delete copy.playerToken; }
  res.json(copy);
});

// POST /api/player: create or update player. Requires X-Player-Token to update existing player.
app.post('/api/player', (req,res)=>{
  const p = req.body;
  if(!p || !p.playerName) return res.status(400).json({error:'bad'});
  const name = p.playerName;
  const existing = players[name];

  const providedAdmin = req.headers['x-admin-token'] && req.headers['x-admin-token'] === ADMIN_TOKEN;
  const providedPlayerToken = req.headers['x-player-token'];

  // If existing and has playerToken, require providedPlayerToken to match for overwrite
  if(existing && existing.playerToken){
    if(providedPlayerToken !== existing.playerToken && !providedAdmin){
      return res.status(403).json({ok:false, error:'must provide player token to update existing player'});
    }
  }

  // If existing is NPC and not admin, preserve NPC and disallow full overwrite
  if(existing && existing.isNPC && !providedAdmin){
    // Protect NPCs from being overwritten by normal clients
    // Allow updating limited fields (gold) if provided
    existing.gold = p.gold !== undefined ? p.gold : existing.gold;
    existing.lastModified = Date.now();
    players[name] = existing;
    saveData(players);
    io.emit('player_update', {name});
    return res.json({ok:true, player: existing, note:'existing NPC preserved (admin required for full overwrite)'});
  }

  // For non-admin, ensure isNPC is false and generate token on create
  if(!providedAdmin){
    p.isNPC = false;
  } else {
    p.isNPC = !!p.isNPC;
  }

  // If creating new player, generate token; if updating and not provided token already matched, keep existing token
  if(!existing){
    p.playerToken = genToken();
  } else {
    // keep existing token if exists; otherwise generate one
    p.playerToken = existing.playerToken || genToken();
  }

  // sanitize some fields
  p.level = p.level || 1;
  p.gold = p.gold || 0;

  players[name] = p;
  saveData(players);
  io.emit('player_update', {name});

  // Return player info but include token so client can store it after creation
  const out = Object.assign({}, p);
  // include token in response only if admin or the recipient just created/updated and provided correct token
  // here we include token for creators/holders (client already matched) or admin
  if(!providedAdmin && providedPlayerToken !== p.playerToken){
    // If this is a creation, client doesn't have token yet; return token so client can store it
    if(!existing){ out.playerToken = p.playerToken; }
    else { delete out.playerToken; }
  }
  // admin always gets token
  if(providedAdmin) out.playerToken = p.playerToken;

  return res.json({ok:true, player: out});
});

// pvp endpoint: require attacker token
app.post('/api/pvp/rob', (req,res)=>{
  const {attacker, target} = req.body;
  if(!attacker || !target) return res.status(400).json({error:'missing'});
  const A = players[attacker];
  const T = players[target];
  if(!A || !T) return res.status(404).json({error:'player not found'});

  // validate attacker token
  const providedToken = req.headers['x-player-token'];
  if(!providedToken || providedToken !== A.playerToken) return res.status(403).json({ok:false, error:'invalid attacker token'});

  const now = Date.now();
  // check protection
  if(T.protectedUntil && T.protectedUntil > now) return res.json({ok:false, reason:'target protected'});
  // daily limit per attacker
  if(!A.todayPVPCount) A.todayPVPCount = 0;
  if(A.todayPVPCount >= 50){
    return res.json({ok:false,reason:'limit reached'});
  }
  // steal percent 10~25
  const pct = (Math.floor(Math.random()*16)+10)/100;
  const amount = Math.floor((T.gold||0) * pct);
  if(amount <= 0){ return res.json({ok:false,reason:'no gold'}); }
  T.gold = Math.max(0, (T.gold||0) - amount);
  A.gold = (A.gold||0) + amount;
  // mark protection on target for 2 hours
  T.protectedUntil = now + 2*60*60*1000;
  A.todayPVPCount = (A.todayPVPCount||0)+1;
  // save
  saveData(players);
  const message = `${attacker} 从 ${target} 处掠夺了 ${amount} 金币`;
  io.emit('pvp', {message, attacker, target, amount});
  res.json({ok:true, message, amount, attacker:A, target:T});
});

// socket connections
io.on('connection', (socket)=>{
  console.log('ws conn');
  socket.emit('welcome', {time:Date.now()});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>{ console.log('Server listening', PORT); });
