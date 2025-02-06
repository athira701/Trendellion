const express = require('express')
const router = express.Router()
const User = require("../models/userSchema")
const userController = require("../controllers/user/userController")
const productController = require('../controllers/user/productController')
const categoryController = require('../controllers/user/categoryController')
const addressController = require('../controllers/user/addressController')
const passport = require('passport')
const { isAuthenticated, isNotAuthenticated,checkUserBlocked, addressMiddleware } = require('../middlewares/auth')



//Login & SignUp Management
router.get("/pageNotFound",userController.pageNotFound)
router.get("/",isAuthenticated,userController.loadHomePage)
router.get("/login",isAuthenticated,userController.loginPage)
router.get('/hom',checkUserBlocked,userController.homepage)
router.post("/login",userController.login)
router.get("/signup",userController.loadSignup)
router.get('/verify-otp',userController.loadOtp)
router.post("/signup",userController.signup)
router.post("/verify-otp",userController.verifyOtp)
router.post("/resendotp",userController.resendOtp)
router.get("/forgotPassword",userController.forgotPassword)
router.get("/logout",userController.logout)

// router.get('/shop',userController.loadShopPage)
router.get('/shop',userController.shopPageInfo)
router.get('/cart',checkUserBlocked,userController.loadCart);

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email'],prompt: 'select_account'}))
router.get('/auth/google/callback', passport.authenticate('google', { 
    failureRedirect: '/login', 
    failureFlash: true 
}), async (req, res) => {
    try {
        const user = req.user; // The authenticated user from Passport                                                //
        req.session.user = {
            _id: user._id,
            name: user.name,
            email: user.email,
        };
        req.session.isAuth = true; // Optional, if you want to track logged-in status
        res.redirect('/hom');
    } catch (error) {
        console.error("Error during Google authentication:", error);
        res.redirect('/login');
    }
})


router.get('/product/:id',productController.getProductDetails)
router.get('/category',categoryController.displayCategoryProducts)

//profile
router.get('/profile',userController.loadProfile)
router.post('/updateProfile',addressMiddleware,userController.updateProfile)

//Address Management
router.get('/addresses',addressController.getAddresses)
router.post('/addAddress',addressController.addAddress)
router.get('/address/:id',addressController.getEditAddress)
router.put('/address/:id',addressMiddleware,addressController.editAddress);
router.delete('/address/:id',addressMiddleware,addressController.deleteAddress)
//router.post("/setDefaultAddress/:addressId", addressController.setDefaultAddress);

//Cart Management


module.exports = router