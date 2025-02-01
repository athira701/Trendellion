const express = require('express')
const userRouter = require('./routes/userRouter')
const adminRouter = require('./routes/adminRouter')
const path = require('path')
require("dotenv").config()
const session = require('express-session')
const passport = require('./config/passport')
const db = require('./config/db')

const app = express()

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
  }))

app.use(passport.initialize())
app.use(passport.session())


app.set('views',path.join(__dirname,'views'));
app.set('view engine','ejs');
app.use(express.static(path.join(__dirname,'public')));


app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next()
})
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;  
    next();
});


db()

app.use("/",userRouter)
app.use("/admin",adminRouter)


app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});


const PORT = process.env.PORT || 3000;

app.listen(process.env.PORT,() => console.log(`Server running in  http://localhost:3000 `)) 

module.exports = app