const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
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
app.use((req,res,next)=>{ res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Headers','Content-Type'); next(); });

app.get('/api/players', (req,res)=>{
  const arr = Object.values(players);
  res.json(arr);
});

app.get('/api/player/:name', (req,res)=>{
  const name = req.params.name;
  const p = players[name] || null;
  if(!p) return res.status(404).json({error:'not found'});
  res.json(p);
});

app.post('/api/player', (req,res)=>{
  const p = req.body;
  if(!p || !p.playerName) return res.status(400).json({error:'bad'});
  players[p.playerName] = p;
  saveData(players);
  io.emit('player_update', {name:p.playerName});
  res.json({ok:true, player:p});
});

// pvp endpoint: simplified server-side rob logic
app.post('/api/pvp/rob', (req,res)=>{
  const {attacker, target} = req.body;
  if(!attacker || !target) return res.status(400).json({error:'missing'});
  const A = players[attacker];
  const T = players[target];
  if(!A || !T) return res.status(404).json({error:'player not found'});
  const now = Date.now();
  // check protection
  if(T.protectedUntil && T.protectedUntil > now) return res.json({ok:false, reason:'target protected'});
  // daily limit per attacker
  if(!A.todayPVPCount) A.todayPVPCount = 0;
  if(A.todayPVPCount >= 50){ // server-wide safety cap (front-end limits 3)
    return res.json({ok:false,reason:'limit reached'});
  }
  // steal percent 10~25
  const pct = (Math.floor(Math.random()*16)+10)/100;
  const amount = Math.floor(T.gold * pct);
  if(amount <= 0){ return res.json({ok:false,reason:'no gold'}); }
  T.gold = Math.max(0, T.gold - amount);
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
