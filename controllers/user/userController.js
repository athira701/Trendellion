const User = require("../../models/userSchema")
const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const Address = require('../../models/addressSchema')
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt')
const env = require("dotenv").config()





const pageNotFound = async (req,res) =>{
    console.log("pageNotFound")
    try {
         res.render("user/page-404")
    } catch (error) {
        res.redirect("/pageNotFound")
    }

}

const loadHomePage = async (req,res)=>{
    try {
      return res.render("user/firstHome")
    } catch (error) {
     console.log("not found")
     res.status(500).send("server error")
 }
 }


const homepage = async (req,res)=>{
    console.log("Helo")
    try {

        if(!req.session.user){
            return res.redirect('/')
        }
        //const user = await User.find({})
        const products = await Product.find({isBlocked:false,status:'Available'});
        const category=await Category.find({});
        const user = req.session.user || null
        console.log("Logged user:",user);


         res.render('user/home',
            {products,category,user})
        
    } catch (error) {
        console.log("Home page not found");
        res.status(500).send("Server Error")
    }
}



const loginPage = async (req, res) => {
    try {
        if (req.session.user) {
            return res.redirect('/')
        }
        
        return res.render("user/login", { message: "" });
    } catch (error) {
        console.error("Login page error:", error);
        return res.render("user/login", { 
            message: "Something went wrong. Please try again." 
        });
    }
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Input validation
        if (!email || !password) {
            return res.render("user/login", {
                message: "Please provide both email and password"
            });
        }

               // First check if user exists in database
               const userExists = await User.findOne({ email: email });
               console.log('user exists',userExists)
        
               // If no user found with this email, render login page with error
               if (!userExists) {
                   return res.render("user/login", {
                       message: "Email not registered. Please signup first."
                   });
               }
       

        // Find user and explicitly select password field
        const findUser = await User.findOne({
            isAdmin: 0,
            email: email,
            // Make sure user is registered normally, not through Google
            googleId: { $exists: false }
        }).select('+password'); // If password field is marked as select: false in schema

        console.log("User:", findUser);

        if (!findUser) {
            return res.render("user/login", {
                message: "User not found. Please signup first."
            });
        }

        if (findUser.isBlocked) {
            return res.render("user/login", {
                message: "Your account is blocked."
            });
        }

        // Verify password exists before comparing
        if (!findUser.password) {
            return res.render("user/login", {
                message: "Please login with Google or reset your password"
            });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);
        console.log("Password match:", passwordMatch);

        if (!passwordMatch) {
            return res.render("user/login", {
                message: "Incorrect password"
            });
        }
       
    
        req.session.user = {
            _id: findUser._id,
            email: findUser.email,
            name: findUser.name
        };
        console.log("see",req.session.user)

      

        
        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res.render("user/login", {
                    message: "Login failed. Please try again."
                });
            }
            return res.redirect("/hom");
        });

    } catch (error) {
        console.error("Login error:", error);
        return res.render("user/login", {
            message: "Login failed. Please try again later."
        });
    }
};


const loadSignup = async (req,res) =>{
    try {
        res.render("user/signup")
    } catch (error) {
        console.log("Home Page not Loading:",error)
        res.status(500).send("Server Error")
    }
}


const loadOtp = async (req,res) =>{
    try {
        res.render('user/verify-otp')
    } catch (error) {
        console.log("Home Page not Loading:",error)
        res.status(500).send("Server Error")
    }
}


function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString()
}

async function sendVerificationEmail(email,otp){
    try {
        const transporter = nodemailer.createTransport({    //This is for setting default emailId and password for generating otp to the users

            service : 'gmail',                  //which service provider we are using
            port : 587,                         //default port for gmail
            secure : false,
            requireTLS : true,
            auth : {
                user : process.env.NODEMAILER_EMAIL,
                pass : process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from : process.env.NODEMAILER_EMAIL,
            to : email,
            subject : "Verify your account",
            text : `Your OTP is ${otp}`,
            html : `<b>Your OTP : ${otp}</b>`,
        })

        return info.accepted.length > 0
    } catch (error) {
        console.error("Error sending email",error)
        return false
    }
}

const signup = async (req, res) => {
    try {
        const { name, phone, email, password, cPassword } = req.body;
        console.log("ivideaaaaaaaaaaaaaaaaaa",req.body);

        if (password !== cPassword) {
            return res.render("user/signup", { message: "Passwords do not match" });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("user/signup", { message: "User with this email already exists" });
        }

        const otp = generateOtp();

        req.session.userData = { name, email, phone, password };
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.json("email-error");
        }

        res.render("user/verify-otp");
        console.log("OTP Sent:", otp);
    } catch (error) {
        console.error("Signup Error:", error);
        res.redirect("/page-404");
    }
};


const securePassword = async (password) =>{
    try {
        const passwordHash = await bcrypt.hash(password,10)

        return passwordHash

    } catch (error) {
        
    }
}

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log("Session data at verifyOtp:", req.session);
        console.log("Received OTP:", otp);
        console.log('User Data',userData);
        if (!req.session.userData) {
            return res.status(400).json({ success: false, message: 'Session expired. Please sign up again.' });
        }

        if (otp === req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash
            });
            await saveUserData.save();

            req.session.user = saveUserData._id;
            res.json({ success: true, redirectUrl: "/" });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP, Please try again" });
        }
    } catch (error) {
        console.error("Error Verifying OTP:", error);
        res.status(500).json({ success: false, message: "An error occurred" });
    }
};

