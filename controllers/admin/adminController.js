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

        // Basic validation
        if (!email || !password) {
            return res.redirect('/admin/login?error=All fields are required');
        }

        // Find admin user
        const admin = await User.findOne({ email: email, isAdmin: true });

        if (!admin) {
            return res.redirect('/admin/login?error=Invalid username or password');
        }

        // Check password
        const passwordMatch = await bcrypt.compare(password, admin.password);

        if (!passwordMatch) {
            return res.redirect('/admin/login?error=Invalid username or password');
        }

        // Set session
        req.session.admin = {
            id: admin._id,
            email: admin.email
        };

        return res.redirect('/admin/dashboard');

    } catch (error) {
        console.error('Login error:', error);
        return res.redirect('/admin/login?error=Something went wrong. Try again.');
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