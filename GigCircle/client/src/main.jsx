import React,{Component,useEffect,useMemo,useState} from 'react';
import {io} from 'socket.io-client';
import {createRoot} from 'react-dom/client';
import {Sparkles,Search,Plus,Users,Clock3,ShieldCheck,Leaf,ChevronRight,Check,AlertTriangle,Zap,SlidersHorizontal,LayoutDashboard,BriefcaseBusiness,RefreshCw,Activity,Target,IndianRupee,ArrowRight,X,Send,LoaderCircle} from 'lucide-react';
import './styles.css';

const API = `${import.meta.env.VITE_API_URL}/api`;
const presets={"College fest":"I need a website and promotional content for our college fest.","Startup launch":"We need a landing page, brand visuals and a short launch video for our startup.","Instagram campaign":"I need Instagram posts, copy and a promotional reel for a product launch."};

async function api(path,options={}){
  const token=localStorage.getItem('gigcircle_token');
  const r=await fetch(API+path,{
    headers:{
      'Content-Type':'application/json',
      ...(token?{Authorization:`Bearer ${token}`}:{ }),
      ...(options.headers||{})
    },
    ...options
  });
  if(!r.ok){
    const e=await r.json().catch(()=>({error:r.statusText}));
    throw new Error(e.error||'Request failed');
  }
  return r.json();
}

function normalizeBooking(b){
  return {
    ...b,
    id:b.id,
    projectId:b.projectId??b.project_id,
    clientId:b.clientId??b.client_id,
    creatorId:b.creatorId??b.creator_id,
    requirements:b.requirements||'',
    budget:Number(b.budget||0),
    deadline:b.deadline,
    status:b.status,
    createdAt:b.createdAt??b.created_at,
    updatedAt:b.updatedAt??b.updated_at
  };
}

