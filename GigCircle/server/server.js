import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { Server as SocketServer } from 'socket.io';

const PORT = 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'gigcircle-hackathon-secret';

// Always create the SQLite directory before opening the database.
// This is intentionally cross-platform so Windows/macOS/Linux demos behave the same.
const dataDir = path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'gigcircle.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'client', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS creators (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, avatar TEXT, skills TEXT NOT NULL, rate REAL, rating REAL, trust INTEGER, delivery REAL, available TEXT, rising INTEGER DEFAULT 0, projects INTEGER DEFAULT 0, bio TEXT, response_time TEXT);
CREATE TABLE IF NOT EXISTS gigs (id TEXT PRIMARY KEY, title TEXT, category TEXT, rate REAL, skills TEXT, creator_id TEXT, delivery REAL, description TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, description TEXT, budget REAL, deadline REAL, required_skills TEXT, project_dna TEXT, status TEXT, client_id TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, project_id TEXT, client_id TEXT, creator_id TEXT, requirements TEXT, budget REAL, deadline REAL, status TEXT, replacement_for TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, booking_id TEXT, rating REAL, would_rebook INTEGER, created_at TEXT);
CREATE TABLE IF NOT EXISTS collaborations (id TEXT PRIMARY KEY, creator_a TEXT, creator_b TEXT, projects_together INTEGER DEFAULT 0, avg_rating REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS milestones (id TEXT PRIMARY KEY, project_id TEXT, title TEXT, amount REAL, status TEXT, position INTEGER);
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT, title TEXT, body TEXT, read INTEGER DEFAULT 0, created_at TEXT);
`);

const seedCreators = [
 ['rahul','Rahul Singh','Student Developer','RS',['React','Node.js','Web Development','UI'],700,4.8,91,2.1,'now',0,18,'Full-stack builder focused on fast, polished web products.','< 1 hr'],
 ['priya','Priya Sharma','Brand & UI Designer','PS',['Figma','Graphic Design','Branding','Social Media'],500,4.9,96,1.8,'now',0,24,'Brand and product designer who turns rough ideas into clear visual systems.','< 2 hrs'],
 ['aman','Aman Verma','Video Creator','AV',['Video Editing','Motion','Content Creation'],400,4.7,88,2.8,'soon',0,12,'Video creator for launch reels, event promos and motion content.','< 3 hrs'],
 ['rohan','Rohan Mehta','Video + Social Creator','RM',['Video Editing','Social Media','Content Creation'],350,4.6,87,2.5,'now',1,3,'Rising creator specializing in short-form content and social campaigns.','< 1 hr'],
 ['neha','Neha Kapoor','Full-stack Creator','NK',['React','Node.js','MongoDB','UI'],650,4.5,90,2.4,'now',1,5,'Full-stack creator for prototypes, dashboards and launch-ready web apps.','< 1 hr'],
 ['karan','Karan Joshi','Content Strategist','KJ',['Copywriting','Social Media','Content Creation'],300,4.7,89,2.0,'now',1,4,'Content strategist for social copy, campaigns and creator briefs.','< 2 hrs']
];
const insCreator = db.prepare(`INSERT OR IGNORE INTO creators VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
for (const c of seedCreators) insCreator.run(c[0],c[1],c[2],c[3],JSON.stringify(c[4]),c[5],c[6],c[7],c[8],c[9],c[10],c[11],c[12],c[13]);
const seedGigs = [
 ['g1','React landing page','Development',700,JSON.stringify(['React','UI']),'rahul',2,'Responsive landing page for a student startup.'],
 ['g2','College fest branding kit','Design',500,JSON.stringify(['Figma','Branding']),'priya',2,'Logo, poster and social templates.'],
 ['g3','30 sec promo reel','Video',400,JSON.stringify(['Video Editing','Motion']),'aman',3,'Fast-paced promotional reel for events.']
];
const insGig=db.prepare(`INSERT OR IGNORE INTO gigs (id,title,category,rate,skills,creator_id,delivery,description,created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
for(const g of seedGigs) insGig.run(...g,new Date().toISOString());
const demoHash = bcrypt.hashSync('demo123', 10);
db.prepare('INSERT OR IGNORE INTO users VALUES (?,?,?,?,?,?)').run('demo-client','Demo Client','client@gigcircle.local',demoHash,'client',new Date().toISOString());
db.prepare('INSERT OR IGNORE INTO users VALUES (?,?,?,?,?,?)').run('demo-creator','Demo Creator','creator@gigcircle.local',demoHash,'creator',new Date().toISOString());

// Seed collaboration history so Team Chemistry is explainable in the demo.
const seedCollabs = [
  ['col_rahul_priya','rahul','priya',3,4.8],
  ['col_priya_aman','priya','aman',2,4.7],
  ['col_rahul_neha','rahul','neha',2,4.6],
  ['col_aman_rohan','aman','rohan',4,4.9],
  ['col_priya_karan','priya','karan',2,4.8]
];
const insCollab=db.prepare('INSERT OR IGNORE INTO collaborations VALUES (?,?,?,?,?)');
for(const c of seedCollabs) insCollab.run(...c);

function uid(prefix){return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`}
function parseCreator(r){return {...r,skills:JSON.parse(r.skills||'[]'),rising:Boolean(r.rising)}}
function parseProject(r){return {...r,requiredSkills:JSON.parse(r.required_skills||'[]'),projectDNA:JSON.parse(r.project_dna||'{}')}}
function allCreators(){return db.prepare('SELECT * FROM creators').all().map(parseCreator)}

