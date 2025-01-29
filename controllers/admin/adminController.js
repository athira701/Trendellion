const User = require('../../models/userSchema')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')



const pageerror = async(req,res)=>{
    res.render("admin/adminerror")
}


const loadLogin = async (req,res) =>{

   try {
    if(req.session.admin){
       return res.render('admin/dashboard')
    }
    res.render('admin/adminLogin')
   } catch (error) {
    
   }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log("req.body:", req.body);
        console.log("email:", email);

        if (!email || !password) {
            console.log("Email or password missing");
            return res.redirect("/admin/login");
        }

        // Find admin user
        const admin = await User.findOne({ email: email, isAdmin: true });
        console.log("admin:", admin);

        if (admin) {
            // Compare password (bcrypt.compare is asynchronous)
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                console.log("Password matched");
                req.session.admin = true; // Set admin session flag
                return res.redirect("/admin/dashboard");
            } else {
                console.log("Invalid password");
                return res.redirect("/admin/login");
            }
        } else {
            console.log("Admin not found");
            return res.redirect("/admin/login");
        }
        
    } catch (error) {
        console.log("Login error:", error);
        return res.redirect("/pageerror");
    }
};


const loadDashboard = async (req,res) =>{
    console.log("enterd")
    if(req.session.admin){
        try {
            console.log("hellooooo")
            res.render("admin/dashboard")
        } catch (error) {
            res.redirect("/pageerror")
        }
    }else{
        console.log("Unauthorized access attempt to dashboard");
        res.redirect("/admin/login");
    }
}

const logout = async (req,res) =>{
    try {
        req.session.destroy(err =>{
            if(err){
                console.log("Error destroying Session",err)
                return res.redirect("/adminerror")   
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("Unexpected error during logout",error)
        res.redirect("/pageerror")
        
    }
}




module.exports ={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
}