const resendOtp = async (req,res) =>{
    try {


        // const{email} = req.session.userData
        // if(!email){
        //     return res.status(400).json({success:false,message:"Email not found in session"})
        // }
        if (!req.session.userData) {
            return res.status(400).json({ success: false, message: "Session expired. Please sign up again." });
        }

        // Clear the previous OTP from session
        req.session.userOtp = null;

        //generate new otp to resend

        const newOtp = generateOtp()
        req.session.userOtp = newOtp

        const emailSent = await sendVerificationEmail(req.session.userData.email,newOtp)
        if(emailSent){
            console.log("Resend OTP :",newOtp)
            res.status(200).json({success:true,message:"OTP Resend Successfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to resend OTP.Please try again" })
        }
    } catch (error) {
        console.log("Error resending OTP",error)
        res.status(500).json({success:false,message:"Internal Server Error.Please try again"})
    }
}


const forgotPassword = async (req,res) =>{
    try {
        res.render("user/forgotPassword")
    } catch (error) {
        
    }
}

const loadForgotOtpPage = async (req,res) => {
    try {
        return res.render("user/forgotOtpPage")
    } catch (error) {
        
    }
}

const forgot = async (req,res) =>{
    const { email } = req.body;
    console.log("Email verunnindo:",email)

  try {
    // Check if the user exists
    const user = await User.findOne({ email });

    if (!user) {
      return res.render("user/forgot", {
        message: "User with this email does not exist.",
      });
    }

    // Generate OTP
    const otp = generateOtp();

    // Send OTP to the user's email
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.render("user/forgotPassword", {
        message: "Failed to send OTP. Please try again.",
      });
    }

    // Store OTP and email in session
    req.session.forgotPasswordOtp = otp;
    req.session.forgotPasswordEmail = email;

    // Redirect to OTP verification page
    console.log("OTP Sent", otp);

    return res.redirect("/forgotOtp");
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.render("user/forgotPassword", {
      message: "An error occurred. Please try again.",
    });
  }
};

const forgotOtpVerify = async (req,res) =>{
    try {
        const { otp } = req.body;
        console.log("Otp checking:",otp)
        console.log("req.session.userOtp:",req.session.userOtp)
        if (!req.session.userOtp || !req.session.email) {
          return res.status(400).json({
            status: "error",
            message: "Session expired. Please request a new OTP.",
          });
        }
    
        if (otp === req.session.userOtp) {
          // OTP is correct, verify user
          await User.updateOne(
            { email: req.session.email },
            { $set: { isVerified: true } }
          );
    
          // Clear session data after successful verification
          req.session.userOtp = null;
          req.session.userId = null;
          req.session.email = null;
    
          return res.redirect("/login");
        } else {
          return res.status(400).send({
            status: "error",
            message: "Invalid OTP. Please try again.",
          });
        }
      } catch (error) {
        console.error("OTP verification error:", error);
        return res.status(500).json({
          status: "error",
          message: "Failed to verify OTP. Please try again.",
        });
      }
}


const logout = async (req,res) =>{
    try {
        
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error",err.message)
                return res.redirect("/page-404")               
            }
          
            return res.redirect("/login")
        })
    } catch (error) {
        console.log("Logout Error",error);
        res.redirect("/page-404")
        
    }
}

const shopPageInfo = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 12;
        const skip = (page - 1) * limit;
        const searchTerm = req.query.search || '';
        const sortBy = req.query.sort || 'newest'; // Default sort

        // Build search query object
        const searchQuery = {
            isBlocked: false,
            status: 'Available'
        };

        if (searchTerm) {
            searchQuery.productName = { 
                $regex: searchTerm, 
                $options: 'i' 
            };
        }

        // Define sort options
        const sortOptions = {
            'popular': { purchaseCount: -1 },
            'price-low': { salePrice: 1 },
            'price-high': { salePrice: -1 },
            'featured': { isFeatured: -1, createdAt: -1 },
            'newest': { createdAt: -1 },
            'name-asc': { productName: 1 },
            'name-desc': { productName: -1 }
        };

        // Get total count for pagination
        const totalProducts = await Product.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalProducts / limit);

        // Get products with search, sort and pagination
        const products = await Product.find(searchQuery)
            .populate('category')
            .sort(sortOptions[sortBy] || sortOptions['newest'])
            .skip(skip)
            .limit(limit);

        const category = await Category.find({});
        const user = req.session.user || null;

        res.render('user/shop', {
            products,
            category,
            user,
            currentPage: page,
            totalPages,
            searchTerm,
            totalProducts,
            currentSort: sortBy,
            title: 'Shop'
        });

    } catch (error) {
        console.error('Error loading shop page:', error);
        res.status(500).send("Server Error");
    }
};

// Remove the loadShopPage function as it's no longer needed



const loadProfile = async (req,res) => {
    try {
        res.render('user/userProfile')
    } catch (error) {
        
    }

}

const updateProfile = async (req,res) =>{
    try {       
        const { name, email, phone } = req.body;
        console.log("Request Body:", req.body); 

        if (!req.user || !req.user._id) {                                            //
            return res.status(401).json({ error: 'Unauthorized. Please log in.' }); //
        }                                                                           //
        const userId = req.user._id; 
        console.log("req.user.id:",req.user._id)

      
        if (!name || !email || !phone) {
            return res.status(400).json({ error: 'All fields are required' });
        }

       
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { name, email, phone },
            { new: true, runValidators: true } 
        );
        console.log("updatedUser:",updatedUser)

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true, message: "Profile updated successfully" });
        // res.redirect('/user/userProfile');
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'An error occurred while updating the profile' });
    }
};


module.exports = {
    homepage,
    pageNotFound,
    loginPage,
    login,
    loadSignup,
    loadOtp,
    signup,
    verifyOtp,
    resendOtp,
    forgotPassword,
    loadForgotOtpPage,
    forgot,
    forgotOtpVerify,
    logout,
    loadHomePage,
    shopPageInfo,
    loadProfile,
    updateProfile,
   
}