const SKILL_RULES=[
 {skill:'Web Development',rx:/website|web|react|landing|app|node|frontend|backend|dashboard|portal/},
 {skill:'Graphic Design',rx:/design|brand|logo|ui|poster|figma|branding|visual/},
 {skill:'Video Editing',rx:/video|reel|promo|editing|motion|shorts/},
 {skill:'Social Media Content',rx:/instagram|social|content|campaign|copy|post|linkedin/},
 {skill:'Copywriting',rx:/copy|writing|script|caption|content/}
];
function extractSkills(text=''){const t=text.toLowerCase();return SKILL_RULES.filter(x=>x.rx.test(t)).map(x=>x.skill)}
function buildDNA(description,budget,deadline){
 const skills=extractSkills(description); const d=description.toLowerCase();
 const deliverables=[];
 if(/website|web|landing|app|dashboard|portal/.test(d)) deliverables.push('Web experience');
 if(/logo|brand|poster|design|figma/.test(d)) deliverables.push('Visual identity / design');
 if(/video|reel|promo|motion/.test(d)) deliverables.push('Video / motion content');
 if(/instagram|social|campaign|post|linkedin/.test(d)) deliverables.push('Social content');
 const complexity=skills.length>=4||/payment|auth|dashboard|ecommerce|e-commerce/.test(d)?'High':skills.length>=2?'Medium':'Low';
 const urgency=Number(deadline)<=2?'Critical':Number(deadline)<=5?'High':'Normal';
 const risks=[]; if(Number(deadline)<=3) risks.push('Compressed deadline'); if(skills.length>=4) risks.push('Cross-discipline coordination'); if(Number(budget)<Math.max(1200,skills.length*500)) risks.push('Budget pressure');
 const workload=skills.length>=4?'Multi-discipline':skills.length>=2?'Cross-functional':'Focused'; const scope=deliverables.length>=3?'Broad':deliverables.length===2?'Moderate':'Focused'; return {skills,deliverables:deliverables.length?deliverables:['Core project deliverable'],complexity,urgency,recommendedTeamSize:skills.length>=3?3:skills.length>=2?2:1,riskFactors:risks,workload,scope,budgetPressure:Number(budget)<Math.max(1200,skills.length*500)?'High':'Normal',summary:`A ${complexity.toLowerCase()}-complexity ${workload.toLowerCase()} project with ${urgency.toLowerCase()} delivery pressure and a ${scope.toLowerCase()} scope.`};
}
function skillOverlap(c,required){const aliases={'Web Development':['web development','react','node.js','ui'],'Graphic Design':['graphic design','figma','branding','ui'],'Video Editing':['video editing','motion','content creation'],'Social Media Content':['social media','content creation','copywriting'],'Copywriting':['copywriting','content creation']};return required.reduce((n,need)=>n+(c.skills.some(s=>(aliases[need]||[need]).some(a=>s.toLowerCase().includes(a)))?1:0),0)}
function chemistryFor(c,selected){if(!selected.length)return 70;let scores=selected.map(x=>db.prepare('SELECT avg_rating,projects_together FROM collaborations WHERE (creator_a=? AND creator_b=?) OR (creator_a=? AND creator_b=?)').get(c.id,x.id,c.id,x.id)).filter(Boolean);return scores.length?Math.round(scores.reduce((a,x)=>a+Math.min(100,(x.avg_rating/5)*80+x.projects_together*5),0)/scores.length):75}
function scoreCreator(c,required,budget,deadline,selected=[],mode='balanced'){const overlap=skillOverlap(c,required);const skill=required.length?Math.min(100,Math.round(35+(overlap/required.length)*65)):70;const budgetScore=Math.max(30,Math.min(100,Math.round(100-Math.max(0,c.rate-budget*.45)/Math.max(budget,1)*55)));const availability=c.available==='now'?100:72;const delivery=Math.max(40,Math.min(100,Math.round(100-Math.max(0,c.delivery-deadline)*14)));const rating=Math.round(c.rating/5*100);const chemistry=chemistryFor(c,selected);const weights={balanced:[.35,.15,.1,.1,.2,.1],cost:[.25,.35,.08,.08,.14,.1],speed:[.25,.1,.15,.08,.32,.1],quality:[.38,.08,.08,.2,.16,.1],chemistry:[.25,.08,.07,.15,.1,.35]}[mode]||[.35,.15,.1,.1,.2,.1];const score=Math.round(skill*weights[0]+budgetScore*weights[1]+availability*weights[2]+rating*weights[3]+delivery*weights[4]+chemistry*weights[5]);return {score,skill,budget:budgetScore,availability,delivery,rating,chemistry,mode}}
function enrich(c,required,budget,deadline,selected=[],mode='balanced'){return {...c,match:scoreCreator(c,required,budget,deadline,selected,mode)}}

