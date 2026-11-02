require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { query } = require('./db');
const { authenticate, allow, validate } = require('./middleware');
const { nameRule, emailRule, addressRule, passwordRule } = require('./validation');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

const safeUser = ({ id, name, email, address, role }) => ({ id, name, email, address, role });
const makeToken = user => jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });

app.get('/api/health', (_req,res) => res.json({ status: 'ok' }));

app.post('/api/auth/register', nameRule, emailRule, addressRule, passwordRule, validate, async (req,res,next) => {
  try {
    const { name,email,address,password } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users(name,email,address,password_hash,role) VALUES($1,$2,$3,$4,'USER')
       RETURNING id,name,email,address,role`, [name,email,address || '',hash]);
    const user = result.rows[0];
    res.status(201).json({ user, token: makeToken(user) });
  } catch(e) { if(e.code === '23505') return res.status(409).json({message:'Email is already registered.'}); next(e); }
});

app.post('/api/auth/login', emailRule, body('password').notEmpty(), validate, async (req,res,next) => {
  try {
    const result = await query('SELECT * FROM users WHERE email=$1', [req.body.email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(req.body.password, user.password_hash)))
      return res.status(401).json({ message: 'Invalid email or password.' });
    res.json({ user: safeUser(user), token: makeToken(user) });
  } catch(e) { next(e); }
});
app.get('/api/auth/me', authenticate, async (req,res,next) => {
  try { const r = await query('SELECT id,name,email,address,role FROM users WHERE id=$1',[req.user.id]); res.json({user:r.rows[0]}); }
  catch(e){next(e);}
});
app.patch('/api/auth/password', authenticate, passwordRule, validate, async (req,res,next) => {
  try {
    const hash = await bcrypt.hash(req.body.password, 12);
    await query('UPDATE users SET password_hash=$1 WHERE id=$2',[hash,req.user.id]);
    res.json({message:'Password updated.'});
  } catch(e){next(e);}
});

app.get('/api/stores', authenticate, allow('USER'), async (req,res,next) => {
  try {
    const search = `%${(req.query.search || '').trim()}%`;
    const result = await query(`
      SELECT s.id,s.name,s.email,s.address,ROUND(AVG(r.score)::numeric,2) AS overall_rating,
      MAX(CASE WHEN r.user_id=$1 THEN r.score END) AS user_rating
      FROM stores s LEFT JOIN ratings r ON r.store_id=s.id
      WHERE s.name ILIKE $2 OR s.address ILIKE $2
      GROUP BY s.id ORDER BY s.name ASC`, [req.user.id, search]);
    res.json({stores:result.rows});
  } catch(e){next(e);}
});
app.put('/api/stores/:id/rating', authenticate, allow('USER'),
  body('score').isInt({min:1,max:5}).withMessage('Rating must be an integer from 1 to 5.'), validate,
  async (req,res,next) => {
    try {
      const exists = await query('SELECT id FROM stores WHERE id=$1',[req.params.id]);
      if(!exists.rowCount) return res.status(404).json({message:'Store not found.'});
      const result = await query(
        `INSERT INTO ratings(user_id,store_id,score) VALUES($1,$2,$3)
         ON CONFLICT(user_id,store_id) DO UPDATE SET score=EXCLUDED.score,updated_at=NOW()
         RETURNING id,score,updated_at`, [req.user.id,req.params.id,req.body.score]);
      res.json({rating:result.rows[0]});
    } catch(e){next(e);}
  });

app.get('/api/admin/dashboard', authenticate, allow('ADMIN'), async (_req,res,next) => {
  try {
    const r=await query(`SELECT (SELECT COUNT(*) FROM users)::int users,
      (SELECT COUNT(*) FROM stores)::int stores,(SELECT COUNT(*) FROM ratings)::int ratings`);
    res.json(r.rows[0]);
  }catch(e){next(e);}
});
app.get('/api/admin/users', authenticate, allow('ADMIN'), async (req,res,next) => {
  try {
    const {name='',email='',address='',role=''}=req.query;
    const r=await query(`SELECT u.id,u.name,u.email,u.address,u.role,
      CASE WHEN u.role='OWNER' THEN ROUND(AVG(r.score)::numeric,2) END AS rating
      FROM users u LEFT JOIN stores s ON s.owner_id=u.id LEFT JOIN ratings r ON r.store_id=s.id
      WHERE u.name ILIKE $1 AND u.email ILIKE $2 AND u.address ILIKE $3 AND ($4='' OR u.role=$4)
      GROUP BY u.id ORDER BY u.name`,[`%${name}%`,`%${email}%`,`%${address}%`,role]);
    res.json({users:r.rows});
  }catch(e){next(e);}
});
app.post('/api/admin/users', authenticate, allow('ADMIN'), nameRule,emailRule,addressRule,passwordRule,
  body('role').isIn(['ADMIN','USER','OWNER']).withMessage('Invalid role.'),validate,async(req,res,next)=>{
  try{
    const {name,email,address,password,role}=req.body, hash=await bcrypt.hash(password,12);
    const r=await query(`INSERT INTO users(name,email,address,password_hash,role) VALUES($1,$2,$3,$4,$5)
      RETURNING id,name,email,address,role`,[name,email,address||'',hash,role]);
    res.status(201).json({user:r.rows[0]});
  }catch(e){if(e.code==='23505')return res.status(409).json({message:'Email is already registered.'});next(e);}
});
app.get('/api/admin/stores', authenticate, allow('ADMIN'), async(req,res,next)=>{
  try{
    const {name='',email='',address=''}=req.query;
    const r=await query(`SELECT s.id,s.name,s.email,s.address,ROUND(AVG(r.score)::numeric,2) rating
      FROM stores s LEFT JOIN ratings r ON r.store_id=s.id
      WHERE s.name ILIKE $1 AND s.email ILIKE $2 AND s.address ILIKE $3
      GROUP BY s.id ORDER BY s.name`,[`%${name}%`,`%${email}%`,`%${address}%`]);
    res.json({stores:r.rows});
  }catch(e){next(e);}
});
app.post('/api/admin/stores', authenticate, allow('ADMIN'),
  body('name').trim().isLength({min:2,max:120}),emailRule,addressRule,
  body('ownerId').optional({nullable:true}).isInt(),validate,async(req,res,next)=>{
  try{
    const {name,email,address,ownerId}=req.body;
    if(ownerId){
      const owner=await query("SELECT id FROM users WHERE id=$1 AND role='OWNER'",[ownerId]);
      if(!owner.rowCount)return res.status(400).json({message:'ownerId must refer to a Store Owner.'});
    }
    const r=await query(`INSERT INTO stores(name,email,address,owner_id) VALUES($1,$2,$3,$4)
      RETURNING id,name,email,address,owner_id`,[name,email,address||'',ownerId||null]);
    res.status(201).json({store:r.rows[0]});
  }catch(e){next(e);}
});
app.get('/api/admin/users/:id', authenticate, allow('ADMIN'),async(req,res,next)=>{
  try{
    const r=await query(`SELECT u.id,u.name,u.email,u.address,u.role,
      CASE WHEN u.role='OWNER' THEN ROUND(AVG(rt.score)::numeric,2) END rating
      FROM users u LEFT JOIN stores s ON s.owner_id=u.id LEFT JOIN ratings rt ON rt.store_id=s.id
      WHERE u.id=$1 GROUP BY u.id`,[req.params.id]);
    if(!r.rowCount)return res.status(404).json({message:'User not found.'});
    res.json({user:r.rows[0]});
  }catch(e){next(e);}
});

app.get('/api/owner/dashboard', authenticate, allow('OWNER'),async(req,res,next)=>{
  try{
    const stores=await query(`SELECT s.id,s.name,ROUND(AVG(r.score)::numeric,2) average_rating,COUNT(r.id)::int rating_count
      FROM stores s LEFT JOIN ratings r ON r.store_id=s.id WHERE s.owner_id=$1 GROUP BY s.id ORDER BY s.name`,[req.user.id]);
    const contributors=await query(`SELECT s.id store_id,s.name store_name,u.id user_id,u.name user_name,u.email,r.score,r.updated_at
      FROM stores s JOIN ratings r ON r.store_id=s.id JOIN users u ON u.id=r.user_id
      WHERE s.owner_id=$1 ORDER BY r.updated_at DESC`,[req.user.id]);
    res.json({stores:stores.rows,ratings:contributors.rows});
  }catch(e){next(e);}
});

app.use((err,_req,res,_next)=>{
  console.error(err);
  if(err.code==='23505')return res.status(409).json({message:'A record with this email already exists.'});
  res.status(500).json({message:'Unexpected server error.'});
});
const port=process.env.PORT||8080;
app.listen(port,()=>console.log(`API listening on ${port}`));
