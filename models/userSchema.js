const { name } = require('ejs')
const mongoose = require('mongoose')
const {Schema} = mongoose  //destructuring schema
 
const userSchema = new Schema({
    name : {
        type : String,
        required : true
    },
    email : {
        type : String,
        required : true,
        unique : true,
    },
    phone : {
        type : String,
        required : false,
        unique : true,
        sparse : true,    //for setting unique constraints eg: During single signup there is no need of ph num
        default : null
    },
    googleId : {
        type : String,
        // default : null 
        unique : true    //to identify during single signup
    },
    password : {
        type : String,
        required : false,
    },
    isBlocked : {
        type : Boolean,
        default : false
    },
    isAdmin : {
        type : Boolean,
        default : false
    },
    usedCoupons: [{ 
        type: String 
    }]  
}, { timestamps: true })

const User = mongoose.model("User",userSchema)

module.exports = User