const app=express(); const server=http.createServer(app); const io=new SocketServer(server,{cors:{origin:'*'}}); app.use(cors()); app.use(express.json());
function auth(req,res,next){const h=req.headers.authorization||''; if(!h.startsWith('Bearer ')) return res.status(401).json({error:'Authentication required'}); try{req.user=jwt.verify(h.slice(7),JWT_SECRET);next()}catch{return res.status(401).json({error:'Invalid or expired token'})}}
function optionalAuth(req,_res,next){const h=req.headers.authorization||'';if(h.startsWith('Bearer ')){try{req.user=jwt.verify(h.slice(7),JWT_SECRET)}catch{}}next()}
function notify(userId,title,body){if(!userId)return;const id=uid('nt');db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?,?)').run(id,userId,title,body,0,new Date().toISOString());io.to(`user:${userId}`).emit('notification',{id,title,body})}

app.get('/api/health',(_req,res)=>res.json({ok:true,service:'GigCircle API',version:'3.0',database:'SQLite',realtime:'Socket.IO'}));
app.post('/api/auth/register',async(req,res)=>{try{const {name,email,password,role='client'}=req.body;if(!name||!email||!password)return res.status(400).json({error:'Name, email and password are required'});if(!['client','creator'].includes(role))return res.status(400).json({error:'Invalid role'});const id=uid('usr');const hash=await bcrypt.hash(password,10);db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(id,name,email.toLowerCase(),hash,role,new Date().toISOString());const token=jwt.sign({id,name,email:email.toLowerCase(),role},JWT_SECRET,{expiresIn:'7d'});res.status(201).json({token,user:{id,name,email:email.toLowerCase(),role}})}catch(e){res.status(400).json({error:e.code==='SQLITE_CONSTRAINT_UNIQUE'?'Email already registered':'Registration failed'})}});
app.post('/api/auth/login',async(req,res)=>{const row=db.prepare('SELECT * FROM users WHERE email=?').get((req.body.email||'').toLowerCase());if(!row||!(await bcrypt.compare(req.body.password||'',row.password_hash)))return res.status(401).json({error:'Invalid email or password'});const token=jwt.sign({id:row.id,name:row.name,email:row.email,role:row.role},JWT_SECRET,{expiresIn:'7d'});res.json({token,user:{id:row.id,name:row.name,email:row.email,role:row.role}})});
app.get('/api/auth/me',auth,(req,res)=>res.json({user:req.user}));

