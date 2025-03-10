const express = require('express')
const router = express.Router()
const adminController = require('../controllers/admin/adminController')
const customerController = require("../controllers/admin/customerController")
const categoryController = require("../controllers/admin/categoryController")
const productController = require("../controllers/admin/productController")
const orderController = require("../controllers/admin/orderController")
const couponController = require('../controllers/admin/couponController')
const {userAuth,adminAuth,isAdminAuthenticated} = require("../middlewares/auth")
const multer=require("multer")
const path=require('path')


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../public/uploads")); 
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });


//Login , DashBoard, Logout management
router.get("/login",adminController.loadLogin)
router.post("/dashboard",adminController.login)
router.get('/dashboard',isAdminAuthenticated,adminController.loadDashboard)
router.get("/pageerror",adminController.pageerror)
router.get("/logout",adminController.logout)

//Customer management
// router.get("/users",adminAuth,customerController.customerInfo)
router.get("/customer",customerController.customerInfo)
router.patch('/blockAndUnblock', customerController.blockOrUnblockUser);




//Category management
router.get("/category",adminAuth,categoryController.categoryInfo)
router.post("/addcategory",adminAuth,categoryController.addCategory)
router.get('/addcategory',categoryController.loadAddCategory)
router.get('/addCategory',categoryController.getCategory)
router.post('/deleteCategory/:id', categoryController.deleteCategory);
router.post('/restoreCategory/:id', categoryController.restoreCategory);
router.get('/editCategory',categoryController.getEditCategory)
router.post('/editCategory',categoryController.editCategory)
router.patch('/blockUnblockCategory', categoryController.blockOrUnblockCategory);


//Product Management
router.get('/allProduct',productController.getProductPage)
router.get("/addProduct",productController.getProductAddPage)
router.post('/addProduct', upload.array('cropImages', 4),productController.addProduct)
router.post("/update-product-image", upload.single("image"),productController.updateProductImages);
router.post('/deleteProduct/:id', productController.deleteProduct);
router.post('/restoreProduct/:id', productController.restoreProduct);
router.get('/editProduct',productController.loadEditProduct)
router.post('/editProduct/:id', upload.array('cropImages', 4), productController.editProduct)

//Order management
router.get("/orders",orderController.loadOrder)
router.get('/singleorderview/:orderId',orderController.singleOrder);
router.get('/cancelledorders',orderController.getCancelledOrders);
router.get('/returnRequestedOrders',orderController.getReturnRequestedOrderPage)
router.post("/approveReturnOrder/:orderId",orderController.approveReturn)
router.post("/changeStatus",orderController.changeStatus)

//Coupon management
router.get('/coupons',couponController.loadCouponpage)
router.get('/addCoupon', couponController.loadAddCouponPage)
router.post('/addCoupon',couponController.addCoupon)
router.post('/editCoupon',couponController.editCoupon)
router.get('/deleteCoupon/:id',couponController.deleteCoupon)



module.exports = router