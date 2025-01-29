const passport = require("passport")
const GoogleStrategy = require("passport-google-oauth20").Strategy
const User = require("../models/userSchema")
require("dotenv").config()



passport.use(new GoogleStrategy({
    clientID : process.env.GOOGLE_CLIENT_ID,
    clientSecret :process.env.GOOGLE_CLIENT_SECRET,
    callbackURL : 'http://localhost:3000/auth/google/callback'
},
async(req,accessToken,refreshToken,profile,done)=>{
    try {
        let user = await User.findOne({googleId:profile.id})
        console.log(user);
    
        
        if(user){
           
            return done(null,user)
            
            
        }else{
            user = new User({
                name : profile.displayName,
                email : profile.emails[0].value,
                googleId : profile.id,
                isBlocked : false
            })
            await user.save()
            
        }
    } catch (error) {
        return done(error,null)
        
    }
}

))

passport.serializeUser((user,done)=>{
    done(null,user.id)
})

passport.deserializeUser(async(id,done)=>{
    
    try {
        const user = await User.findById(id)
        done(null,user)
    } catch (error) {
        done(error,null)
    }
})

module.exports = passport