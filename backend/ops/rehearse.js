// Runs a disposable deployment. Never uses an existing compose project or database.
const fs = require('fs/promises')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const { spawn } = require('child_process')
const { createProductionEnv } = require('./configure')

const root = path.resolve(__dirname, '../..')
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function run (args, { input, env = process.env, allowFailure = false } = {}) {
  const child = spawn('docker', args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
  let output = ''
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk).slice(-64000) })
  child.stdin.on('error', () => {})
  child.stdin.end(input || '')
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve) })
  if (code && !allowFailure) throw new Error(output.replace(/postgres(?:ql)?:\/\/\S+/gi, '[database URL]').replace(/\b[a-f0-9]{64}\b/gi, '[secret]'))
  return { code, output }
}

async function rehearse () {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ijs-rehearsal-'))
  const envFile = path.join(directory, '.env.production')
  const project = `ijs-check-${crypto.randomBytes(5).toString('hex')}`
  await createProductionEnv({ domain: 'app.ijshub.ru', mirrorPath: directory, destination: envFile })
  const env = { ...process.env }
  for (const name of Object.keys(require('dotenv').parse(await fs.readFile(envFile)))) delete env[name]
  env.BACKEND_SUBNET = `172.30.${crypto.randomInt(0, 256)}.0/24`
  const override = path.join(directory, 'override.yml')
  await fs.writeFile(override, `services:
  api:
    image: ijs-check-api:local
  web:
    image: ijs-check-web:local
    environment:
      DOMAIN: ':80'
    ports: !reset []
  backup:
    image: ijs-check-ops:local
    volumes:
      - mirror:/mirror
  monitor:
    image: ijs-check-api:local
    environment:
      MONITOR_INTERVAL_SECONDS: '5'
      MONITOR_WEBHOOK_URL: ''
volumes:
  mirror:
  restored:
networks:
  backend:
    ipam:
      config: !override
        - subnet: ${env.BACKEND_SUBNET}
`)
  const common = ['compose', '--project-name', project, '--env-file', envFile, '-f', 'docker-compose.prod.yml', '-f', override]
  const compose = (args, options = {}) => run([...common, ...args], { env, ...options })
  const execNode = (script, extra = []) => compose(['exec', '-T', ...extra, 'api', 'node'], { input: `(async()=>{${script}})().catch(error=>{console.error(error);process.exitCode=1})` })
  const sql = script => compose(['exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', 'ijshub', '-v', 'ON_ERROR_STOP=1'], { input: script })
  const probe = script => execNode(`const assert=require('node:assert/strict'); ${script}`)
  const report = { checks: [], fixtures: { properties: 1000, applications: 100, messages: 5000 } }
  const checked = name => { report.checks.push(name); console.log(`Verified: ${name}`) }
  try {
    await compose(['config', '--quiet'])
    if (!process.argv.includes('--skip-build')) {
      console.log('Building production images')
      await compose(['build', 'api', 'backup', 'web'])
    }
    await compose(['up', '-d', '--wait', '--wait-timeout', '120'])
    checked('production startup, restricted database role, migrations and writable storage')
    await probe(`
      const {sequelize}=require('./src/db');
      try {
        const [roles]=await sequelize.query('SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user');
        assert.deepEqual(roles[0],{rolsuper:false,rolcreatedb:false,rolcreaterole:false});
        for (const endpoint of ['/api/metrics','/api/ops/status','/metrics','/ops/status']) assert.equal((await fetch('http://web'+endpoint)).status,404);
        assert.equal((await fetch('http://web/api/health/ready')).status,200);
        assert.equal((await fetch('http://127.0.0.1:4000/metrics')).status,401);
        assert.equal((await fetch('http://127.0.0.1:4000/metrics',{headers:{Authorization:'Bearer '+process.env.OPS_TOKEN}})).status,200);
      } finally { await sequelize.close() }
    `)
    checked('Caddy routing and private operational endpoints')
    await probe(`
      await new Promise((resolve,reject)=>{
        const socket=new WebSocket('ws://web/socket.io/?EIO=4&transport=websocket');
        const timer=setTimeout(()=>{socket.close();reject(new Error('Socket.IO proxy timeout'))},5000);
        socket.addEventListener('error',()=>{clearTimeout(timer);socket.close();reject(new Error('Socket.IO proxy failure'))});
        socket.addEventListener('message',event=>{
          const packet=String(event.data);
          if(packet.startsWith('0')) socket.send('40');
          else if(packet.startsWith('40')) socket.send('421["application_chat_leave",{"applicationId":1}]');
          else if(packet.startsWith('431')) {
            clearTimeout(timer);socket.close();
            try {assert.equal(JSON.parse(packet.slice(3))[0].processed,true);resolve()} catch(error) {reject(error)}
          }
        });
      });
    `)
    checked('Socket.IO connection and event acknowledgement through Caddy')
    await execNode(`
      const fs=require('fs/promises'),crypto=require('crypto'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken');
      const {sequelize}=require('./src/db');
      const {User,AuthSession,Property,PropertyImage,PropertyDocument,Application,ApplicationChatMessage,StatusHistory,Event}=require('./src/models');
      try {
        const password=crypto.randomBytes(24).toString('hex');
        const passwordHash=await bcrypt.hash(password,10);
        const [developer,agent,admin]=await User.bulkCreate(['developer','agent','admin'].map((role,i)=>({role,email:'rehearsal-'+i+'@test.com',passwordHash,developerApproved:true})));
        const avatar='/uploads/avatars/rehearsal.png';
        const image='/uploads/properties/rehearsal.png';
        const document='/uploads/property_docs/rehearsal.pdf';
        const attachment='/uploads/application_docs/rehearsal.pdf';
        for (const url of [avatar,image,document,attachment]) {
          const file='./'+url.slice(1); await fs.mkdir(require('path').dirname(file),{recursive:true});
          await fs.writeFile(file,url.endsWith('.pdf')?'%PDF-1.4\\nfixture\\n%%EOF':'fixture-image');
        }
        await agent.update({avatarUrl:avatar});
        const properties=await Property.bulkCreate(Array.from({length:1000},(_,i)=>({title:'Объект '+i,region:'Область',city:'Город',developerId:developer.id,price:'1000000.00'})));
        await PropertyImage.bulkCreate(properties.map(property=>({propertyId:property.id,url:image})));
        await PropertyDocument.create({propertyId:properties[0].id,url:document,originalName:'rehearsal.pdf',mimeType:'application/pdf',size:24});
        const applications=await Application.bulkCreate(properties.slice(0,100).map(property=>({propertyId:property.id,agentId:agent.id,clientFullName:'Клиент',clientPhone:'+79992223344',expiresAt:new Date(Date.now()+86400000),commissionAmount:'31250.00',commissionRatePercent:'3.125',commissionBasePrice:'1000000.00'})));
        await StatusHistory.bulkCreate(applications.map(application=>({applicationId:application.id,status:'sent',changedBy:agent.id})));
        await ApplicationChatMessage.bulkCreate(Array.from({length:5000},(_,i)=>({applicationId:applications[i%100].id,senderId:agent.id,senderRole:agent.role,text:'Сообщение '+i,...(i===0?{attachmentUrl:attachment}: {})})));
        await Event.bulkCreate(Array.from({length:20},(_,i)=>({title:'Мероприятие '+i,startAt:new Date(Date.now()+86400000+i*60000),createdBy:admin.id})));
        const session=await AuthSession.create({userId:agent.id,refreshTokenHash:crypto.createHash('sha256').update('rehearsal').digest('hex'),expiresAt:new Date(Date.now()+3600000)});
        const token=jwt.sign({sub:agent.id,sid:session.id},process.env.JWT_SECRET,{expiresIn:'1h'});
        await fs.writeFile('/tmp/load-session.json',JSON.stringify({token,password,email:agent.email}),{mode:0o600});
      } finally { await sequelize.close() }
    `)
    await probe(`
      const session=JSON.parse(await require('fs/promises').readFile('/tmp/load-session.json','utf8'));
      const login=await fetch('http://web/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:process.env.APP_ORIGIN},body:JSON.stringify({email:session.email,password:session.password})});
      assert.equal(login.status,200); assert(login.headers.getSetCookie().every(cookie=>cookie.includes('Secure')));
    `)
    checked('production login and Secure cookies through the reverse proxy')
    const load = await execNode(`
      process.env.LOAD_TEST_TOKEN=JSON.parse(await require('fs/promises').readFile('/tmp/load-session.json','utf8')).token;
      process.env.ALLOW_LOAD_TEST='1';
      const report=await require('./ops/load-test').runLoad({base:'http://web/api'});
      console.log(JSON.stringify(report)); if(!report.passed) process.exitCode=1;
    `)
    report.load = JSON.parse(load.output.trim().split('\n').at(-1))
    checked('load: catalog, own applications, chats and events')
    await compose(['run', '--rm', '--no-deps', 'backup', 'ops/backup.js'])
    await sql('CREATE DATABASE ijshub_restore OWNER ijs_app;\nCREATE DATABASE ijshub_legacy OWNER ijs_app;\nCREATE DATABASE ijshub_upgrade OWNER ijs_app;\n')
    const restore = await compose(['run', '--rm', '--no-deps', '-v', `${project}_restored:/restore-uploads`, '-e', 'ALLOW_DB_RESTORE=1', '-e', 'RESTORE_DATABASE_NAME=ijshub_restore', 'backup', '-e', `
      (async()=>{
        process.env.RESTORE_DATABASE_URL=process.env.DATABASE_URL.replace('/ijshub', '/ijshub_restore');
        const fs=require('fs/promises'),path=require('path'),assert=require('node:assert/strict');
        const status=JSON.parse(await fs.readFile('/backups/status.json','utf8'));
        assert(status.mirrored); assert.equal(status.fileCount,4);
        assert.equal(await require('./ops/common').sha256(path.join('/backups',status.file)),await require('./ops/common').sha256(path.join('/mirror',status.file)));
        const file=path.join('/backups',status.file);
        await assert.rejects(require('./ops/restore').restoreBackup({file,key:require('crypto').randomBytes(32)}));
        assert.equal((await fs.readdir('/restore-uploads')).length,0);
        const result=await require('./ops/restore').restoreBackup({file}); assert.equal(result.fileCount,4);
        console.log(JSON.stringify(result));
      })().catch(error=>{console.error(error);process.exitCode=1})
    `])
    report.restore = JSON.parse(restore.output.trim().split('\n').at(-1))
    await execNode(`
      const assert=require('node:assert/strict');const {Client}=require('pg');
      const client=new Client({connectionString:process.env.DATABASE_URL.replace('/ijshub', '/ijshub_restore')});
      try {
        await client.connect();const counts=(await client.query('SELECT (SELECT count(*)::int FROM properties) AS properties,(SELECT count(*)::int FROM applications) AS applications,(SELECT count(*)::int FROM application_chat_messages) AS messages,(SELECT count(*)::int FROM status_histories) AS history')).rows[0];
        assert.deepEqual(counts,{properties:1000,applications:100,messages:5000,history:100});
        assert.equal((await client.query('SELECT commission_amount FROM applications LIMIT 1')).rows[0].commission_amount,'31250.00');
      } finally {await client.end()}
    `)
    checked('encrypted backup, mirror checksum, wrong-key rejection and full restore')
    // Restore a populated frozen initial schema, then apply the current migrations.
    const baseline = await fs.readFile(path.join(root, 'backend/src/db/migrations/20260311T000001-schema.sql'), 'utf8')
    await compose(['exec', '-T', 'db', 'psql', '-U', 'ijs_app', '-d', 'ijshub_legacy', '-v', 'ON_ERROR_STOP=1'], {
      input: baseline + `\nINSERT INTO users(email,password_hash,role,created_at,updated_at) VALUES('legacy@test.com','fixture','developer',now(),now());
INSERT INTO properties(title,developer_id,region,city,price,created_at,updated_at) VALUES('Исторический объект',1,'Регион','Город',7654321.10,now(),now());\n`
    })
    await compose(['run', '--rm', '--no-deps', 'backup', '-e', `
      (async()=>{
        const fs=require('fs/promises');const {createBackup}=require('./ops/backup');const {restoreBackup}=require('./ops/restore');
        const backup=await createBackup({databaseUrl:process.env.DATABASE_URL.replace('/ijshub', '/ijshub_legacy'),backupDir:'/tmp/legacy-backups',mirrorDir:undefined});
        process.env.ALLOW_DB_RESTORE='1';process.env.RESTORE_DATABASE_NAME='ijshub_upgrade';
        await restoreBackup({file:'/tmp/legacy-backups/'+backup.file,databaseUrl:process.env.DATABASE_URL.replace('/ijshub', '/ijshub_upgrade'),uploadsDir:'/tmp/legacy-uploads'});
      })().catch(error=>{console.error(error);process.exitCode=1})
    `])
    await execNode(`
      process.env.DATABASE_URL=process.env.DATABASE_URL.replace('/ijshub', '/ijshub_upgrade');
      const {sequelize}=require('./src/db'); const assert=require('node:assert/strict');
      try {
        await require('./src/db/migrator').runPendingMigrations();
        const [rows]=await sequelize.query('SELECT title,price FROM properties');assert.equal(rows[0].price,'7654321.10');assert.equal(rows[0].title,'Исторический объект');
        const [migrations]=await sequelize.query('SELECT name FROM "SequelizeMeta"');assert.equal(migrations.length,require('fs').readdirSync('./src/db/migrations').filter(name=>name.endsWith('.js')).length);
      } finally {await sequelize.close()}
    `)
    checked('restore and migration of a populated legacy schema without data loss')
    await compose(['stop', 'db'])
    await probe(`
      const started=Date.now();assert.equal((await fetch('http://127.0.0.1:4000/health/live')).status,200);
      assert.equal((await fetch('http://127.0.0.1:4000/health/ready')).status,503);assert(Date.now()-started<5000);
    `)
    // The monitor alerts after three failed checks in a row, so allow a fixed time rather than a number of polls.
    for (const deadline = Date.now() + 60000; ;) {
      const logs = await compose(['logs', '--no-color', 'monitor'])
      if (logs.output.includes('production_alert') && logs.output.includes('api_not_ready')) break
      if (Date.now() > deadline) throw new Error('Monitor failed to report the database outage')
      await pause(1000)
    }
    checked('database outage: liveness survives, readiness fails and monitor raises an alert')
    await compose(['start', 'db'])
    // A failed scheduled job recovers on its next one-minute run.
    for (let attempt = 0; attempt < 90; attempt++) {
      const ready = await probe('assert.equal((await fetch(\'http://127.0.0.1:4000/health/ready\')).status,200)').catch(() => null)
      if (ready) break
      if (attempt === 89) throw new Error('API readiness did not recover')
      await pause(1000)
    }
    for (let attempt = 0; attempt < 15; attempt++) {
      const logs = await compose(['logs', '--no-color', 'monitor'])
      if (logs.output.includes('production_recovered')) break
      if (attempt === 14) throw new Error('Monitor failed to report recovery')
      await pause(1000)
    }
    await compose(['stop', 'api'])
    const stopped = await compose(['ps', '-a', '--format', 'json', 'api'])
    const status = JSON.parse(stopped.output.trim())
    if (status.ExitCode !== 0) throw new Error('API did not shut down cleanly')
    checked('automatic recovery and graceful API shutdown')
    console.log(JSON.stringify(report, null, 2))
    return report
  } catch (error) {
    const logs = await compose(['logs', '--no-color', '--tail', '12', 'api', 'web', 'backup', 'monitor'], { allowFailure: true }).catch(() => ({ output: '' }))
    console.error(logs.output.replace(/postgres(?:ql)?:\/\/\S+/gi, '[database URL]').replace(/\b[a-f0-9]{64}\b/gi, '[secret]'))
    throw error
  } finally {
    await compose(['down', '-v', '--remove-orphans'], { allowFailure: true })
    await fs.rm(directory, { recursive: true, force: true })
  }
}

if (require.main === module) rehearse().catch(error => { console.error(error.message); process.exitCode = 1 })
module.exports = { rehearse }