app.get('/api/creators',(_req,res)=>res.json(allCreators()));
app.get('/api/creators/:id',(req,res)=>{const c=db.prepare('SELECT * FROM creators WHERE id=?').get(req.params.id);if(!c)return res.status(404).json({error:'Creator not found'});res.json(parseCreator(c))});
app.get('/api/gigs',(_req,res)=>res.json(db.prepare('SELECT * FROM gigs ORDER BY created_at DESC').all().map(g=>({...g,skills:JSON.parse(g.skills||'[]')}))));
app.post('/api/gigs',optionalAuth,(req,res)=>{const g={id:uid('gig'),createdAt:new Date().toISOString(),...req.body};db.prepare('INSERT INTO gigs VALUES (?,?,?,?,?,?,?,?,?)').run(g.id,g.title,g.category,Number(g.rate),JSON.stringify(g.skills||[]),g.creatorId,g.delivery||2,g.description,g.createdAt);res.status(201).json(g)});

app.post('/api/projects/match',optionalAuth,(req,res)=>{const {description='',budget=2000,deadline=5,optimization='balanced'}=req.body;const dna=buildDNA(description,budget,deadline);dna.optimization=optimization;const mode=optimization;const selected=[];const matches=allCreators().map(c=>enrich(c,dna.skills,Number(budget),Number(deadline),selected,mode)).sort((a,b)=>b.match.score-a.match.score);const recommended=[];for(const skill of dna.skills){const best=matches.find(c=>skillOverlap(c,[skill])>0&&!recommended.some(x=>x.id===c.id));if(best){recommended.push(best);selected.push(best)}}const id=uid('prj');db.prepare('INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?)').run(id,description,Number(budget),Number(deadline),JSON.stringify(dna.skills),JSON.stringify(dna),'Draft',req.user?.id||'demo-client',new Date().toISOString());for(let i=0;i<Math.min(3,recommended.length);i++){const amount=Math.round(Number(budget)*[.25,.45,.30][i]||0);db.prepare('INSERT INTO milestones VALUES (?,?,?,?,?,?)').run(uid('ms'),id,['Discovery & Design','Build & Integration','Testing & Launch'][i],amount,i===0?'Funded':'Locked',i)}res.json({project:{id,description,budget:Number(budget),deadline:Number(deadline),requiredSkills:dna.skills,status:'Draft',createdAt:new Date().toISOString(),projectDNA:dna},requiredSkills:dna.skills,matches,recommendedTeam:recommended.slice(0,3),projectDNA:dna})});
app.get('/api/projects',(_req,res)=>res.json(db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all().map(parseProject)));
app.get('/api/projects/:id',(req,res)=>{const p=db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);if(!p)return res.status(404).json({error:'Project not found'});res.json(parseProject(p))});

