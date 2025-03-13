const User = require("../../models/userSchema")
const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const Address = require('../../models/addressSchema')
const Order = require('../../models/orderSchema')
const PDFDocument = require('pdfkit')
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
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
        // console.log('User Data',userData);
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


// Controller functions for forgot password flow
const forgotPassword = async (req, res) => {
    try {
        res.render("user/forgotPassword");
    } catch (error) {
        console.error("Error loading forgot password page:", error);
        return res.status(500).json({
            success: false,
            message: "Server error occurred"
        });
    }
};

const loadForgotOtpPage = async (req, res) => {
    try {
        if (!req.session.forgotPasswordEmail) {
            return res.status(400).json({
                success: false,
                message: "Please provide your email first"
            });
        }
        res.render("user/forgotOtpPage");
    } catch (error) {
        console.error("Error loading OTP page:", error);
        return res.status(500).json({
            success: false,
            message: "Server error occurred"
        });
    }
};

const forgot = async (req, res) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No account found with this email address"
            });
        }

        // Generate OTP
        const otp = generateOtp();
        
        // Send OTP email
        try {
            await sendVerificationEmail(email, otp);
        } catch (emailError) {
            console.error("Email sending failed:", emailError);
            return res.status(500).json({
                success: false,
                message: "Failed to send OTP email. Please try again."
            });
        }

        // Store OTP data in session
        req.session.forgotPasswordOtp = otp;
        req.session.forgotPasswordEmail = email;
        req.session.otpExpiry = Date.now() + (5 * 60 * 1000); // 5 minutes expiry

        console.log("OTP sented dor forgot password:",otp);

        return res.json({
            success: true,
            message: "OTP sent successfully",
            redirectUrl: '/forgotOtp'
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred. Please try again."
        });
    }
};

