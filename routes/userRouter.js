const express = require('express')
const router = express.Router()
const User = require("../models/userSchema")
const userController = require("../controllers/user/userController")
const productController = require('../controllers/user/productController')
const categoryController = require('../controllers/user/categoryController')
const cartController = require('../controllers/user/cartController')
const addressController = require('../controllers/user/addressController')
const profileController = require('../controllers/user/profileController')
const checkoutController = require('../controllers/user/checkoutController')
const orderController = require('../controllers/user/orderController')
const paymentController = require('../controllers/user/paymentController')
const wishlistController = require('../controllers/user/wishlistController')
const walletController = require('../controllers/user/walletController')
const passport = require('passport')
const { isAuthenticated, isUserAuthenticated,checkUserBlocked, addressMiddleware } = require('../middlewares/auth')



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
//forgot&reset Password setup
router.get("/forgotPassword",userController.forgotPassword)
router.post("/forgotPassword",userController.forgot)
router.get('/forgotOtp',userController.loadForgotOtpPage)
router.post('/forgotOtp',userController.forgotOtpVerify)
router.get('/resetPassword',userController.loadResetPasswordPage)
router.post('/resetPassword',userController.resetPassword)
router.get("/logout",userController.logout)


router.get('/change-password', profileController.getChangePassword)
router.post('/change-password', profileController.changePassword)
// router.get('/shop',userController.loadShopPage)
router.get('/shop',userController.shopPageInfo)


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
router.put('/address/:id',addressMiddleware,addressController.editAddress)
router.delete('/address/:id',addressMiddleware,addressController.deleteAddress)
router.put('/address/default/:addressId', addressController.setDefaultAddress);
//router.post("/setDefaultAddress/:addressId", addressController.setDefaultAddress);

//Cart Management
router.get('/cart',isUserAuthenticated,cartController.getCartPage)
router.post('/addToCart/:id', cartController.addToCart)
router.delete('/delete/:productId',cartController.deleteCartItem)
router.post('/update', cartController.updateCart);

//Checkout and orders
router.get('/checkout',checkoutController.getCheckoutPage)
router.post('/orderPlaced', orderController.placeOrder);
router.get('/placedOrder',orderController.orderPlacedpage)
router.get('/orders',orderController.getOrderPage)
router.get('/orders/:orderId',orderController.getOrderDetails)
router.post('/cancelOrder/:orderId',orderController.cancelOrderItem)
router.post('/returnOrder/:orderId',orderController.returnOrderItem)

//payment through Razorpay
router.post('/createRazorpayOrder',paymentController.createOrder)
//router.post('/initiateRazorpayOrder',paymentController.initiateRazorpay)


//wishlist management
router.get('/getWishlist',isUserAuthenticated,wishlistController.getWishlist)
router.post('/addToWishlist',wishlistController.addToWishlist)
router.post('/removeFromWishlist',wishlistController.removeFromWishlist)
//router.get('/checkWishlistStatus',wishlistController.checkWishlistStatus)

//coupon management
router.post('/applyCoupon',checkoutController.applyCoupon)
router.get('/availableCoupons',checkoutController.availableCoupons)
router.post('/removeCoupon',checkoutController.removeCoupon)

//wallet managegment
router.get('/wallets',walletController.getWalletPage)
router.post('/createWallet',walletController.createWallet);
router.post('/addMoney',walletController.addMoney)
router.post('/verify-wallet-payment',walletController.verifyPayment)
router.post('/process-wallet-payment', walletController.processWalletPayment)
//router.get('/walletDetails', walletController.getWalletDetails)

router.get('/download-invoice/:id',userController.downloadInvoice)



module.exports = router