app.get('/api/bookings',(_req,res)=>{const rows=db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all();res.json(rows)});
app.post('/api/bookings',optionalAuth,(req,res)=>{const members=Array.isArray(req.body.members)?req.body.members:[req.body.creatorId].filter(Boolean);const created=members.map(creatorId=>{const id=uid('bk');const now=new Date().toISOString();db.prepare('INSERT INTO bookings VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id,req.body.projectId||null,req.user?.id||req.body.clientId||'demo-client',creatorId,req.body.requirements||'',Number(req.body.budget||0),req.body.deadline||null,'Pending',null,now,now);const creator=db.prepare('SELECT name FROM creators WHERE id=?').get(creatorId);notify(req.user?.id,'Team request created',`${creator?.name||creatorId} received your project request.`);io.emit('booking:update',{id,status:'Pending',creatorId});return {id,projectId:req.body.projectId||null,clientId:req.user?.id||req.body.clientId||'demo-client',creatorId,requirements:req.body.requirements||'',budget:Number(req.body.budget||0),deadline:req.body.deadline||null,status:'Pending',createdAt:now,updatedAt:now}});res.status(201).json({bookings:created})});
app.patch('/api/bookings/:id/status',(req,res)=>{const b=db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);if(!b)return res.status(404).json({error:'Booking not found'});if(!['Pending','Accepted','Declined','Completed'].includes(req.body.status))return res.status(400).json({error:'Invalid status'});const now=new Date().toISOString();db.prepare('UPDATE bookings SET status=?,updated_at=? WHERE id=?').run(req.body.status,now,b.id);io.emit('booking:update',{...b,status:req.body.status});notify(b.client_id,'Booking updated',`Your booking is now ${req.body.status}.`);res.json({...b,status:req.body.status,updatedAt:now})});
app.post('/api/bookings/:id/replace',(req,res)=>{const original=db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);if(!original)return res.status(404).json({error:'Booking not found'});const p=original.project_id?db.prepare('SELECT * FROM projects WHERE id=?').get(original.project_id):null;const required=p?JSON.parse(p.required_skills||'[]'):extractSkills(original.requirements);const used=db.prepare('SELECT creator_id FROM bookings WHERE project_id=?').all(original.project_id).map(x=>x.creator_id);const candidates=allCreators().filter(c=>c.id!==original.creator_id&&!used.includes(c.id)&&c.available==='now').map(c=>enrich(c,required,Number(original.budget||p?.budget||2000),Number(original.deadline||p?.deadline||5))).sort((a,b)=>b.match.score-a.match.score);const replacement=candidates[0];if(!replacement)return res.status(404).json({error:'No eligible replacement creator found'});const id=uid('bk'),now=new Date().toISOString();db.prepare('INSERT INTO bookings VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id,original.project_id,original.client_id,replacement.id,original.requirements,original.budget,original.deadline,'Pending',original.id,now,now);io.emit('booking:update',{id,status:'Pending',creatorId:replacement.id,replacementFor:original.id});notify(original.client_id,'GigCircle protected your project',`${replacement.name} was found as a backup creator.`);res.status(201).json({booking:{id,projectId:original.project_id,creatorId:replacement.id,status:'Pending'},replacement,reason:replacement.match})});

app.post('/api/projects/:id/stress-test',(req,res)=>{const p=db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);if(!p)return res.status(404).json({error:'Project not found'});const required=JSON.parse(p.required_skills||'[]');const memberIds=req.body?.memberIds||db.prepare('SELECT creator_id FROM bookings WHERE project_id=?').all(p.id).map(x=>x.creator_id);const members=allCreators().filter(c=>memberIds.includes(c.id));const unavailable=members.find(c=>c.id===req.body?.unavailableCreatorId)||members[0];const remaining=members.filter(c=>c.id!==unavailable?.id);const covered=required.filter(s=>remaining.some(c=>skillOverlap(c,[s])>0));const coverageAfter=required.length?Math.round(covered.length/required.length*100):100;const alternatives=allCreators().filter(c=>c.available==='now'&&!memberIds.includes(c.id)).map(c=>enrich(c,required,p.budget,p.deadline,members)).sort((a,b)=>b.match.score-a.match.score).slice(0,3);const best=alternatives[0];const scenarios=[{id:'creator-unavailable',label:'Creator unavailable',severity:coverageAfter<100?'High':'Low',detail:unavailable?`${unavailable.name} is removed from the team.`:'No active creator to simulate.',metric:`Skill coverage falls to ${coverageAfter}%`,recommendation:best?`Replace with ${best.name}.`:'No replacement available.'},{id:'deadline-shock',label:'Deadline compressed by 30%',severity:Number(p.deadline)<=3?'Critical':'High',detail:`Deadline changes from ${p.deadline}d to ${Math.max(1,Math.ceil(p.deadline*.7))}d.`,metric:`Slowest selected delivery: ${members.length?Math.max(...members.map(c=>c.delivery)):0}d`,recommendation:'Prioritize available-now creators.'},{id:'budget-shock',label:'Budget reduced by 20%',severity:'Medium',detail:`Working budget becomes ₹${Math.round(p.budget*.8)}.`,metric:`Current budget: ₹${p.budget}`,recommendation:'Protect scope and avoid unnecessary swaps.'}];res.json({projectId:p.id,overall:scenarios.some(s=>s.severity==='Critical')?'Critical':scenarios.some(s=>s.severity==='High')?'Needs attention':'Resilient',unavailableCreator:unavailable,coverageAfter,alternatives,scenarios})});

app.get('/api/projects/:id/milestones',(req,res)=>res.json(db.prepare('SELECT * FROM milestones WHERE project_id=? ORDER BY position').all(req.params.id)));
app.patch('/api/milestones/:id/status',(req,res)=>{const m=db.prepare('SELECT * FROM milestones WHERE id=?').get(req.params.id);if(!m)return res.status(404).json({error:'Milestone not found'});const status=['Locked','Funded','In Progress','Completed','Released'].includes(req.body.status)?req.body.status:null;if(!status)return res.status(400).json({error:'Invalid status'});db.prepare('UPDATE milestones SET status=? WHERE id=?').run(status,m.id);io.emit('milestone:update',{...m,status});res.json({...m,status})});
app.post('/api/bookings/:id/feedback',(req,res)=>{const b=db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);if(!b)return res.status(404).json({error:'Booking not found'});const rating=Math.max(1,Math.min(5,Number(req.body?.rating||5)));db.prepare('INSERT INTO feedback VALUES (?,?,?,?,?)').run(uid('fb'),b.id,rating,req.body?.wouldRebook?1:0,new Date().toISOString());const c=db.prepare('SELECT * FROM creators WHERE id=?').get(b.creator_id);if(c){const newRating=((c.rating+rating)/2).toFixed(2);db.prepare('UPDATE creators SET rating=?,trust=?,projects=? WHERE id=?').run(Number(newRating),Math.max(0,Math.min(100,c.trust+(rating>=4?1:-2))),c.projects+1,c.id)}db.prepare('UPDATE bookings SET status=?,updated_at=? WHERE id=?').run('Completed',new Date().toISOString(),b.id);io.emit('booking:update',{...b,status:'Completed'});res.status(201).json({ok:true})});

app.get('/api/notifications',optionalAuth,(req,res)=>{const user=req.user?.id||'demo-client';res.json(db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 20').all(user))});
app.post('/api/team/chemistry',(req,res)=>{
  const ids=[...new Set(Array.isArray(req.body?.creatorIds)?req.body.creatorIds:[])];
  if(ids.length<2) return res.json({score:75,history:[],explanation:'Add at least two creators to evaluate team chemistry.'});
  const history=[]; let total=0, pairs=0;
  for(let i=0;i<ids.length;i++) for(let j=i+1;j<ids.length;j++){
    const row=db.prepare('SELECT * FROM collaborations WHERE (creator_a=? AND creator_b=?) OR (creator_a=? AND creator_b=?)').get(ids[i],ids[j],ids[j],ids[i]);
    const a=db.prepare('SELECT name FROM creators WHERE id=?').get(ids[i]);
    const b=db.prepare('SELECT name FROM creators WHERE id=?').get(ids[j]);
    const score=row?Math.min(100,Math.round((row.avg_rating/5)*80+row.projects_together*5)):75;
    total+=score;pairs++;
    history.push({creatorA:a?.name||ids[i],creatorB:b?.name||ids[j],projectsTogether:row?.projects_together||0,avgRating:row?.avg_rating||0,score,known:Boolean(row)});
  }
  const score=Math.round(total/Math.max(1,pairs));
  const known=history.filter(x=>x.known).length;
  const explanation=known===history.length?'This team has a strong collaboration history.':'GigCircle combines proven collaboration history with a neutral compatibility baseline for new pairings.';
  res.json({score,history,knownPairs:known,totalPairs:pairs,explanation});
});

app.get('/api/dashboard/analytics',(_req,res)=>{const creators=db.prepare('SELECT COUNT(*) c FROM creators').get().c;const projects=db.prepare('SELECT COUNT(*) c FROM projects').get().c;const teams=db.prepare("SELECT COUNT(*) c FROM bookings WHERE status='Accepted'").get().c;const avg=db.prepare('SELECT AVG(rating) r FROM feedback').get().r;res.json({activeCreators:creators,projects,teamsFormed:teams,averageRating:Number((avg||4.7).toFixed(1)),database:'SQLite',realtime:'Socket.IO'})});
app.get('/api/dashboard/creator/:id',(req,res)=>{const c=db.prepare('SELECT * FROM creators WHERE id=?').get(req.params.id);if(!c)return res.status(404).json({error:'Creator not found'});res.json({creator:parseCreator(c),bookings:db.prepare('SELECT * FROM bookings WHERE creator_id=? ORDER BY created_at DESC').all(req.params.id)})});

io.on('connection',socket=>{socket.on('join',userId=>{if(userId)socket.join(`user:${userId}`)});socket.emit('connected',{ok:true})});
server.listen(PORT,()=>console.log(`GigCircle API v3 running on http://localhost:${PORT} | SQLite + Socket.IO`));
