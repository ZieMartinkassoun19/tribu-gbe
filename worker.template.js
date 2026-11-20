const DB_NAME = "tribu-gbe";
const TABLES = new Set(["villages","announcements","announcement_rsvps","community_posts","member_profiles","member_private","invite_codes","managed_members"]);
const COLUMNS = {
  villages:["id","name","color","created_at"],
  announcements:["id","title","event_date","event_time","location","description","created_by","created_at"],
  announcement_rsvps:["announcement_id","user_id","created_at"],
  community_posts:["id","user_id","body","created_at"],
  member_profiles:["user_id","full_name","birth_date","school","class_name","address","parish_group","village_id","role","active","surname","inviter_id","membership_code","avatar_key","avatar_url","qr_link_1","qr_link_2","edit_allowed","gender","unit_decision","routier_notified_at","created_at"],
  member_private:["user_id","phone","parent_phone","neighborhood","email"],
  invite_codes:["id","code_hash","code_cipher","assigned_role","created_by","used_by","used_at","expires_at","created_at"],
  managed_members:["id","full_name","gender","birth_date","school","class_name","phone","parent_phone","address","parish_group","village_id","created_by","unit_decision","created_at"]
};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const unb64u=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((s.length+3)%4)),c=>c.charCodeAt(0));
const sha=async s=>b64u(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));
const hex= b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
const uuid=()=>crypto.randomUUID();
const randomToken=()=>b64u(crypto.getRandomValues(new Uint8Array(32)));
async function pwHash(password,saltHex){const salt=saltHex?Uint8Array.from(saltHex.match(/.{2}/g).map(x=>parseInt(x,16))):crypto.getRandomValues(new Uint8Array(16));const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:150000,hash:"SHA-256"},key,256);return hex(salt)+"$"+hex(bits);}
async function pwCheck(password,stored){const [salt,hash]=String(stored||"").split("$");if(!salt||!hash)return false;return (await pwHash(password,salt)).split("$")[1]===hash;}
async function getUser(req,env){const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");if(!token)return null;const tokenHash=await sha(token);const row=await env.DB.prepare("SELECT u.id,u.email,p.role,p.active,p.village_id,p.edit_allowed FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN member_profiles p ON p.user_id=u.id WHERE s.token_hash=? AND s.expires_at>datetime('now')").bind(tokenHash).first();return row||null;}
const isStaff=u=>!!u&&["founder","safouin","safouin_village"].includes(u.role);
const isFounder=u=>!!u&&u.role==="founder";
const err=(message,status=400)=>json({error:message},status);
async function issueSession(env,userId){const token=randomToken();await env.DB.prepare("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,datetime('now','+30 days'))").bind(uuid(),userId,await sha(token)).run();return token;}
async function sendPush(env,subscription,payload){
  try{
    if(!env.VAPID_PRIVATE_JWK||!env.VAPID_PUBLIC)return;
    const endpoint=new URL(subscription.endpoint), aud=endpoint.origin;
    const header=b64u(new TextEncoder().encode(JSON.stringify({typ:"JWT",alg:"ES256"})));
    const claims=b64u(new TextEncoder().encode(JSON.stringify({aud,exp:Math.floor(Date.now()/1000)+43200,sub:env.VAPID_SUBJECT||"https://tribu-gbe.workers.dev/"})));
    const signingKey=await crypto.subtle.importKey("jwk",JSON.parse(env.VAPID_PRIVATE_JWK),{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
    const unsigned=header+"."+claims;
    const sig=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},signingKey,new TextEncoder().encode(unsigned));
    const jwt=unsigned+"."+b64u(sig);
    const uaPub=unb64u(subscription.keys.p256dh), auth=unb64u(subscription.keys.auth);
    const clientKey=await crypto.subtle.importKey("raw",uaPub,{name:"ECDH",namedCurve:"P-256"},false,[]);
    const serverPair=await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"},true,["deriveBits"]);
    const serverPub=new Uint8Array(await crypto.subtle.exportKey("raw",serverPair.publicKey));
    const shared=await crypto.subtle.deriveBits({name:"ECDH",public:clientKey},serverPair.privateKey,256);
    const hmacKey=await crypto.subtle.importKey("raw",auth,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const prk=await crypto.subtle.sign("HMAC",hmacKey,shared);
    const info=new Uint8Array([...new TextEncoder().encode("WebPush: info\0"),...uaPub,...serverPub]);
    const prkKey=await crypto.subtle.importKey("raw",prk,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const infoBlock=new Uint8Array([...info,1]);
    const ikm=await crypto.subtle.sign("HMAC",prkKey,infoBlock);
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const saltKey=await crypto.subtle.importKey("raw",salt,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const contentPrk=await crypto.subtle.sign("HMAC",saltKey,ikm);
    const contentKey=await crypto.subtle.importKey("raw",contentPrk,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const cekRaw=await crypto.subtle.sign("HMAC",contentKey,new Uint8Array([...new TextEncoder().encode("Content-Encoding: aes128gcm\0"),1]));
    const nonceRaw=await crypto.subtle.sign("HMAC",contentKey,new Uint8Array([...new TextEncoder().encode("Content-Encoding: nonce\0"),1]));
    const aes=await crypto.subtle.importKey("raw",new Uint8Array(cekRaw).slice(0,16),"AES-GCM",false,["encrypt"]);
    const plain=new Uint8Array([...new TextEncoder().encode(JSON.stringify(payload)),2]);
    const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:new Uint8Array(nonceRaw).slice(0,12)},aes,plain));
    const record=new Uint8Array(16+4+1+serverPub.length+encrypted.length);let off=0;record.set(salt,off);off+=16;record.set([0,0,16,0],off);off+=4;record[off++]=serverPub.length;record.set(serverPub,off);off+=serverPub.length;record.set(encrypted,off);
    const resp=await fetch(subscription.endpoint,{method:"POST",headers:{Authorization:`vapid t=${jwt}, k=${env.VAPID_PUBLIC}`,"Content-Encoding":"aes128gcm","Content-Type":"application/octet-stream","TTL":"86400"},body:record});
    return resp.status;
  }catch(e){console.log("Push send failed",String(e));return 0;}
}
async function notifyAll(env,payload){const {results=[]}=await env.DB.prepare("SELECT id,endpoint,p256dh,auth FROM push_subscriptions").all();for(const s of results){const status=await sendPush(env,{endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload);if(status===404||status===410)await env.DB.prepare("DELETE FROM push_subscriptions WHERE id=?").bind(s.id).run();}}
async function handleAuth(path,req,env){
  const body=await req.json().catch(()=>({}));
  if(path==="/auth/recovery/request"&&req.method==="POST"){
    const identifier=String(body.identifier||"").trim();if(identifier.length<3||identifier.length>120)return err("Identifiant invalide.");
    const digits=identifier.replace(/\D/g,"");
    const user=await env.DB.prepare("SELECT u.id FROM users u LEFT JOIN member_private mp ON mp.user_id=u.id WHERE lower(u.email)=lower(?) OR (?<>'' AND replace(replace(replace(mp.phone,' ',''),'+',''),'-','')=?) LIMIT 1").bind(identifier,digits,digits).first();
    if(user){const recent=await env.DB.prepare("SELECT id FROM account_recovery_requests WHERE user_id=? AND (status='pending' OR (status='approved' AND expires_at>datetime('now'))) AND created_at>datetime('now','-1 day') LIMIT 1").bind(user.id).first();if(!recent)await env.DB.prepare("INSERT INTO account_recovery_requests(id,user_id,status) VALUES(?,?,'pending')").bind(uuid(),user.id).run();}
    return json({data:true,message:"Si le compte existe, la demande a été transmise aux responsables autorisés."});
  }
  if(path==="/auth/recovery/requests"&&req.method==="GET"){
    const u=await getUser(req,env);if(!isStaff(u))return err("Accès réservé aux responsables.",403);
    const sql=u.role!=="founder"?"SELECT r.id,r.status,r.created_at,r.expires_at,p.full_name,p.village_id,v.name AS village FROM account_recovery_requests r JOIN member_profiles p ON p.user_id=r.user_id LEFT JOIN villages v ON v.id=p.village_id WHERE r.status IN ('pending','approved') AND p.village_id=? ORDER BY r.created_at ASC":"SELECT r.id,r.status,r.created_at,r.expires_at,p.full_name,p.village_id,v.name AS village FROM account_recovery_requests r JOIN member_profiles p ON p.user_id=r.user_id LEFT JOIN villages v ON v.id=p.village_id WHERE r.status IN ('pending','approved') ORDER BY r.created_at ASC";
    const q=u.role!=="founder"?env.DB.prepare(sql).bind(u.village_id):env.DB.prepare(sql);const {results=[]}=await q.all();return json({data:results});
  }
  if(path==="/auth/recovery/approve"&&req.method==="POST"){
    const u=await getUser(req,env);if(!isStaff(u))return err("Action réservée aux responsables.",403);const id=String(body.requestId||"");
    const sql=u.role!=="founder"?"SELECT r.id,r.user_id,r.status,p.village_id FROM account_recovery_requests r JOIN member_profiles p ON p.user_id=r.user_id WHERE r.id=? AND p.village_id=?":"SELECT r.id,r.user_id,r.status,p.village_id FROM account_recovery_requests r JOIN member_profiles p ON p.user_id=r.user_id WHERE r.id=?";
    const q=u.role!=="founder"?env.DB.prepare(sql).bind(id,u.village_id):env.DB.prepare(sql).bind(id);const r=await q.first();if(!r||r.status!=="pending")return err("Demande introuvable ou déjà traitée.",404);
    const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let code="GBR-";const random=crypto.getRandomValues(new Uint8Array(10));for(const x of random)code+=alphabet[x%alphabet.length];
    await env.DB.prepare("UPDATE account_recovery_requests SET code_hash=?,status='approved',approved_by=?,expires_at=datetime('now','+30 minutes') WHERE id=? AND status='pending'").bind(await sha(code),u.id,id).run();return json({data:{code,expiresInMinutes:30}});
  }
  if(path==="/auth/recovery/reject"&&req.method==="POST"){
    const u=await getUser(req,env);if(!isStaff(u))return err("Action réservée aux responsables.",403);const id=String(body.requestId||"");
    const sql=u.role!=="founder"?"UPDATE account_recovery_requests SET status='rejected',approved_by=? WHERE id=? AND status='pending' AND user_id IN (SELECT user_id FROM member_profiles WHERE village_id=?)":"UPDATE account_recovery_requests SET status='rejected',approved_by=? WHERE id=? AND status='pending'";
    const q=u.role!=="founder"?env.DB.prepare(sql).bind(u.id,id,u.village_id):env.DB.prepare(sql).bind(u.id,id);const result=await q.run();if(!result.meta?.changes)return err("Demande introuvable.",404);return json({data:true});
  }
  if(path==="/auth/recovery/complete"&&req.method==="POST"){
    const code=String(body.code||"").trim().toUpperCase(),password=String(body.password||"");if(password.length<8||password.length>128)return err("Le mot de passe doit contenir entre 8 et 128 caractères.");
    const row=await env.DB.prepare("SELECT id,user_id FROM account_recovery_requests WHERE code_hash=? AND status='approved' AND expires_at>datetime('now') LIMIT 1").bind(await sha(code)).first();if(!row)return err("Code invalide ou expiré. Contactez à nouveau un responsable.",400);
    await env.DB.prepare("UPDATE users SET password_hash=?,updated_at=datetime('now') WHERE id=?").bind(await pwHash(password),row.user_id).run();await env.DB.prepare("UPDATE account_recovery_requests SET status='used',used_at=datetime('now'),code_hash=NULL WHERE id=?").bind(row.id).run();await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(row.user_id).run();return json({data:true,message:"Mot de passe réinitialisé. Connectez-vous avec votre nouveau mot de passe."});
  }
  if(path==="/auth/register"&&req.method==="POST"){
    const email=String(body.email||"").trim().toLowerCase(),password=String(body.password||""),p=body.profile||{};
    if(email.length<3||email.length>120)return err("Identifiant invalide.");
    if(password.length<8||password.length>128)return err("Le mot de passe doit contenir entre 8 et 128 caractères.");
    if(!p.full_name||!p.birth_date||!p.school||!p.class_name||!p.phone||!p.parent_phone||!p.address||!p.village_id||!p.invite_code)return err("Certains champs obligatoires sont manquants.");
    if(!["M","F"].includes(p.gender))return err("Sexe invalide.");
    if(await env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").bind(email).first())return err("Cet identifiant est déjà utilisé.",409);
    const codeHash=await sha(String(p.invite_code).toUpperCase().replace(/\s+/g,""));
    let role="cheminot", inviter=null, setup=await env.DB.prepare("SELECT id FROM setup_codes WHERE code_hash=? AND used_at IS NULL").bind(codeHash).first();
    const founder=await env.DB.prepare("SELECT user_id FROM member_profiles WHERE role='founder' LIMIT 1").first();
    if(setup&&!founder){role="founder";}else{
      const invite=await env.DB.prepare("SELECT id,assigned_role,created_by,expires_at FROM invite_codes WHERE code_hash=? AND used_by IS NULL").bind(codeHash).first();
      if(!invite)return err("Code d’invitation invalide ou déjà utilisé.",403);
      if(invite.expires_at&&new Date(invite.expires_at)<new Date())return err("Ce code d’invitation a expiré.",403);
      role=invite.assigned_role||"cheminot";inviter=invite.created_by;
    }
    const id=uuid(),membership="TGB-"+crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();
    const hashed=await pwHash(password);
    await env.DB.prepare("INSERT INTO users(id,email,password_hash) VALUES(?,?,?)").bind(id,email,hashed).run();
    await env.DB.prepare("INSERT INTO member_profiles(user_id,full_name,birth_date,school,class_name,address,parish_group,village_id,role,active,inviter_id,membership_code,gender) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?)").bind(id,p.full_name,p.birth_date,p.school,p.class_name,p.address,p.parish_group||"",p.village_id,role,inviter,membership,p.gender).run();
    await env.DB.prepare("INSERT INTO member_private(user_id,phone,parent_phone,neighborhood,email) VALUES(?,?,?,?,?)").bind(id,p.phone,p.parent_phone,p.address,email).run();
    if(setup&&!founder)await env.DB.prepare("UPDATE setup_codes SET used_at=datetime('now') WHERE id=?").bind(setup.id).run();
    else await env.DB.prepare("UPDATE invite_codes SET used_by=?,used_at=datetime('now') WHERE code_hash=?").bind(id,codeHash).run();
    const token=await issueSession(env,id);return json({data:{token,user:{id,email}},success:true});
  }
  if(path==="/auth/login"&&req.method==="POST"){
    const email=String(body.email||"").trim().toLowerCase(),password=String(body.password||"");
    const row=await env.DB.prepare("SELECT id,email,password_hash FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
    if(!row||!(await pwCheck(password,row.password_hash)))return err("Identifiant ou mot de passe incorrect.",401);
    const profile=await env.DB.prepare("SELECT active FROM member_profiles WHERE user_id=?").bind(row.id).first();if(!profile||!profile.active)return err("Ce compte est désactivé. Contactez un responsable.",403);
    const token=await issueSession(env,row.id);return json({data:{token,user:{id:row.id,email:row.email}},success:true});
  }
  if(path==="/auth/me"&&req.method==="GET"){const u=await getUser(req,env);return json({data:{user:u?{id:u.id,email:u.email}:null}});}
  if(path==="/auth/logout"&&req.method==="POST"){const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");if(token)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha(token)).run();return json({data:true});}
  if(path==="/auth/password"&&req.method==="POST"){const u=await getUser(req,env);if(!u)return err("Connexion requise.",401);if(String(body.password||"").length<8)return err("Le mot de passe doit contenir au moins 8 caractères.");await env.DB.prepare("UPDATE users SET password_hash=?,updated_at=datetime('now') WHERE id=?").bind(await pwHash(body.password),u.id).run();return json({data:true});}
  return err("Route d’authentification inconnue.",404);
}
async function handleData(table,req,env,user){
  const b=await req.json().catch(()=>({})),action=b.action||"select",filters=Array.isArray(b.filters)?b.filters:[],columns=COLUMNS[table];
  if(table==="invite_code_plain"){
    if(!isStaff(user))return err("Accès réservé aux responsables.",403);
    if(action==="select"){
      const q=user.role==="safouin"?env.DB.prepare("SELECT id AS code_id,code_cipher AS code_plain FROM invite_codes WHERE code_cipher IS NOT NULL AND created_by=? ORDER BY created_at DESC").bind(user.id):env.DB.prepare("SELECT id AS code_id,code_cipher AS code_plain FROM invite_codes WHERE code_cipher IS NOT NULL ORDER BY created_at DESC");
      const {results=[]}=await q.all();return json({data:results});
    }
    if(action==="insert"){
      const vals=Array.isArray(b.values)?b.values:[b.values];
      for(const v of vals){const q=user.role==="safouin"?env.DB.prepare("UPDATE invite_codes SET code_cipher=? WHERE id=? AND created_by=?").bind(v.code_plain,v.code_id,user.id):env.DB.prepare("UPDATE invite_codes SET code_cipher=? WHERE id=?").bind(v.code_plain,v.code_id);await q.run();}
      return json({data:vals});
    }
    return err("Opération non autorisée.",403);
  }
  if(!TABLES.has(table))return err("Table inconnue.",404);
  if(["member_profiles","member_private","community_posts","announcement_rsvps","invite_codes","managed_members"].includes(table)&&!user)return err("Connexion requise.",401);
  if(["invite_codes","managed_members"].includes(table)&&!isStaff(user))return err("Accès réservé aux responsables.",403);
  if(table==="member_private"&&!isStaff(user)&&action==="select")filters.push(["user_id",user.id]);
  if(table==="member_profiles"&&user?.role==="safouin"&&action==="select")filters.push(["village_id",user.village_id]);
  if(table==="invite_codes"&&user?.role==="safouin"&&action==="select")filters.push(["created_by",user.id]);
  if(table==="managed_members"&&user?.role==="safouin"&&action!=="insert")filters.push(["created_by",user.id]);
  const where=[];const params=[];
  for(const f of filters){if(!Array.isArray(f)||f.length!==2||!columns.includes(f[0]))return err("Filtre invalide.");where.push('"'+f[0]+'" = ?');params.push(f[1]);}
  const clause=where.length?" WHERE "+where.join(" AND "):"";
  if(action==="select"){
    if(table==="member_private"&&!isStaff(user)&&!filters.some(f=>f[0]==="user_id"))return err("Accès refusé.",403);
    if(table==="member_profiles"&&!user)return err("Connexion requise.",401);
    if(table==="community_posts"&&!user)return err("Connexion requise.",401);
    if(table==="member_private"&&user?.role==="safouin"){
      const {results=[]}=await env.DB.prepare("SELECT mp.* FROM member_private mp JOIN member_profiles p ON p.user_id=mp.user_id WHERE p.village_id=?").bind(user.village_id).all();
      return json({data:results});
    }
    let sql='SELECT * FROM "'+table+'"'+clause;
    if(b.order&&columns.includes(b.order.column))sql+=' ORDER BY "'+b.order.column+'" '+(b.order.ascending===false?'DESC':'ASC');
    const {results=[]}=await env.DB.prepare(sql).bind(...params).all();
    if(table==="member_profiles"&&!isStaff(user)){
      for(const row of results){if(row.user_id!==user.id){for(const k of ["birth_date","school","class_name","address","parish_group","gender","avatar_url","avatar_key","qr_link_1","qr_link_2","membership_code"])row[k]=null;}}
    }
    return json({data:results});
  }
  if(action==="insert"){
    const vals=Array.isArray(b.values)?b.values:[b.values];if(!vals.length||!vals[0])return err("Données manquantes.");
    for(const v0 of vals){const v={...v0};
      if(table==="villages"&&!isFounder(user))return err("Seul le fondateur peut gérer les villages.",403);
      if(table==="announcements"&&!isStaff(user))return err("Action réservée aux Safouins.",403);
      if(table==="community_posts"){if(v.user_id!==user.id)return err("Auteur invalide.",403);}
      if(table==="announcement_rsvps"){if(v.user_id!==user.id)return err("Action non autorisée.",403);}
      if(table==="member_private"){if(v.user_id!==user.id&&!isStaff(user))return err("Action non autorisée.",403);}
      if(table==="invite_codes"){if(!isStaff(user))return err("Action réservée.",403);v.id=v.id||uuid();v.created_by=user.id;}
      if(table==="managed_members"){if(!isStaff(user))return err("Action réservée.",403);v.id=v.id||uuid();v.created_by=user.id;}
      if(table==="member_profiles")return err("La création de profil passe par l’inscription.",403);
      if(table==="community_posts")v.id=v.id||uuid();if(table==="villages")v.id=v.id||uuid();if(table==="announcements")v.id=v.id||uuid();
      const keys=Object.keys(v).filter(k=>columns.includes(k));if(!keys.length)return err("Aucune donnée valide.");
      const sql='INSERT INTO "'+table+'" ('+keys.map(k=>'"'+k+'"').join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')';
      try{await env.DB.prepare(sql).bind(...keys.map(k=>v[k])).run();}catch(e){return err(e.message,400);}
      if(table==="announcements")await notifyAll(env,{title:"Nouvelle annonce · Tribu Gbê",body:v.title||"Une nouvelle annonce a été publiée.",url:"/"});
      if(table==="community_posts")await notifyAll(env,{title:"Communauté · Tribu Gbê",body:"Une nouvelle publication est disponible.",url:"/"});
    }
    return json({data:vals.map(v=>v)});
  }
  if(action==="update"){
    const v=b.values||{};if(!where.length)return err("Filtre obligatoire pour modifier.");
    if(table==="member_profiles"){
      const target=filters.find(f=>f[0]==="user_id")?.[1];if(!target)return err("Membre introuvable.");
      const targetRow=await env.DB.prepare("SELECT role,edit_allowed,village_id FROM member_profiles WHERE user_id=?").bind(target).first();if(!targetRow)return err("Membre introuvable.",404);
      if(!isStaff(user)){if(target!==user.id||!targetRow.edit_allowed)return err("Modification du profil non autorisée.",403);for(const k of ["role","active","edit_allowed","inviter_id","unit_decision","routier_notified_at"])delete v[k];}
      else {
        if(!isFounder(user)&&targetRow.role==="founder")return err("Action non autorisée.",403);
        if(user.role==="safouin"&&targetRow.village_id!==user.village_id)return err("Membre hors de votre village.",403);
        if(!isFounder(user))delete v.role;
      }
    }
    if(table==="member_private"){const target=filters.find(f=>f[0]==="user_id")?.[1];if(!isStaff(user)&&target!==user.id)return err("Action non autorisée.",403);if(user.role==="safouin"){const pr=await env.DB.prepare("SELECT village_id FROM member_profiles WHERE user_id=?").bind(target).first();if(!pr||pr.village_id!==user.village_id)return err("Membre hors de votre village.",403);}}
    if(table==="managed_members"&&!isStaff(user))return err("Action réservée.",403);
    if(table==="villages"&&!isFounder(user))return err("Action réservée au fondateur.",403);
    if(table==="announcements"&&!isStaff(user))return err("Action réservée.",403);
    if(table==="invite_codes"&&!isStaff(user))return err("Action réservée.",403);
    const keys=Object.keys(v).filter(k=>columns.includes(k));if(!keys.length)return err("Aucune donnée valide.");
    await env.DB.prepare('UPDATE "'+table+'" SET '+keys.map(k=>'"'+k+'"=?').join(',')+clause).bind(...keys.map(k=>v[k]),...params).run();return json({data:true});
  }
  if(action==="delete"){
    if(!where.length)return err("Filtre obligatoire pour supprimer.");
    if(table==="community_posts"){const row=await env.DB.prepare("SELECT user_id FROM community_posts WHERE "+clause.replace(" WHERE ","")).bind(...params).first();if(!row||row.user_id!==user.id&&!isStaff(user))return err("Suppression non autorisée.",403);}
    else if(table==="announcement_rsvps"){if(!filters.some(f=>f[0]==="user_id"&&f[1]===user.id))return err("Action non autorisée.",403);}
    else if(table==="managed_members"){if(!isStaff(user))return err("Action réservée.",403);}
    else if(table==="announcements"){if(!isStaff(user))return err("Action réservée.",403);}
    else return err("Suppression non autorisée.",403);
    await env.DB.prepare('DELETE FROM "'+table+'"'+clause).bind(...params).run();return json({data:true});
  }
  return err("Opération inconnue.");
}
async function handleRpc(name,req,env,user){
  if(!user)return err("Connexion requise.",401);const b=await req.json().catch(()=>({}));
  if(name==="tribu_ack_routier"){await env.DB.prepare("UPDATE member_profiles SET routier_notified_at=datetime('now') WHERE user_id=?").bind(user.id).run();return json({data:true});}
  if(!isStaff(user))return err("Action réservée aux responsables.",403);
  if(name==="tribu_decide_unit"){
    if(b.p_user){const target=await env.DB.prepare("SELECT village_id,role FROM member_profiles WHERE user_id=?").bind(b.p_user).first();if(!target||target.role!=="cheminot"||(user.role==="safouin"&&target.village_id!==user.village_id))return err("Action non autorisée.",403);await env.DB.prepare("UPDATE member_profiles SET unit_decision=? WHERE user_id=? AND role='cheminot'").bind(b.p_decision,b.p_user).run();}
    else if(b.p_managed){const target=await env.DB.prepare("SELECT created_by FROM managed_members WHERE id=?").bind(b.p_managed).first();if(!target||(user.role==="safouin"&&target.created_by!==user.id))return err("Action non autorisée.",403);await env.DB.prepare("UPDATE managed_members SET unit_decision=? WHERE id=?").bind(b.p_decision,b.p_managed).run();}
    return json({data:true});
  }
  if(name==="tribu_promouvoir_safouin"||name==="tribu_retrograder_safouin"){
    const target=await env.DB.prepare("SELECT village_id,role FROM member_profiles WHERE user_id=?").bind(b.p_target).first();
    if(!target||(user.role==="safouin"&&target.village_id!==user.village_id))return err("Action non autorisée.",403);
    if(name==="tribu_promouvoir_safouin"&&target.role!=="cheminot")return err("Seul un Cheminot peut être promu.",400);
    if(name==="tribu_retrograder_safouin"&&target.role!=="safouin")return err("Ce membre n'est pas Safouin.",400);
    await env.DB.prepare("UPDATE member_profiles SET role=? WHERE user_id=?").bind(name==="tribu_promouvoir_safouin"?"safouin":"cheminot",b.p_target).run();return json({data:true});
  }
  if(name==="tribu_nommer_safouin"){
    if(!isFounder(user))return err("Action réservée au fondateur.",403);
    await env.DB.prepare("UPDATE member_profiles SET role='safouin' WHERE role='safouin_village'").run();
    await env.DB.prepare("UPDATE member_profiles SET role='safouin_village' WHERE user_id=? AND role='safouin'").bind(b.p_target).run();return json({data:true});
  }
  if(name==="tribu_supprimer_membre"){
    if(!isFounder(user))return err("Action réservée au fondateur.",403);
    await env.DB.prepare("DELETE FROM users WHERE id=? AND id<>?").bind(b.p_target,user.id).run();return json({data:true});
  }
  return err("Opération non disponible.",404);
}
async function handlePush(path,req,env,user){
  if(!user)return err("Connexion requise.",401);
  if(path==="/push/key")return json({data:{publicKey:env.VAPID_PRIVATE_JWK&&env.VAPID_PUBLIC?env.VAPID_PUBLIC:null}});
  if(path==="/push/subscribe"&&req.method==="POST"){
    const s=await req.json();if(!s?.endpoint||!s?.keys?.p256dh||!s?.keys?.auth)return err("Abonnement Push invalide.");
    await env.DB.prepare("INSERT INTO push_subscriptions(id,user_id,endpoint,p256dh,auth) VALUES(?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth").bind(uuid(),user.id,s.endpoint,s.keys.p256dh,s.keys.auth).run();return json({data:true});
  }
  if(path==="/push/unsubscribe"&&req.method==="POST"){
    const b=await req.json();await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?").bind(b.endpoint,user.id).run();return json({data:true});
  }
  return err("Route Push inconnue.",404);
}
const HTML_B64 = "__HTML_B64__";
const MANIFEST = __MANIFEST__;
const SW = __SW__;
const ICON_B64 = "__ICON_B64__";
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url),path=url.pathname;
  if(request.method==="OPTIONS")return new Response(null,{headers:{"Access-Control-Allow-Origin":url.origin,"Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});
  if(path.startsWith("/api/")){
    try{
      const user=await getUser(request,env);
      if(path.startsWith("/api/auth/"))return await handleAuth(path.slice(4),request,env);
      if(path.startsWith("/api/data/"))return await handleData(decodeURIComponent(path.slice(10)),request,env,user);
      if(path.startsWith("/api/rpc/"))return await handleRpc(decodeURIComponent(path.slice(9)),request,env,user);
      if(path.startsWith("/api/push/"))return await handlePush(path.slice(4),request,env,user);
      return err("API introuvable.",404);
    }catch(e){console.log("API error",e.stack||String(e));return err("Erreur serveur. Réessayez.",500);}
  }
  if(path==="/manifest.webmanifest")return new Response(JSON.stringify(MANIFEST),{headers:{"content-type":"application/manifest+json","cache-control":"public,max-age=3600"}});
  if(path==="/sw.js")return new Response(SW,{headers:{"content-type":"application/javascript; charset=utf-8","service-worker-allowed":"/","cache-control":"no-cache"}});
  if(path==="/icon-192.png")return new Response(Uint8Array.from(atob(ICON_B64),c=>c.charCodeAt(0)),{headers:{"content-type":"image/png","cache-control":"public,max-age=604800"}});
  if(path==="/health")return json({status:"ok",app:"Tribu Gbê",database:"Cloudflare D1"});
  const html=Uint8Array.from(atob(HTML_B64),c=>c.charCodeAt(0));return new Response(html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-cache","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","x-frame-options":"DENY"}});
 }
};
