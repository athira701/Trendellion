const User = require("../models/userSchema")



const userAuth = (req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next()
            }else{
                res.redirect("/login")
            }
        })
        .catch(error =>{
            console.log("Error in userAuth middleware");
            res.status(500).send("Internal Server Error")
            
        })
    }else{
        res.redirect("/login")
    }
}

const adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data =>{
        if(data){
            next()
        }else{
            res.redirect("/admin/login")
        }
    })
    .catch(error =>{
        console.log("Error in adminAuth middleware")
        res.status(500).send("Internal Server Error")
    })
}

//for admin session handling
const isAdminAuthenticated = (req, res, next) => {
    console.log('ividea...............')
    if (req.session.admin) {
        next();
    } else {
        console.log("Unauthorized access attempt");
        res.redirect("/admin/login");
    }
};


const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/hom');
    }
    next();
};

const isUserAuthenticated = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.id)  {
        console.log("midle ethi")
        next();
    } else {
        res.redirect('/login');
    }
};
const checkUserBlocked = async (req, res, next) => {
    try {
        console.log("entering the user blocked middleare");

        // if (!req.session || !req.session.user || !req.session.user._id) {         //
        //     console.log("No session or user found");
        //     return res.redirect('/login');          
        // }                                                                        //

        const user = await User.findById(req.session.user._id);
        console.log("Fetched user:", user);

        if(user&&!user.isBlocked&&req.session.user){
            next()
        }else{
            console.log("User is blocked or does not exist. Destroying session...");
            req.session.destroy((err) => {
                if (err) {
                    console.error('Error destroying session:', err);
                }
                return res.redirect('/login'); 
            });
        }
    } catch (error) {
        console.error('Error in checkUserBlocked middleware:', error);
        res.status(500).send('Internal Server Error');
    }
};
const addressMiddleware = (req, res, next) => {
    if (req.session.user && req.session.user._id) {
        req.user = req.session.user; // Set user to req.user
        console.log('User ID set in middleware:', req.user._id); // Log the user ID
        return next();
    }
    return res.status(401).json({ error: 'User not authenticated' });
};




module.exports ={
    userAuth,
    adminAuth,
    isAdminAuthenticated,
    isAuthenticated,
    isUserAuthenticated,
    checkUserBlocked,
    addressMiddleware ,   
}