function Auth({onAuth}){
  const [mode,setMode]=useState('login');
  const [name,setName]=useState('');
  const [error,setError]=useState('');
  const [email,setEmail]=useState('client@gigcircle.local');
  const [password,setPassword]=useState('demo123');
  const [role,setRole]=useState('client');
  const [busy,setBusy]=useState(false);

  const submit=async e=>{
    e.preventDefault();
    setBusy(true);
    setError('');
    try{
      const r=await api(`/auth/${mode==='login'?'login':'register'}`,{
        method:'POST',
        body:JSON.stringify({
          name:name||'GigCircle User',
          email,
          password,
          role
        })
      });
      localStorage.setItem('gigcircle_token',r.token);
      onAuth(r.user,r.token);
    }catch(e){
      setError(e.message);
    }finally{
      setBusy(false);
    }
  };

  return <main className="authPage">
    <section className="authCard">
      <div className="logo authLogo"><Sparkles size={18}/></div>
      <div className="eyebrow">GIGCIRCLE 3.0</div>
      <h1>{mode==='login'?'Welcome back.':'Create your account.'}</h1>
      <p>AI-powered team formation with live project operations.</p>
      {error&&<div className="authError">{error}</div>}
      <form onSubmit={submit}>
        {mode==='register'&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" required/>}
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" required/>
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" required/>
        {mode==='register'&&<div className="rolePick">
          <button type="button" className={role==='client'?'active':''} onClick={()=>setRole('client')}>Client</button>
          <button type="button" className={role==='creator'?'active':''} onClick={()=>setRole('creator')}>Creator</button>
        </div>}
        <button className="primary full" disabled={busy}>
          {busy?'Connecting...':mode==='login'?'Login':'Create account'} <ArrowRight size={17}/>
        </button>
      </form>
      <button className="demoBtn" onClick={()=>{
        setEmail(role==='client'?'client@gigcircle.local':'creator@gigcircle.local');
        setPassword('demo123');
      }}>Use demo {role}</button>
      <button className="linkBtn" onClick={()=>setMode(mode==='login'?'register':'login')}>
        {mode==='login'?'New here? Create an account':'Already have an account? Login'}
      </button>
    </section>
  </main>
}

function App(){
  const [role,setRole]=useState('client'),[page,setPage]=useState('home'),[problem,setProblem]=useState(''),[budget,setBudget]=useState(2000),[deadline,setDeadline]=useState(5),[skills,setSkills]=useState([]),[matches,setMatches]=useState([]),[project,setProject]=useState(null),[team,setTeam]=useState([]),[creators,setCreators]=useState([]),[bookings,setBookings]=useState([]),[query,setQuery]=useState(''),[tab,setTab]=useState('all'),[toast,setToast]=useState(''),[loading,setLoading]=useState(false),[stress,setStress]=useState(false),[teamFormed,setTeamFormed]=useState(false),[gigs,setGigs]=useState([]),[stressResult,setStressResult]=useState(null),[replacement,setReplacement]=useState(null),[milestones,setMilestones]=useState([]),[chemistry,setChemistry]=useState(null),[optimization,setOptimization]=useState('balanced'),[gigForm,setGigForm]=useState({title:'',category:'Development',rate:500,description:'',skills:''});

  const [user,setUser]=useState(()=>{
    try{
      return JSON.parse(localStorage.getItem('gigcircle_user')||'null')
    }catch{
      return null
    }
  });

  const detected=skills;
  const total=team.reduce((a,c)=>a+c.rate,0);

  const coverage=detected.length
    ?Math.min(100,Math.round(
      detected.filter(s=>team.some(c=>c.skills.some(x=>x.toLowerCase().includes(s.toLowerCase().split(' ')[0])))).length
      /detected.length*100
    ))
    :0;

  const notify=m=>{
    setToast(m);
    setTimeout(()=>setToast(''),2600);
  };

  const loadCreators=async()=>{
    try{
      setCreators(await api('/creators'))
    }catch(e){
      notify(e.message)
    }
  };

  const loadGigs=async()=>{
    try{
      setGigs(await api('/gigs'))
    }catch(e){
      notify(e.message)
    }
  };

  // PRODUCTION SOCKET.IO URL
  useEffect(()=>{
    loadCreators();
    loadGigs();
    loadBookings();

    const socket=io(import.meta.env.VITE_API_URL);

    if(user?.id)socket.emit('join',user.id);

    socket.on('booking:update',e=>{
      loadBookings();
      notify(e.status==='Accepted'
        ?'Booking accepted — updated live'
        :'Live booking update received'
      );
    });

    socket.on('notification',e=>notify(e.title));

    socket.on('connect_error',()=>{
      notify('Realtime connection unavailable — API still works.');
    });

    return()=>socket.close();
  },[user?.id]);

  const nav=p=>{
    setPage(p);
    if(p==='bookings')loadBookings();
    if(p==='marketplace'){
      loadCreators();
      loadGigs();
    }
    if(p==='creator')loadBookings();
  };

  const runMatch=async text=>{
    setProblem(text);
    setLoading(true);
    try{
      const data=await api('/projects/match',{
        method:'POST',
        body:JSON.stringify({
          description:text,
          budget,
          deadline,
          optimization
        })
      });

      setSkills(data.requiredSkills||[]);
      setMatches(data.matches||[]);
      setProject({
        ...data.project,
        projectDNA:data.projectDNA||{}
      });
      setTeam(data.recommendedTeam||[]);
      loadChemistry(data.recommendedTeam||[]);
      setMilestones(await api(`/projects/${data.project.id}/milestones`));
      setPage('problem');
    }catch(e){
      notify(e.message);
    }finally{
      setLoading(false);
    }
  };

  const loadBookings=async()=>{
    try{
      const rows=await api('/bookings');
      setBookings(rows.map(normalizeBooking));
    }catch(e){
      notify(e.message);
    }
  };

  const loadChemistry=async members=>{
    if(!members||members.length<2){
      setChemistry(null);
      return;
    }

    try{
      setChemistry(await api('/team/chemistry',{
        method:'POST',
        body:JSON.stringify({
          creatorIds:members.map(x=>x.id)
        })
      }));
    }catch(e){
      notify(e.message);
    }
  };

  const createBookings=async()=>{
    if(!team.length||!project)return;

    setLoading(true);

    try{
      await api('/bookings',{
        method:'POST',
        body:JSON.stringify({
          projectId:project.id,
          members:team.map(x=>x.id),
          requirements:problem,
          budget:total,
          deadline,
          clientId:user.id
        })
      });

      await loadBookings();
      setTeamFormed(true);
      setTimeout(()=>setTeamFormed(false),3200);
      notify('Team formed — booking requests sent 🎉');
    }catch(e){
      notify(e.message);
    }finally{
      setLoading(false);
    }
  };

  const updateBooking=async(id,status)=>{
    try{
      await api(`/bookings/${id}/status`,{
        method:'PATCH',
        body:JSON.stringify({status})
      });

      if(status==='Declined'){
        try{
          const r=await api(`/bookings/${id}/replace`,{
            method:'POST'
          });
          setReplacement(r);
          notify(`Declined — ${r.replacement.name} was auto-suggested as a replacement`);
        }catch(e){
          notify('Booking declined — no automatic replacement was available');
        }
      }else{
        notify(`Booking ${status.toLowerCase()}`);
      }

      await loadBookings();
    }catch(e){
      notify(e.message);
    }
  };

  const submitFeedback=async(id,rating,wouldRebook)=>{
    try{
      await api(`/bookings/${id}/feedback`,{
        method:'POST',
        body:JSON.stringify({
          rating:Number(rating),
          wouldRebook:Boolean(wouldRebook)
        })
      });

      await loadBookings();
      await loadCreators();
      notify('Feedback saved — trust signals updated');
    }catch(e){
      notify(e.message);
    }
  };

  const runStress=async()=>{
    if(!project){
      notify('Run the project matcher first');
      return;
    }

    setLoading(true);

    try{
      const data=await api(`/projects/${project.id}/stress-test`,{
        method:'POST',
        body:JSON.stringify({
          unavailableCreatorId:team[0]?.id,
          memberIds:team.map(x=>x.id)
        })
      });

      setStressResult(data);
      setStress(true);
    }catch(e){
      notify(e.message);
    }finally{
      setLoading(false);
    }
  };

  const toggleTeam=c=>setTeam(t=>{
    const next=t.some(x=>x.id===c.id)
      ?t.filter(x=>x.id!==c.id)
      :[...t,c];

    loadChemistry(next);
    return next;
  });

  if(!user)return <Auth onAuth={(u,token)=>{
    localStorage.setItem('gigcircle_user',JSON.stringify(u));
    localStorage.setItem('gigcircle_token',token);
    setUser(u);
    setRole(u.role);
    setPage(u.role==='creator'?'creator':'home');
  }}/>;


  return <div className="app">
    <header>
      <div className="brand" onClick={()=>nav('home')}>
        <div className="logo"><Sparkles size={18}/></div>
        <span>Gig<span>Circle</span></span>
      </div>

      <nav>
        {['home','marketplace','problem','team','bookings','postgig'].map(p=>
          <button
            className={page===p?'active':''}
            onClick={()=>nav(p)}
            key={p}
          >
            {p==='home'
              ?'Home'
              :p==='problem'
              ?'Find My Team'
              :p==='team'
              ?'Team Builder'
              :p==='postgig'
              ?'Post a Gig'
              :p[0].toUpperCase()+p.slice(1)}
          </button>
        )}
      </nav>

      <div className="role">
        <span>{user.name}</span>
        <button
          className={role==='client'?'sel':''}
          onClick={()=>setRole('client')}
        >Client</button>

        <button
          className={role==='creator'?'sel':''}
          onClick={()=>{
            setRole('creator');
            nav('creator');
          }}
        >Creator</button>

        <button onClick={()=>{
          localStorage.removeItem('gigcircle_token');
          localStorage.removeItem('gigcircle_user');
          setUser(null);
          setPage('home');
        }}>Logout</button>
      </div>
    </header>

    {page==='home'&&
      <Home
        onStart={()=>{
          setProblem('');
          setPage('problem');
        }}
        onMarket={()=>nav('marketplace')}
      />
    }

    {page==='marketplace'&&
      <Marketplace
        query={query}
        setQuery={setQuery}
        tab={tab}
        setTab={setTab}
        creators={creators}
        gigs={gigs}
        onAdd={c=>{
          toggleTeam(c);
          nav('team');
        }}
      />
    }

    {page==='problem'&&
      <Problem
        problem={problem}
        setProblem={setProblem}
        project={project}
        detected={detected}
        optimization={optimization}
        setOptimization={setOptimization}
        budget={budget}
        setBudget={setBudget}
        deadline={deadline}
        setDeadline={setDeadline}
        results={matches}
        team={team}
        toggleTeam={toggleTeam}
        total={total}
        loading={loading}
        onMatch={()=>runMatch(problem)}
        onPreset={v=>runMatch(presets[v])}
        onBuild={()=>nav('team')}
      />
    }

    {page==='team'&&
      <Team
        project={project}
        milestones={milestones}
        team={team}
        total={total}
        budget={budget}
        coverage={coverage}
        detected={detected}
        stress={stress}
        setStress={setStress}
        stressResult={stressResult}
        runStress={runStress}
        chemistry={chemistry}
        replacement={replacement}
        bookings={bookings}
        onRemove={toggleTeam}
        onBook={createBookings}
        onFind={()=>nav('problem')}
        loading={loading}
        notify={notify}
      />
    }

    {page==='bookings'&&
      <Bookings
        bookings={bookings}
        creators={creators}
        onStatus={updateBooking}
        replacement={replacement}
        onFeedback={submitFeedback}
      />
    }

    {page==='creator'&&
      <CreatorDash
        bookings={bookings}
        creators={creators}
        onStatus={updateBooking}
        onFeedback={submitFeedback}
        role={role}
      />
    }

    {page==='postgig'&&
      <PostGig
        creators={creators}
        onCreated={()=>{
          loadCreators();
          loadGigs();
          nav('marketplace');
        }}
      />
    }

    {teamFormed&&<TeamFormed team={team}/>}
    {toast&&<div className="toast">{toast}</div>}
  </div>
}

function Home({onStart,onMarket}){
  return <main>
    <section className="hero">
      <div className="pill">
        <span className="pulse"/>
        Problem-to-team creator marketplace
      </div>

      <h1>Turn your <em>idea</em><br/>into a creator team.</h1>

      <p>
        Describe what you're building. GigCircle understands the skills,
        budget and deadline — then helps you assemble the right people.
      </p>

      <div className="heroBtns">
        <button className="primary" onClick={onStart}>
          Describe Your Project <ArrowRight size={18}/>
        </button>

        <button className="secondary" onClick={onMarket}>
          Browse Creators
        </button>
      </div>

      <div className="heroStats">
        <div><b>89%</b><span>Avg Match</span></div>
        <div><b>18</b><span>Teams formed</span></div>
        <div><b>64%</b><span>Rebook rate</span></div>
      </div>
    </section>

    <section className="how">
      <div className="sectionHead">
        <span>01 — HOW IT WORKS</span>
        <h2>From problem to project.</h2>
      </div>

      <div className="steps">
        <Step n="01" icon={<Target/>} title="Describe" text="Tell us what you're trying to build."/>
        <Step n="02" icon={<Sparkles/>} title="Match" text="Skills, budget and availability are scored."/>
        <Step n="03" icon={<Users/>} title="Assemble" text="Build a team and test its resilience."/>
      </div>
    </section>
  </main>
}

function Step({n,icon,title,text}){
  return <div className="step">
    <span>{n}</span>
    <div className="stepIcon">{icon}</div>
    <h3>{title}</h3>
    <p>{text}</p>
  </div>
}

function Problem({problem,setProblem,project,detected,optimization,setOptimization,budget,setBudget,deadline,setDeadline,results,team,toggleTeam,total,loading,onMatch,onPreset,onBuild}){
  return <main className="workspace">
    <div className="workspaceTitle">
      <div>
        <div className="eyebrow">PROBLEM MODE</div>
        <h2>What are you trying to build?</h2>
        <p>GigCircle turns a plain-language brief into skills and creator recommendations.</p>
      </div>
      <div className="apiBadge"><span className="pulse"/> Live matching API</div>
    </div>

    <div className="problemGrid">
      <section className="panel brief">
        <div className="panelTitle">
          <span>PROJECT BRIEF</span>
          <Sparkles size={17}/>
        </div>

        <textarea
          value={problem}
          onChange={e=>setProblem(e.target.value)}
          placeholder="Example: I need a website and promotional content for our college fest..."
        />

        <div className="presets">
          {Object.keys(presets).map(k=>
            <button onClick={()=>onPreset(k)} key={k}>{k}</button>
          )}
        </div>

        <div className="optimization">
          <label>WHAT ARE YOU OPTIMIZING FOR?</label>
          <div className="optGrid">
            {[['balanced','Balanced'],['cost','Cost'],['speed','Speed'],['quality','Quality'],['chemistry','Chemistry']].map(([k,v])=>
              <button
                key={k}
                className={optimization===k?'active':''}
                onClick={()=>setOptimization(k)}
              >{v}</button>
            )}
          </div>
        </div>

        <div className="briefControls">
          <div>
            <label>BUDGET</label>
            <div className="inputWrap">
              <IndianRupee size={16}/>
              <input
                type="number"
                value={budget}
                onChange={e=>setBudget(+e.target.value)}
              />
            </div>
          </div>

          <div>
            <label>DEADLINE</label>
            <div className="inputWrap">
              <Clock3 size={16}/>
              <input
                type="number"
                value={deadline}
                onChange={e=>setDeadline(+e.target.value)}
              />
              <small>days</small>
            </div>
          </div>
        </div>

        <button
          className="primary full"
          onClick={onMatch}
          disabled={!problem.trim()||loading}
        >
          {loading
            ?<><LoaderCircle className="spin" size={17}/> Analyzing...</>
            :<>Analyze & Find Creators <ArrowRight size={17}/></>
          }
        </button>
      </section>

      <section className="panel dna">
        <div className="panelTitle">
          <span>LIVE PROJECT DNA</span>
          <Sparkles size={17}/>
        </div>

        {detected.length
          ?<div className="skillDetect">
            {detected.map(s=>
              <span key={s}><Check size={13}/>{s}</span>
            )}
          </div>
          :<div className="empty mini">
            <Target size={26}/>
            <span>Start typing and run the matcher to detect required skills.</span>
          </div>
        }

        <div className="dnaRows">
          <Dna label="Complexity" value={project?.projectDNA?.complexity||'Pending'}/>
          <Dna label="Urgency" value={project?.projectDNA?.urgency||'Pending'}/>
          <Dna label="Team size" value={project?.projectDNA?.recommendedTeamSize?`${project.projectDNA.recommendedTeamSize} creators`:'Pending'}/>
          <Dna label="Scope" value={project?.projectDNA?.scope||'Pending'}/>
        </div>

        {project?.projectDNA?.deliverables?.length?
          <div className="dnaDetails">
            <b>Deliverables</b>
            <span>{project.projectDNA.deliverables.join(' · ')}</span>
            <b>Risks</b>
            <span>
              {project.projectDNA.riskFactors?.length
                ?project.projectDNA.riskFactors.join(' · ')
                :'No major risks detected'
              }
            </span>
          </div>
          :null
        }

        <div className="risk">
          <AlertTriangle size={16}/>
          <div>
            <b>{deadline<=3?'Tight deadline detected':'Project constraints look manageable'}</b>
            <span>
              {deadline<=3
                ?'Consider adding a backup creator.'
                :'The match engine will optimize around your constraints.'
              }
            </span>
          </div>
        </div>
      </section>
    </div>

    <section className="matchSection">
      <div className="matchHeader">
        <div>
          <div className="eyebrow">MATCH ENGINE</div>
          <h2>{results.length?'Creators who fit the project':'Run the matcher to see creators'}</h2>
        </div>
        <span className="matchHint">
          {results.length?`${results.length} API matches`:'Transparent scoring'}
        </span>
      </div>

      <div className="cards">
        {results.slice(0,4).map(c=>
          <CreatorCard
            c={c}
            selected={team.some(x=>x.id===c.id)}
            onToggle={()=>toggleTeam(c)}
            key={c.id}
          />
        )}
      </div>
    </section>

    <div className="stickyTeam">
      <div>
        <b>{team.length} creators selected</b>
        <span>₹{total} / ₹{budget} budget · {budget?Math.min(100,Math.round(total/budget*100)):0}% used</span>
      </div>

      <button
        className="primary"
        disabled={!team.length}
        onClick={onBuild}
      >
        Build Team <ChevronRight size={17}/>
      </button>
    </div>
  </main>
}

function Dna({label,value}){
  return <div>
    <span>{label}</span>
    <b>{value}</b>
  </div>
}

function CreatorCard({c,selected,onToggle}){
  const m=c.match||{score:94,skill:92,availability:100};

  return <article className={'creatorCard '+(selected?'selected':'')}>
    <div className="cardTop">
      <div className="avatar">{c.avatar}</div>

      <div className="creatorInfo">
        <h3>
          {c.name}
          {c.rising&&
            <span className="rising">
              <Leaf size={11}/> Rising
            </span>
          }
        </h3>
        <span>{c.role}</span>
      </div>

      <div className="match">
        {m.score}%
        <small>match</small>
      </div>
    </div>

    <div className="badges">
      <span>★ {c.rating}</span>
      <span><ShieldCheck size={13}/> Trust {c.trust}</span>
      <span className={c.available==='now'?'green':''}>
        <i/> {c.available==='now'?'Available now':'Available soon'}
      </span>
    </div>

    <div className="reason">
      <b>Why this creator?</b>
      <span>✓ {m.skill}% skill alignment</span>
      <span>✓ {m.availability}% availability fit</span>
      <span>✓ ₹{c.rate} rate</span>
    </div>

    <div className="cardBottom">
      <b>₹{c.rate}<small>/ project</small></b>

      <button
        className={selected?'remove':'select'}
        onClick={onToggle}
      >
        {selected
          ?<><Check size={15}/> Selected</>
          :<>Add to team <Plus size={15}/></>
        }
      </button>
    </div>
  </article>
}

function Team({project,milestones,team,total,budget,coverage,detected,stress,setStress,stressResult,runStress,replacement,onRemove,onBook,onFind,loading,notify,chemistry}){
  const swap=team.find(m=>m.rate>0&&total>budget);
  const alternatives=swap?[]:[];
  const risk=team.length===0
    ?'No team'
    :coverage<100
    ?'Skill gap'
    :total>budget
    ?'Over budget'
    :team.some(c=>c.available!=='now')
    ?'Availability risk'
    :'Healthy';

  return <main className="workspace">
    <div className="workspaceTitle">
      <div>
        <div className="eyebrow">TEAM BUILDER</div>
        <h2>Your project team.</h2>
        <p>Optimize the people, budget and resilience before you book.</p>
      </div>

      <div className="teamHealth">
        <Activity size={16}/>
        <span>Project health</span>
        <b>{risk}</b>
      </div>
    </div>

    <div className="teamGrid">
      <section className="panel teamPanel">
        <div className="panelTitle">
          <span>SELECTED TEAM</span>
          <span>{team.length} members</span>
        </div>

        {team.length
          ?team.map(m=>
            <div className="member" key={m.id}>
              <div className="avatar">{m.avatar}</div>
              <div>
                <b>{m.name}</b>
                <span>{m.role}</span>
              </div>
              <strong>₹{m.rate}</strong>
              <button onClick={()=>onRemove(m)}>
                <X size={15}/>
              </button>
            </div>
          )
          :<div className="empty">
            <Users size={30}/>
            <b>Your team is empty</b>
            <span>Go back and add creators to build your project team.</span>
            <button className="secondary" onClick={onFind}>Find creators</button>
          </div>
        }

        <div className="budgetBox">
          <div>
            <span>Budget used</span>
            <b>₹{total} <small>/ ₹{budget}</small></b>
          </div>

          <div className="bar">
            <i style={{width:`${budget?Math.min(100,total/budget*100):0}%`}}/>
          </div>

          <span>{Math.max(0,budget-total)} remaining</span>
        </div>
      </section>

      <section className="panel healthPanel">
        <div className="panelTitle">
          <span>PROJECT HEALTH</span>
          <ShieldCheck size={17}/>
        </div>

        <Health label="Skill coverage" value={coverage} ok={coverage>=90}/>

        <Health
          label="Budget fit"
          value={Math.max(0,Math.min(100,Math.round((1-total/Math.max(budget,1))*100)))}
          ok={total<=budget}
        />

        <Health
          label="Availability"
          value={team.length?Math.round(team.filter(m=>m.available==='now').length/team.length*100):0}
          ok={team.length>0}
        />

        <div className="gap">
          <div className="gapTitle">
            <span>SKILL GAPS</span>
            <b>{coverage>=100?'None':'Needs coverage'}</b>
          </div>

          {detected.map(s=>{
            const covered=team.some(m=>m.skills.some(x=>x.toLowerCase().includes(s.toLowerCase().split(' ')[0])));

            return <div className="gapRow" key={s}>
              <span>{s}</span>
              <span className={covered?'covered':'missing'}>
                {covered?'Covered':'Missing'}
              </span>
            </div>
          })}
        </div>
      </section>
    </div>

    {total>budget&&
      <BudgetSuggestion
        team={team}
        total={total}
        budget={budget}
        detected={detected}
      />
    }

    <Timeline team={team}/>

    {team.length>1&&
      <Chemistry
        chemistry={chemistry}
        team={team}
      />
    }

    {project&&
      <ProjectCommand
        project={project}
        milestones={milestones}
        onMilestone={async(id,status)=>{
          try{
            await api(`/milestones/${id}/status`,{
              method:'PATCH',
              body:JSON.stringify({status})
            });

            setMilestones(await api(`/projects/${project.id}/milestones`));
            notify('Milestone updated live');
          }catch(e){
            notify(e.message);
          }
        }}
      />
    }

    <section className="stressPanel">
      <div>
        <div className="eyebrow">RESILIENCE</div>
        <h3>Stress test your team</h3>
        <p>Simulate a creator becoming unavailable and identify a backup.</p>
      </div>

      <button
        className="secondary"
        onClick={()=>stress?setStress(false):runStress()}
        disabled={loading}
      >
        <Zap size={16}/>
        {stress?'Hide simulation':'Run advanced stress test'}
      </button>
    </section>

    {stress&&
      <Stress
        result={stressResult}
        replacement={replacement}
      />
    }

    <div className="teamCta">
      <div>
        <b>Ready to form this team?</b>
        <span>
          {team.length} creators · ₹{total} · projected {team.length?Math.max(...team.map(m=>m.delivery),2):0} days
        </span>
      </div>

      <button
        className="primary"
        disabled={!team.length||total>budget||loading}
        onClick={onBook}
      >
        {loading
          ?<><LoaderCircle className="spin" size={17}/> Booking...</>
          :<>Book Team <Send size={17}/></>
        }
      </button>
    </div>
  </main>
}

function Stress({result,replacement}){
  return <div className="simulation advanced">
    <div className="simHeader">
      <div>
        <div className="eyebrow">ADVANCED RESILIENCE ENGINE</div>
        <h3>{result?.overall||'Analyzing resilience'}</h3>
        <p>GigCircle simulates creator loss, deadline shock and budget pressure before you commit.</p>
      </div>

      <div className="simScore">
        <RefreshCw size={17}/>
        <b>{result?.coverageAfter??0}%</b>
        <span>coverage after failure</span>
      </div>
    </div>

    {replacement&&
      <div className="replacementBanner">
        <Check size={17}/>
        <div>
          <b>Auto-replacement ready</b>
          <span>
            {replacement.replacement.name} · {replacement.replacement.role} · {replacement.replacement.match.score}% match · ₹{replacement.replacement.rate}
          </span>
        </div>
      </div>
    }

    <div className="scenarioGrid">
      {(result?.scenarios||[]).map(s=>
        <div className="scenario" key={s.id}>
          <div>
            <b>{s.label}</b>
            <span className={'severity '+s.severity.toLowerCase().replace(' ','-')}>
              {s.severity}
            </span>
          </div>
          <p>{s.detail}</p>
          <small>{s.metric}</small>
          <strong>{s.recommendation}</strong>
        </div>
      )}
    </div>

    {result?.alternatives?.length?
      <div className="backupList">
        <b>Best backup candidates</b>
        {result.alternatives.map(c=>
          <span key={c.id}>
            <i>{c.avatar}</i>
            {c.name}
            <em>{c.match.score}% match</em>
            <small>₹{c.rate}</small>
          </span>
        )}
      </div>
      :null
    }
  </div>
}

function Chemistry({chemistry,team}){
  if(!team?.length)return null;

  const score=chemistry?.score??75;

  return <section className="panel chemistryPanel">
    <div className="panelTitle">
      <span>TEAM CHEMISTRY</span>
      <span>{chemistry?.knownPairs||0}/{chemistry?.totalPairs||0} proven pairs</span>
    </div>

    <div className="chemistryTop">
      <div className="chemistryRing">
        <b>{score}%</b>
        <span>chemistry</span>
      </div>

      <div>
        <h3>
          {score>=90
            ?'High collaboration confidence'
            :score>=80
            ?'Good collaboration fit'
            :'New-team compatibility'
          }
        </h3>

        <p>
          {chemistry?.explanation||'GigCircle evaluates previous collaborations and uses a neutral baseline for new pairings.'}
        </p>
      </div>
    </div>

    <div className="chemistryPairs">
      {(chemistry?.history||[]).map(pair=>
        <div key={pair.creatorA+pair.creatorB}>
          <span>{pair.creatorA} <b>×</b> {pair.creatorB}</span>
          <small>
            {pair.known
              ?`${pair.projectsTogether} previous projects · ${pair.avgRating}/5 avg`
              :'No shared history · baseline fit'
            }
          </small>
          <strong>{pair.score}%</strong>
        </div>
      )}
    </div>
  </section>
}

function ProjectCommand({project,milestones,onMilestone}){
  const done=milestones.filter(m=>['Completed','Released'].includes(m.status)).length;
  const total=milestones.length;
  const progress=total?Math.round(done/total*100):0;

  return <section className="panel projectCommand">
    <div className="panelTitle">
      <span>PROJECT COMMAND CENTER</span>
      <span>{progress}% delivery health</span>
    </div>

    <div className="commandHead">
      <div>
        <h3>
          {project.description?.slice(0,70)}
          {project.description?.length>70?'…':''}
        </h3>
        <span>
          ₹{project.budget} budget · {project.deadline} day deadline · {project.requiredSkills?.length||0} skill domains
        </span>
      </div>
      <b>{progress}%</b>
    </div>

    <div className="milestones">
      {milestones.map(m=>
        <div className="milestone" key={m.id}>
          <div>
            <span className="milestoneDot"/>
            <div>
              <b>{m.title}</b>
              <small>₹{m.amount}</small>
            </div>
          </div>

          <span className={'status '+m.status.toLowerCase().replace(' ','-')}>
            {m.status}
          </span>

          <button
            className="select"
            onClick={()=>onMilestone(
              m.id,
              m.status==='Locked'
                ?'Funded'
                :m.status==='Funded'
                ?'In Progress'
                :m.status==='In Progress'
                ?'Completed'
                :'Released'
            )}
          >
            {m.status==='Released'?'Released':'Advance'}
          </button>
        </div>
      )}
    </div>

    <div className="bar">
      <i style={{width:`${progress}%`}}/>
    </div>
  </section>
}

function Health({label,value,ok}){
  return <div className="health">
    <div>
      <span>{label}</span>
      <b>{value}%</b>
    </div>
    <div className="bar">
      <i style={{width:`${value}%`}}/>
    </div>
    <small>{ok?'Healthy':'Needs attention'}</small>
  </div>
}

function Marketplace({query,setQuery,tab,setTab,creators,gigs,onAdd}){
  const filtered=creators
    .filter(c=>(c.name+c.role+c.skills.join(' ')).toLowerCase().includes(query.toLowerCase()))
    .filter(c=>tab==='rising'?c.rising:tab==='available'?c.available==='now':true);

  return <main className="workspace">
    <div className="marketHead">
      <div>
        <div className="eyebrow">CREATOR MARKETPLACE</div>
        <h2>Find the people behind the work.</h2>
      </div>

      <div className="search">
        <Search size={17}/>
        <input
          placeholder="Search creators or skills..."
          value={query}
          onChange={e=>setQuery(e.target.value)}
        />
      </div>
    </div>

    <div className="tabs">
      {[['all','All creators'],['available','Available now'],['rising','🌱 Rising talent']].map(([k,v])=>
        <button
          className={tab===k?'active':''}
          onClick={()=>setTab(k)}
          key={k}
        >{v}</button>
      )}
    </div>

    <div className="marketGrid">
      {filtered.map(c=>
        <CreatorCard
          c={{...c,match:{score:94,skill:92,availability:c.available==='now'?100:72}}}
          selected={false}
          onToggle={()=>onAdd(c)}
          key={c.id}
        />
      )}
    </div>

    <section className="panel publishedGigs">
      <div className="panelTitle">
        <span>PUBLISHED GIGS</span>
        <span>{gigs.length} listings</span>
      </div>

      {gigs.length
        ?<div className="gigList">
          {gigs.slice(0,8).map(g=>
            <div className="gigItem" key={g.id}>
              <div>
                <b>{g.title}</b>
                <span>
                  {g.category} · {g.skills?.join(', ')||'General'} · {g.description}
                </span>
              </div>
              <strong>₹{g.rate}</strong>
            </div>
          )}
        </div>
        :<div className="empty mini">
          <BriefcaseBusiness size={26}/>
          <span>No gigs published yet.</span>
        </div>
      }
    </section>
  </main>
}

function Bookings({bookings,creators,onStatus,replacement,onFeedback}){
  return <main className="workspace">
    <div className="workspaceTitle">
      <div>
        <div className="eyebrow">BOOKINGS</div>
        <h2>Project requests.</h2>
        <p>These records are stored by the Express API.</p>
      </div>

      <div className="passportMini">
        <Activity size={16}/> {bookings.length} requests
      </div>
    </div>

    {replacement&&
      <div className="replacementBanner">
        <Check size={17}/>
        <div>
          <b>Replacement suggested</b>
          <span>{replacement.replacement.name} is ready as the next candidate.</span>
        </div>
      </div>
    }

    {bookings.length
      ?<div className="bookingList">
        {bookings.map(b=>{
          const c=creators.find(x=>x.id===b.creatorId)||{
            name:b.creatorId,
            avatar:'?',
            role:'Creator'
          };

          return <div className="booking" key={b.id}>
            <div className="avatar">{c.avatar}</div>

            <div>
              <b>{c.name}</b>
              <span>{c.role} · {b.id}</span>
            </div>

            <span className={'status '+b.status.toLowerCase()}>
              {b.status}
            </span>

            <div className="bookingActions">
              {b.status==='Pending'&&
                <>
                  <button className="select" onClick={()=>onStatus(b.id,'Accepted')}>Accept</button>
                  <button className="decline" onClick={()=>onStatus(b.id,'Declined')}>Decline</button>
                </>
              }

              {b.status==='Accepted'&&
                <button className="select" onClick={()=>onFeedback(b.id,5,true)}>
                  Complete + 5★
                </button>
              }

              {b.status==='Completed'&&
                <small>Feedback submitted · Trust loop updated</small>
              }

              {b.status==='Declined'&&
                <small>Replacement flow available when eligible</small>
              }
            </div>
          </div>
        })}
      </div>
      :<div className="empty big">
        <BriefcaseBusiness size={40}/>
        <b>No active bookings yet</b>
        <span>Build a team from a project brief to create booking requests.</span>
      </div>
    }
  </main>
}

function CreatorDash({bookings,creators,onStatus,onFeedback}){
  const [creatorId,setCreatorId]=useState('rahul');

  const creator=creators.find(c=>c.id===creatorId)||creators[0]||{
    name:'Creator',
    avatar:'?',
    role:'Creator',
    rating:0,
    trust:0,
    projects:0,
    delivery:0,
    skills:[]
  };

  const incoming=bookings.filter(b=>b.creatorId===creator.id);

  return <main className="workspace">
    <div className="workspaceTitle">
      <div>
        <div className="eyebrow">CREATOR DASHBOARD</div>
        <h2>Welcome back, {creator.name.split(' ')[0]}.</h2>
        <p>Real booking requests from the API.</p>
      </div>

      <div className="creatorSelect">
        <span>Creator</span>
        <select value={creator.id} onChange={e=>setCreatorId(e.target.value)}>
          {creators.map(c=>
            <option key={c.id} value={c.id}>{c.name}</option>
          )}
        </select>
      </div>

      <div className="passportMini">
        <ShieldCheck size={17}/> Trust {creator.trust}
      </div>
    </div>

    <div className="dashGrid">
      <section className="panel passport">
        <div className="avatar large">{creator.avatar}</div>
        <h3>{creator.name}</h3>
        <span>{creator.role}</span>

        <div className="statRow">
          <b>{creator.rating}<small>Rating</small></b>
          <b>{creator.projects}<small>Projects</small></b>
          <b>{creator.delivery}d<small>Delivery</small></b>
        </div>

        <div className="chips">
          {creator.skills.map(s=>
            <span className="chip" key={s}>{s}</span>
          )}
        </div>
      </section>

      <section className="panel requests">
        <div className="panelTitle">
          <span>INCOMING REQUESTS</span>
          <span>{incoming.length} total</span>
        </div>

        {incoming.length
          ?incoming.map(b=>
            <Request
              key={b.id}
              booking={b}
              onStatus={onStatus}
              onFeedback={onFeedback}
            />
          )
          :<div className="empty mini">
            <BriefcaseBusiness size={26}/>
            <span>
              No requests for {creator.name.split(' ')[0]} yet.
              Book this creator from the project flow to see one here.
            </span>
          </div>
        }
      </section>
    </div>
  </main>
}

function Request({booking,onStatus,onFeedback}){
  return <div className="request">
    <div>
      <b>Project request</b>
      <span>{booking.requirements||'Creator team booking'} · {booking.id}</span>
    </div>

    <strong>₹{booking.budget}</strong>

    {booking.status==='Pending'
      ?<>
        <button className="select" onClick={()=>onStatus(booking.id,'Accepted')}>Accept</button>
        <button className="decline" onClick={()=>onStatus(booking.id,'Declined')}>Decline</button>
      </>
      :booking.status==='Accepted'
      ?<button className="select" onClick={()=>onFeedback(booking.id,5,true)}>
        Complete + 5★
      </button>
      :<span className={'status '+booking.status.toLowerCase()}>
        {booking.status}
      </span>
    }
  </div>
}

function TeamFormed({team}){
  return <div className="teamFormedOverlay">
    <div className="teamFormedCard">
      <div className="confetti">✦ ✧ ✦ ✧ ✦</div>
      <div className="formedIcon"><Check size={34}/></div>
      <div className="eyebrow">TEAM FORMED</div>
      <h2>Your creator team is ready.</h2>
      <p>{team.map(m=>m.name).join(' · ')}</p>

      <div className="formedMembers">
        {team.map(m=>
          <div className="avatar" key={m.id}>{m.avatar}</div>
        )}
      </div>
    </div>
  </div>
}

function BudgetSuggestion({team,total,budget,detected}){
  const candidates=[
    {
      name:'Rohan Mehta',
      id:'rohan',
      rate:350,
      skills:['Video Editing','Social Media','Content Creation'],
      avatar:'RM'
    },
    {
      name:'Karan Joshi',
      id:'karan',
      rate:300,
      skills:['Copywriting','Social Media','Content Creation'],
      avatar:'KJ'
    }
  ];

  const over=total-budget;

  const swap=team.map(m=>{
    const c=candidates.find(x=>
      x.id!==m.id &&
      x.rate<m.rate &&
      x.skills.some(s=>
        detected.some(d=>
          s.toLowerCase().includes(d.toLowerCase().split(' ')[0])
        )
      )
    );

    return c
      ?{from:m,to:c,saving:m.rate-c.rate}
      :null;
  }).find(Boolean);

  return <section className="smartSwap">
    <div>
      <div className="eyebrow">SMART BUDGET REALLOCATION</div>
      <h3>₹{over} over budget</h3>
      <p>GigCircle found a lower-cost creator option for the same skill area.</p>
    </div>

    {swap
      ?<div className="swapRow">
        <span>{swap.from.avatar} {swap.from.name} · ₹{swap.from.rate}</span>
        <ArrowRight size={16}/>
        <span>{swap.to.avatar} {swap.to.name} · ₹{swap.to.rate}</span>
        <b>Save ₹{swap.saving}</b>
      </div>
      :<span className="muted">No safe one-click swap found. Adjust the team manually.</span>
    }
  </section>
}

function Timeline({team}){
  if(!team.length)return null;

  const max=Math.max(...team.map(m=>m.delivery||1));

  return <section className="timeline panel">
    <div className="panelTitle">
      <span>TIMELINE SIMULATION</span>
      <span>Projected {max} days</span>
    </div>

    {team.map(m=>
      <div className="timelineRow" key={m.id}>
        <div>
          <b>{m.name}</b>
          <span>{m.role}</span>
        </div>

        <div className="timelineTrack">
          <i style={{width:`${Math.max(20,(m.delivery/max)*100)}%`}}/>
        </div>

        <strong>{m.delivery}d</strong>
      </div>
    )}
  </section>
}

function PostGig({creators,onCreated}){
  const [form,setForm]=useState({
    title:'',
    category:'Development',
    rate:500,
    description:'',
    skills:'',
    creatorId:''
  });

  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    if(!form.creatorId&&creators.length)
      setForm(f=>({...f,creatorId:creators[0].id}))
  },[creators,form.creatorId]);

  const submit=async e=>{
    e.preventDefault();
    setError('');

    if(!form.title.trim()||!form.description.trim()){
      setError('Please add a title and description.');
      return;
    }

    if(!form.creatorId){
      setError('Please select a creator.');
      return;
    }

    setSaving(true);

    try{
      await api('/gigs',{
        method:'POST',
        body:JSON.stringify({
          ...form,
          rate:Number(form.rate),
          skills:form.skills.split(',').map(x=>x.trim()).filter(Boolean)
        })
      });

      onCreated();
    }catch(e){
      setError(e.message);
    }finally{
      setSaving(false);
    }
  };

  return <main className="workspace">
    <div className="workspaceTitle">
      <div>
        <div className="eyebrow">POST A GIG</div>
        <h2>Turn your skill into an opportunity.</h2>
        <p>Create a service listing and make it discoverable in the marketplace.</p>
      </div>

      <div className="apiBadge">
        <span className="pulse"/> POST /api/gigs
      </div>
    </div>

    <form className="panel gigForm" onSubmit={submit} noValidate>
      {error&&<div className="formError">{error}</div>}

      <div className="formGrid">
        <label>
          Title
          <input
            value={form.title}
            onChange={e=>setForm({...form,title:e.target.value})}
            placeholder="e.g. React landing page"
            required
          />
        </label>

        <label>
          Creator
          <select
            value={form.creatorId}
            onChange={e=>setForm({...form,creatorId:e.target.value})}
          >
            {creators.map(c=>
              <option key={c.id} value={c.id}>{c.name}</option>
            )}
          </select>
        </label>

        <label>
          Category
          <select
            value={form.category}
            onChange={e=>setForm({...form,category:e.target.value})}
          >
            <option>Development</option>
            <option>Design</option>
            <option>Video</option>
            <option>Content</option>
          </select>
        </label>

        <label>
          Rate (₹)
          <input
            type="number"
            min={1}
            value={form.rate}
            onChange={e=>setForm({...form,rate:e.target.value})}
            required
          />
        </label>

        <label>
          Skills
          <input
            value={form.skills}
            onChange={e=>setForm({...form,skills:e.target.value})}
            placeholder="React, UI, Node.js"
          />
        </label>
      </div>

      <label>
        Description
        <textarea
          value={form.description}
          onChange={e=>setForm({...form,description:e.target.value})}
          placeholder="Describe what you deliver..."
          required
        />
      </label>

      <button className="primary" disabled={saving}>
        {saving
          ?<><LoaderCircle className="spin" size={17}/> Publishing...</>
          :<>Publish Gig <Send size={17}/></>
        }
      </button>
    </form>
  </main>
}

class ErrorBoundary extends Component{
  constructor(props){
    super(props);
    this.state={error:null}
  }

  static getDerivedStateFromError(error){
    return {error}
  }

  componentDidCatch(error,info){
    console.error('GigCircle UI error',error,info)
  }

  render(){
    if(this.state.error)
      return <main className="crashPage">
        <div className="crashCard">
          <div className="logo"><Sparkles size={18}/></div>
          <div className="eyebrow">GIGCIRCLE RECOVERY</div>
          <h1>Something interrupted this screen.</h1>
          <p>The app is still running. Reload once and continue your demo.</p>
          <button className="primary" onClick={()=>window.location.reload()}>
            <RefreshCw size={17}/> Reload GigCircle
          </button>
        </div>
      </main>;

    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App/>
  </ErrorBoundary>
);