const forgotOtpVerify = async (req, res) => {
    try {
        const { otp } = req.body;

        if (!otp || !req.session.forgotPasswordOtp || 
            !req.session.forgotPasswordEmail || !req.session.otpExpiry) {
            return res.json({
                success: false,
                message: "Invalid or expired OTP session. Please try again."
            });
        }

        if (Date.now() > req.session.otpExpiry) {
            // Clear expired session data
            delete req.session.forgotPasswordOtp;
            delete req.session.otpExpiry;
            return res.json({
                success: false,
                message: "OTP has expired. Please request a new one."
            });
        }

        if (otp !== req.session.forgotPasswordOtp) {
            return res.json({
                success: false,
                message: "Invalid OTP. Please try again."
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        req.session.resetToken = resetToken;
        req.session.resetTokenExpiry = Date.now() + (30 * 60 * 1000); // 30 minutes expiry

        // Clear OTP data
        delete req.session.forgotPasswordOtp;
        delete req.session.otpExpiry;

        return res.json({
            success: true,
            message: "OTP verified successfully",
            redirectUrl: '/resetPassword'
        });
    } catch (error) {
        console.error("OTP verification error:", error);
        return res.json({
            success: false,
            message: "An error occurred. Please try again."
        });
    }
};

const loadResetPasswordPage = async (req, res) => {
    try {
        if (!req.session.resetToken || !req.session.resetTokenExpiry || 
            Date.now() > req.session.resetTokenExpiry) {
            return res.redirect('/forgotPassword');
        }
        res.render("user/resetPassword");
    } catch (error) {
        console.error("Error loading reset password page:", error);
        return res.status(500).json({
            success: false,
            message: "Server error occurred"
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body;

        if (!req.session.resetToken || !req.session.resetTokenExpiry || 
            Date.now() > req.session.resetTokenExpiry) {
            return res.status(400).json({
                success: false,
                message: "Password reset session has expired"
            });
        }

        if (!newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Both password fields are required"
            });
        }

        if (!isValidPassword(newPassword)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long and contain at least one number and one special character"
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match"
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        const updatedUser = await User.findOneAndUpdate(
            { email: req.session.forgotPasswordEmail },
            { password: hashedPassword },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(400).json({
                success: false,
                message: "Failed to update password"
            });
        }

        // Clear all reset-related session data
        delete req.session.resetToken;
        delete req.session.resetTokenExpiry;
        delete req.session.forgotPasswordEmail;

        return res.json({
            success: true,
            message: "Password successfully reset",
            redirectUrl: '/login'
        });
    } catch (error) {
        console.error("Reset password error:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while resetting password"
        });
    }
};

// Helper function to validate password strength
const isValidPassword = (password) => {
    if (!password) return false;
    
    const minLength = 8;
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return password.length >= minLength && hasNumber && hasSpecialChar;
};



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
        // let wishlistItems = [];
        // if (req.session.user) {
        //     const wishlist = await Wishlist.findOne({ userId: req.session.user._id });
        //     if (wishlist) {
        //         wishlistItems = wishlist.items.map(item => item.productId.toString());
        //     }
        // }

        res.render('user/shop', {
            products,
            category,
            user,
            currentPage: page,
            totalPages,
            searchTerm,
            totalProducts,
            currentSort: sortBy,
            title: 'Shop',
            // wishlistItems
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

        if (!req.user || !req.user._id) {                                            
            return res.status(401).json({ error: 'Unauthorized. Please log in.' }); 
        }                                                                           
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


const downloadInvoice = async (req, res) => {
    try {
      // The issue is here - req.params is an object, not a string
      // Extract the orderId properly from req.params
      const { id } = req.params;
      
      console.log("order id:", id);
      
      // Find the order using the correct id
      const order = await Order.findOne({ orderId: id }).populate({
        path: 'orderedItems.product',
        select: 'productName productImage'
      });
      
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      
      // Create a PDF document
      const doc = new PDFDocument({ margin: 50 });
      
      // Set the response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${id}.pdf`);
      
      // Pipe the PDF to the response
      doc.pipe(res);
      
      // Add content to the PDF
      // Header
      doc.fontSize(20).text('INVOICE', { align: 'center' });
      doc.moveDown();
      
      // Company info
      doc.fontSize(12).text('TRENDELLION', { align: 'right' });
      doc.text('Bengaluru, Karnataka', { align: 'right' });
      doc.text('Phone: +91 7356957390', { align: 'right' });
      doc.text('Email: support@trendellion.com', { align: 'right' });
      doc.moveDown(2);
      
      // Customer & Order info
      doc.fontSize(12).text('Bill To:');
      doc.fontSize(10).text(`Name: ${order.address.name}`);
      doc.text(`Address: ${order.address.landMark}, ${order.address.city}`);
      doc.text(`${order.address.state} - ${order.address.pincode}`);
      doc.text(`Phone: ${order.address.phone}`);
      doc.moveDown();
      
      // Order details
      doc.fontSize(12).text('Order Details:');
      doc.fontSize(10).text(`Order ID: ${order.orderId}`);
      doc.text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`);
      doc.text(`Payment Method: ${order.paymentMethod}`);
      doc.text(`Payment Status: ${order.paymentStatus}`);
      doc.moveDown(2);
      
      // Table header
      let y = doc.y;
      doc.fontSize(10).text('Item', 50, y);
      doc.text('Size', 220, y);
      doc.text('Qty', 280, y);
      doc.text('Unit Price', 320, y);
      doc.text('Amount', 400, y);
      
      // Draw a line
      y += 15;
      doc.moveTo(50, y).lineTo(550, y).stroke();
      y += 10;
      
      // Table content
      for (const item of order.orderedItems) {
        const productName = item.product ? item.product.productName : 'Product not found';
        
        doc.text(productName, 50, y, { width: 170 });
        doc.text(item.size, 220, y);
        doc.text(item.quantity.toString(), 280, y);
        doc.text(`₹${item.price.toFixed(2)}`, 320, y);
        doc.text(`₹${(item.price * item.quantity).toFixed(2)}`, 400, y);
        
        y += 20;
        
        // Check if we need a new page
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
      }
      
      // Draw a line
      doc.moveTo(50, y).lineTo(550, y).stroke();
      y += 10;
      
      // Summary
      doc.text('Subtotal:', 320, y);
      doc.text(`₹${order.cartTotal.toFixed(2)}`, 400, y);
      y += 15;
      
      if (order.discountAmount > 0) {
        doc.text('Discount:', 320, y);
        doc.text(`-₹${order.discountAmount.toFixed(2)}`, 400, y);
        y += 15;
      }
      
      if (order.couponDiscount > 0) {
        doc.text('Coupon Discount:', 320, y);
        doc.text(`-₹${order.couponDiscount.toFixed(2)}`, 400, y);
        y += 15;
      }
      
      doc.text('Delivery Fee:', 320, y);
      doc.text(`₹${order.deliveryFee.toFixed(2)}`, 400, y);
      y += 15;
      
      doc.fontSize(12).text('Total Amount:', 320, y);
      doc.fontSize(12).text(`₹${order.totalAmount.toFixed(2)}`, 400, y);
      
      // Footer
      doc.fontSize(10).text('Thank you for your business!', 50, 700, { align: 'center' });
      
      // Finalize the PDF and end the stream
      doc.end();
      
    } catch (error) {
      console.error('Error generating invoice:', error);
      res.status(500).json({ success: false, message: 'Failed to generate invoice', error: error.message });
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
    loadResetPasswordPage,
    resetPassword,
    logout,
    loadHomePage,
    shopPageInfo,
    loadProfile,
    updateProfile,
    downloadInvoice 
   
}